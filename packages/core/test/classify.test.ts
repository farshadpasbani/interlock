import { describe, expect, it } from "vitest";
import { classify, classifyAuthor, tierForPath } from "../src/classify.js";
import { parsePolicy } from "../src/policy.js";
import type { ChangedFile } from "../src/types.js";

const policy = parsePolicy(`
version: 1
authors:
  agents:
    accounts: ["*[bot]", "my-agent"]
    branches: ["claude/*", "agent/*"]
    trailers: ["Co-Authored-By: Claude*"]
tiers:
  tier0: ["docs/**", "**/*.md", "tests/**"]
  tier2: [".github/**", "interlock.yml", "src/auth/**"]
`);

describe("classifyAuthor", () => {
  it("matches bot accounts literally despite brackets in the glob", () => {
    // "[bot]" must NOT be treated as a character class
    expect(classifyAuthor({ account: "renovate[bot]" }, policy)).toBe("agent");
    expect(classifyAuthor({ account: "rb" }, policy)).toBe("human");
  });

  it("matches exact account names", () => {
    expect(classifyAuthor({ account: "my-agent" }, policy)).toBe("agent");
  });

  it("matches branch prefixes", () => {
    expect(
      classifyAuthor({ account: "farshad", branch: "claude/fix-1" }, policy)
    ).toBe("agent");
  });

  it("matches commit trailers", () => {
    expect(
      classifyAuthor(
        {
          account: "farshad",
          trailers: ["Co-Authored-By: Claude <noreply@anthropic.com>"],
        },
        policy
      )
    ).toBe("agent");
  });

  it("defaults to human", () => {
    expect(
      classifyAuthor({ account: "farshad", branch: "fix/typo" }, policy)
    ).toBe("human");
  });
});

describe("tierForPath", () => {
  it("matches tier0 globs", () => {
    expect(tierForPath("docs/intro.md", policy)).toEqual({
      tier: 0,
      matchedRule: "docs/**",
    });
  });

  it("defaults to tier 1", () => {
    expect(tierForPath("src/engine.ts", policy)).toEqual({
      tier: 1,
      matchedRule: "default",
    });
  });

  it("matches tier2 globs", () => {
    expect(tierForPath("src/auth/login.ts", policy).tier).toBe(2);
  });

  it("protected wins when globs overlap (tier2 checked first)", () => {
    // .github/README.md matches both "**/*.md" (tier0) and ".github/**" (tier2)
    expect(tierForPath(".github/README.md", policy)).toEqual({
      tier: 2,
      matchedRule: ".github/**",
    });
  });

  it("matches dotfiles (dot: true)", () => {
    expect(tierForPath(".github/workflows/ci.yml", policy).tier).toBe(2);
  });
});

const agentAuthor = { account: "my-agent" };
const humanAuthor = { account: "farshad" };

function files(...paths: string[]): ChangedFile[] {
  return paths.map((path) => ({ path, status: "modified" as const }));
}

describe("classify", () => {
  it("PR tier is the max tier across files", () => {
    const v = classify(
      files("docs/a.md", "src/engine.ts"),
      humanAuthor,
      policy
    );
    expect(v.tier).toBe(1);
    expect(v.perFile).toHaveLength(2);
  });

  it("a single protected file makes the PR tier 2", () => {
    const v = classify(
      files("docs/a.md", "interlock.yml"),
      humanAuthor,
      policy
    );
    expect(v.tier).toBe(2);
  });

  it("renames count as both paths", () => {
    const v = classify(
      [
        {
          path: "docs/new.md",
          previousPath: "src/auth/old.ts",
          status: "renamed",
        },
      ],
      humanAuthor,
      policy
    );
    expect(v.tier).toBe(2); // old path was protected
    expect(v.perFile.map((f) => f.path)).toContain("src/auth/old.ts");
  });

  it("agent on tier2 produces an agent-on-tier2 violation with default block", () => {
    const v = classify(files(".github/workflows/ci.yml"), agentAuthor, policy);
    expect(v.authorClass).toBe("agent");
    expect(v.violations).toEqual([
      {
        kind: "agent-on-tier2",
        setting: "block",
        paths: [".github/workflows/ci.yml"],
      },
    ]);
  });

  it("human on tier2 produces a warn violation by default", () => {
    const v = classify(files("interlock.yml"), humanAuthor, policy);
    expect(v.violations[0]?.kind).toBe("human-on-tier2");
    expect(v.violations[0]?.setting).toBe("warn");
  });

  it("no tier2 files → no violations", () => {
    const v = classify(files("docs/a.md"), agentAuthor, policy);
    expect(v.violations).toEqual([]);
    expect(v.requirements[0]).toMatch(/Tier 0/);
  });

  it("monotonicity: adding a file never lowers the PR tier", () => {
    const base = files("src/engine.ts");
    const before = classify(base, humanAuthor, policy).tier;
    for (const extra of ["docs/a.md", "tests/x.test.ts", "interlock.yml"]) {
      const after = classify(
        [...base, ...files(extra)],
        humanAuthor,
        policy
      ).tier;
      expect(after).toBeGreaterThanOrEqual(before);
    }
  });
});
