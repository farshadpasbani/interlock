import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONSTITUTION_TEMPLATES } from "../templates.generated.js";
import { detectRepo, detectStack } from "../constitution/detect.js";
import {
  buildCi, buildClaudeMd, buildValues, fillPlaceholders, OUTPUT_MAP,
} from "../constitution/render.js";

export interface ScaffoldOptions {
  cwd: string;
  force: boolean;
}
export interface ScaffoldIo {
  log: (s: string) => void;
  error: (s: string) => void;
}

export function scaffoldConstitution(opts: ScaffoldOptions, io: ScaffoldIo): number {
  const targets = [...Object.values(OUTPUT_MAP), ".github/workflows/ci.yml", "CLAUDE.md"];
  if (!opts.force) {
    const conflict = targets.find((rel) => existsSync(join(opts.cwd, rel)));
    if (conflict) {
      io.error(`${conflict} already exists — re-run with --force to overwrite.`);
      return 2;
    }
  }

  const exec = (cmd: string, args: string[]): string =>
    execFileSync(cmd, args, { cwd: opts.cwd, encoding: "utf8" });
  const repo = detectRepo(opts.cwd, exec);
  const stack = detectStack(opts.cwd);
  const values = buildValues(repo, stack);

  const write = (rel: string, content: string) => {
    const full = join(opts.cwd, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  };

  // 1. Every vendored template → its mapped path, placeholders filled.
  for (const [tplKey, content] of Object.entries(CONSTITUTION_TEMPLATES)) {
    const dest = OUTPUT_MAP[tplKey];
    if (!dest) continue; // only write known mappings
    write(dest, fillPlaceholders(content, values));
  }
  // 2. Generated files.
  write(".github/workflows/ci.yml", buildCi(stack));
  write("CLAUDE.md", buildClaudeMd());

  if (!repo.detected) {
    io.log("Warning: No git remote detected — CODEOWNERS uses a placeholder handle. Set a real GitHub handle in .github/CODEOWNERS before going live, or CODEOWNERS will not enforce.");
  }
  if (!stack.detected) {
    io.log("Warning: No recognised stack — fill the command placeholders in .github/workflows/ci.yml and docs/agents/.");
  }

  io.log("Wrote the agent constitution (status: shadow).");
  io.log("");
  io.log("One-time setup to make the law enforced:");
  io.log("  1. Enable branch protection on `main`, requiring the `checks` + `interlock` status checks.");
  io.log("  2. Create the labels — see the `gh label create` block in docs/agents/triage-labels.md.");
  io.log("  3. Open a pinned 'Loop Journal' issue and set its number in docs/agents/loop-policy.md.");
  io.log("Then run /master-loop (Claude Code) to operate the fleet. Nothing auto-merges until you audit it clean.");
  return 0;
}
