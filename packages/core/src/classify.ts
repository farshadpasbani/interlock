import picomatch from "picomatch";
import type { Policy } from "./policy.js";
import type {
  AuthorClass,
  AuthorInfo,
  ChangedFile,
  FileVerdict,
  Tier,
  Verdict,
  Violation,
} from "./types.js";

/** Paths: brackets behave as globs; dotfiles match (a guard must see dotfiles). */
const PATH_OPTS = { dot: true } as const;
/** Authors: nobracket so "*[bot]" matches literal "[bot]", not a char class. */
const AUTHOR_OPTS = { dot: true, nobracket: true } as const;

function firstMatch(
  value: string,
  patterns: string[],
  opts: object
): string | undefined {
  for (const p of patterns) {
    if (picomatch.isMatch(value, p, opts)) return p;
  }
  return undefined;
}

export function classifyAuthor(
  author: AuthorInfo,
  policy: Policy
): AuthorClass {
  const agents = policy.authors.agents;
  if (firstMatch(author.account, agents.accounts, AUTHOR_OPTS)) return "agent";
  if (author.branch && firstMatch(author.branch, agents.branches, AUTHOR_OPTS))
    return "agent";
  for (const trailer of author.trailers ?? []) {
    if (firstMatch(trailer, agents.trailers, AUTHOR_OPTS)) return "agent";
  }
  return "human";
}

export function tierForPath(
  path: string,
  policy: Policy
): { tier: Tier; matchedRule: string } {
  const t2 = firstMatch(path, policy.tiers.tier2, PATH_OPTS);
  if (t2) return { tier: 2, matchedRule: t2 };
  const t0 = firstMatch(path, policy.tiers.tier0, PATH_OPTS);
  if (t0) return { tier: 0, matchedRule: t0 };
  return { tier: 1, matchedRule: "default" };
}

export function classify(
  changedFiles: ChangedFile[],
  author: AuthorInfo,
  policy: Policy
): Verdict {
  const authorClass = classifyAuthor(author, policy);

  // Renames count as touching both the old and the new path.
  const paths = new Set<string>();
  for (const f of changedFiles) {
    paths.add(f.path);
    if (f.previousPath && f.previousPath !== f.path) paths.add(f.previousPath);
  }

  const perFile: FileVerdict[] = [...paths].map((path) => ({
    path,
    ...tierForPath(path, policy),
  }));

  const tier = perFile.reduce<Tier>(
    (max, f) => (f.tier > max ? f.tier : max),
    0
  );

  const violations: Violation[] = [];
  const tier2Paths = perFile.filter((f) => f.tier === 2).map((f) => f.path);
  if (tier2Paths.length > 0) {
    violations.push(
      authorClass === "agent"
        ? {
            kind: "agent-on-tier2",
            setting: policy.rules["agent-on-tier2"],
            paths: tier2Paths,
          }
        : {
            kind: "human-on-tier2",
            setting: policy.rules["human-on-tier2"],
            paths: tier2Paths,
          }
    );
  }

  return {
    tier,
    authorClass,
    mode: policy.mode,
    perFile,
    violations,
    requirements: buildRequirements(tier, authorClass, violations),
  };
}

function buildRequirements(
  tier: Tier,
  authorClass: AuthorClass,
  violations: Violation[]
): string[] {
  const out: string[] = [];
  if (tier === 0)
    out.push(
      "Tier 0 — behaviour-neutral; eligible for auto-merge when CI is green."
    );
  if (tier === 1) out.push("Tier 1 — ordinary change; review per your normal process.");
  if (tier === 2)
    out.push(`Tier 2 — protected paths touched (author: ${authorClass}).`);
  for (const v of violations) {
    if (v.setting === "block")
      out.push(`BLOCKED — ${v.kind}: ${v.paths.join(", ")}`);
    if (v.setting === "require-review")
      out.push(`Requires at least one human approval — ${v.kind}.`);
    if (v.setting === "warn")
      out.push(`Warning — ${v.kind}: ${v.paths.join(", ")}`);
  }
  return out;
}
