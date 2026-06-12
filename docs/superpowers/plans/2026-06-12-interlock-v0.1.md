# Interlock v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Interlock v0.1 — a deterministic governance gate for AI-agent pull requests: a pure TypeScript classify engine, an `agent-interlock` CLI (`init`/`check`/`explain`), and a GitHub Action that posts tier verdicts (check + sticky comment + label) in observe/enforce modes.

**Architecture:** Monorepo (npm workspaces). `packages/core` is a pure, side-effect-free engine: zod-validated policy + `classify(files, author, policy) → Verdict` + `gate(verdict, ctx)`. `packages/cli` and `action/` are thin adapters around it. The Action reads the policy from the PR **base** ref (a PR cannot weaken the law that judges it).

**Tech Stack:** TypeScript (strict, NodeNext ESM), Node 20+, vitest, zod, picomatch, yaml, commander, @actions/core, @actions/github, esbuild (Action bundle).

**Spec:** `docs/superpowers/specs/2026-06-12-interlock-v0.1-design.md`

---

## File structure

```
interlock/
  package.json                    # workspaces root (private)
  tsconfig.base.json              # strict NodeNext base
  vitest.config.ts                # one runner for all packages; core alias to src
  .gitignore
  packages/core/
    package.json                  # @interlock-dev/core
    tsconfig.json
    src/types.ts                  # Tier, ChangedFile, AuthorInfo, Verdict, Violation
    src/policy.ts                 # zod schema, parsePolicy, PolicyError
    src/classify.ts               # classifyAuthor, tierForPath, classify
    src/gating.ts                 # gate(verdict, ctx)
    src/index.ts                  # public exports
    test/policy.test.ts
    test/classify.test.ts
    test/gating.test.ts
  packages/cli/
    package.json                  # agent-interlock (bin)
    tsconfig.json
    src/index.ts                  # commander wiring (bin entry, shebang)
    src/git.ts                    # diff parsing + author info (injectable exec)
    src/output.ts                 # verdict → human-readable table
    src/commands/check.ts
    src/commands/init.ts
    src/commands/explain.ts
    test/git.test.ts
    test/output.test.ts
    test/check.test.ts
    test/init.test.ts
    test/explain.test.ts
  action/
    package.json
    tsconfig.json
    action.yml
    src/helpers.ts                # pure: mapFiles, extractTrailers, buildComment, MARKER, withRetry
    src/main.ts                   # orchestration (thin)
    test/helpers.test.ts
    dist/index.js                 # committed esbuild bundle
  interlock.yml                   # dogfood (Task 14)
  .github/workflows/interlock.yml # dogfood (Task 14)
  README.md                       # 10-minute path (Task 15)
```

Rule of thumb throughout: **core is pure** (no fs, no network, no process). Anything impure lives in the adapters and is injected in tests.

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`
- Create: `packages/core/test/smoke.test.ts`

- [x] **Step 1: Root files**

`package.json`:

```json
{
  "name": "interlock-monorepo",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "workspaces": ["packages/*", "action"],
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -b packages/core packages/cli action",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^3.0.0",
    "@types/node": "^20.14.0"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "composite": true,
    "types": ["node"]
  }
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@interlock-dev/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url)
      ),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "action/test/**/*.test.ts"],
  },
});
```

`.gitignore`:

```
node_modules/
dist/
!action/dist/
*.tsbuildinfo
```

(Note the exception: `action/dist/` is committed — GitHub Actions runs the bundled file.)

- [x] **Step 2: core package skeleton**

`packages/core/package.json`:

```json
{
  "name": "@interlock-dev/core",
  "version": "0.1.0",
  "type": "module",
  "license": "Apache-2.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "build": "tsc -p ." },
  "dependencies": {
    "picomatch": "^4.0.0",
    "yaml": "^2.4.0",
    "zod": "^3.24.0"
  },
  "devDependencies": { "@types/picomatch": "^3.0.0" }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

`packages/core/src/index.ts` (placeholder for now):

```ts
export const VERSION = "0.1.0";
```

`packages/core/test/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { VERSION } from "../src/index.js";

describe("scaffold", () => {
  it("imports the core package", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
```

- [x] **Step 3: Install and verify**

Run: `npm install && npx vitest run`
Expected: 1 test file, 1 passed.

- [x] **Step 4: Commit** *(done: e073ea3 + review fixes 819df2d — typecheck scoped to existing pkgs, core exports map added; extend typecheck script in T7/T12)*

```bash
git add -A && git commit -m "chore: monorepo scaffold (workspaces, vitest, core skeleton)"
```

---

### Task 2: Core types

**Files:**
- Create: `packages/core/src/types.ts`

- [x] **Step 1: Write the types (no test needed — types only)** *(done: 2848621, verified identical to spec)*

`packages/core/src/types.ts`:

```ts
export type Tier = 0 | 1 | 2;

export interface ChangedFile {
  path: string;
  /** Old path for renames — counts as touched too. */
  previousPath?: string;
  status: "added" | "modified" | "removed" | "renamed";
}

export interface AuthorInfo {
  /** PR author login (Action) or last commit author name (CLI). */
  account: string;
  /** Head branch name, if known. */
  branch?: string;
  /** Commit trailer lines, e.g. "Co-Authored-By: Claude <noreply@anthropic.com>". */
  trailers?: string[];
}

export type AuthorClass = "agent" | "human";

export type RuleSetting = "block" | "warn" | "require-review";

export interface FileVerdict {
  path: string;
  tier: Tier;
  /** The glob that decided the tier, or "default" for implicit tier 1. */
  matchedRule: string;
}

export interface Violation {
  kind: "agent-on-tier2" | "human-on-tier2";
  setting: RuleSetting;
  paths: string[];
}

export interface Verdict {
  tier: Tier;
  authorClass: AuthorClass;
  mode: "observe" | "enforce";
  perFile: FileVerdict[];
  violations: Violation[];
  /** Human-readable lines describing what this PR needs. */
  requirements: string[];
}
```

- [x] **Step 2: Typecheck and commit**

Run: `npx tsc -b packages/core`
Expected: no errors.

```bash
git add -A && git commit -m "feat(core): verdict and policy domain types"
```

---

### Task 3: Policy schema and parser

**Files:**
- Create: `packages/core/src/policy.ts`
- Test: `packages/core/test/policy.test.ts`

- [x] **Step 1: Write the failing tests**

`packages/core/test/policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parsePolicy, PolicyError } from "../src/policy.js";

const MINIMAL = `
version: 1
`;

const FULL = `
version: 1
mode: enforce
authors:
  agents:
    accounts: ["*[bot]"]
    branches: ["claude/*"]
    trailers: ["Co-Authored-By: Claude*"]
tiers:
  tier0: ["docs/**", "**/*.md"]
  tier2: [".github/**", "interlock.yml"]
rules:
  agent-on-tier2: block
  human-on-tier2: require-review
`;

describe("parsePolicy", () => {
  it("applies defaults on a minimal policy", () => {
    const p = parsePolicy(MINIMAL);
    expect(p.mode).toBe("observe");
    expect(p.authors.agents.accounts).toEqual([]);
    expect(p.tiers.tier0).toEqual([]);
    expect(p.tiers.tier2).toEqual([]);
    expect(p.rules["agent-on-tier2"]).toBe("block");
    expect(p.rules["human-on-tier2"]).toBe("warn");
  });

  it("parses a full policy", () => {
    const p = parsePolicy(FULL);
    expect(p.mode).toBe("enforce");
    expect(p.authors.agents.branches).toEqual(["claude/*"]);
    expect(p.rules["human-on-tier2"]).toBe("require-review");
  });

  it("rejects invalid YAML with a PolicyError", () => {
    expect(() => parsePolicy("version: 1\n  bad indent: [")).toThrow(PolicyError);
  });

  it("rejects an empty file", () => {
    expect(() => parsePolicy("")).toThrow(PolicyError);
  });

  it("rejects an unsupported version", () => {
    expect(() => parsePolicy("version: 2")).toThrow(/version/);
  });

  it("rejects unknown keys (catches typos)", () => {
    expect(() => parsePolicy("version: 1\ntires:\n  tier0: []")).toThrow(PolicyError);
  });

  it("rejects a bad rule value with a readable message", () => {
    expect(() =>
      parsePolicy("version: 1\nrules:\n  agent-on-tier2: maybe")
    ).toThrow(/agent-on-tier2/);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/test/policy.test.ts`
Expected: FAIL — cannot find module `../src/policy.js`.

- [x] **Step 3: Implement**

`packages/core/src/policy.ts`:

```ts
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}

const agentsSchema = z
  .object({
    accounts: z.array(z.string()).default([]),
    branches: z.array(z.string()).default([]),
    trailers: z.array(z.string()).default([]),
  })
  .strict()
  .default({});

export const policySchema = z
  .object({
    version: z.literal(1, {
      errorMap: () => ({ message: "only version: 1 is supported" }),
    }),
    mode: z.enum(["observe", "enforce"]).default("observe"),
    authors: z.object({ agents: agentsSchema }).strict().default({}),
    tiers: z
      .object({
        tier0: z.array(z.string()).default([]),
        tier2: z.array(z.string()).default([]),
      })
      .strict()
      .default({}),
    rules: z
      .object({
        "agent-on-tier2": z.enum(["block", "warn"]).default("block"),
        "human-on-tier2": z.enum(["warn", "require-review"]).default("warn"),
      })
      .strict()
      .default({}),
  })
  .strict();

export type Policy = z.infer<typeof policySchema>;

export function parsePolicy(yamlText: string): Policy {
  let doc: unknown;
  try {
    doc = parseYaml(yamlText);
  } catch (e) {
    throw new PolicyError(
      `interlock.yml is not valid YAML: ${(e as Error).message}`
    );
  }
  if (doc === null || doc === undefined) {
    throw new PolicyError("interlock.yml is empty");
  }
  const result = policySchema.safeParse(doc);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`
    );
    throw new PolicyError(`interlock.yml is invalid:\n${lines.join("\n")}`);
  }
  return result.data;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/test/policy.test.ts`
Expected: all 7 pass.

- [x] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): policy schema with strict validation and defaults"
```

---

### Task 4: Author classification and path tiering

**Files:**
- Create: `packages/core/src/classify.ts` (first half)
- Test: `packages/core/test/classify.test.ts` (first half)

- [x] **Step 1: Write the failing tests**

`packages/core/test/classify.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyAuthor, tierForPath } from "../src/classify.js";
import { parsePolicy } from "../src/policy.js";

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
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/test/classify.test.ts`
Expected: FAIL — cannot find module `../src/classify.js`.

- [x] **Step 3: Implement**

`packages/core/src/classify.ts`:

```ts
import picomatch from "picomatch";
import type { Policy } from "./policy.js";
import type { AuthorClass, AuthorInfo, Tier } from "./types.js";

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
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/test/classify.test.ts`
Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): author classification and path tiering"
```

---

### Task 5: The classify() verdict

**Files:**
- Modify: `packages/core/src/classify.ts` (append)
- Test: `packages/core/test/classify.test.ts` (append)

- [x] **Step 1: Write the failing tests (append to classify.test.ts)**

```ts
import { classify } from "../src/classify.js";
import type { ChangedFile } from "../src/types.js";

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
```

- [x] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run packages/core/test/classify.test.ts`
Expected: FAIL — `classify` is not exported.

- [x] **Step 3: Implement (append to classify.ts)**

```ts
import type {
  ChangedFile,
  FileVerdict,
  Verdict,
  Violation,
} from "./types.js";

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
```

(Adjust the existing import line at the top of `classify.ts` to include the new types: `import type { AuthorClass, AuthorInfo, ChangedFile, FileVerdict, Tier, Verdict, Violation } from "./types.js";` — one import statement, not two.)

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/test/classify.test.ts`
Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): classify() verdict with violations and requirements"
```

---

### Task 6: Gating

**Files:**
- Create: `packages/core/src/gating.ts`
- Test: `packages/core/test/gating.test.ts`

- [x] **Step 1: Write the failing tests**

`packages/core/test/gating.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gate } from "../src/gating.js";
import type { Verdict } from "../src/types.js";

function verdict(overrides: Partial<Verdict>): Verdict {
  return {
    tier: 2,
    authorClass: "agent",
    mode: "enforce",
    perFile: [],
    violations: [],
    requirements: [],
    ...overrides,
  };
}

describe("gate", () => {
  it("never fails in observe mode", () => {
    const v = verdict({
      mode: "observe",
      violations: [
        { kind: "agent-on-tier2", setting: "block", paths: ["interlock.yml"] },
      ],
    });
    expect(gate(v).shouldFail).toBe(false);
  });

  it("fails on block violations in enforce mode", () => {
    const v = verdict({
      violations: [
        { kind: "agent-on-tier2", setting: "block", paths: ["interlock.yml"] },
      ],
    });
    const g = gate(v);
    expect(g.shouldFail).toBe(true);
    expect(g.reasons[0]).toMatch(/agent-on-tier2/);
  });

  it("require-review fails without a human approval", () => {
    const v = verdict({
      authorClass: "human",
      violations: [
        {
          kind: "human-on-tier2",
          setting: "require-review",
          paths: ["interlock.yml"],
        },
      ],
    });
    expect(gate(v, { humanApprovalCount: 0 }).shouldFail).toBe(true);
    expect(gate(v, { humanApprovalCount: 1 }).shouldFail).toBe(false);
  });

  it("warn never fails", () => {
    const v = verdict({
      violations: [
        { kind: "human-on-tier2", setting: "warn", paths: ["interlock.yml"] },
      ],
    });
    expect(gate(v).shouldFail).toBe(false);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/test/gating.test.ts`
Expected: FAIL — cannot find module `../src/gating.js`.

- [x] **Step 3: Implement**

`packages/core/src/gating.ts`:

```ts
import type { Verdict } from "./types.js";

export interface GatingContext {
  /** Count of PR approvals from human-classified reviewers (Action supplies this). */
  humanApprovalCount?: number;
}

export interface GatingResult {
  shouldFail: boolean;
  reasons: string[];
}

export function gate(verdict: Verdict, ctx: GatingContext = {}): GatingResult {
  if (verdict.mode !== "enforce") return { shouldFail: false, reasons: [] };
  const reasons: string[] = [];
  for (const v of verdict.violations) {
    if (v.setting === "block") {
      reasons.push(`${v.kind}: blocked (${v.paths.join(", ")})`);
    }
    if (v.setting === "require-review" && (ctx.humanApprovalCount ?? 0) < 1) {
      reasons.push(`${v.kind}: requires a human approval; none present`);
    }
  }
  return { shouldFail: reasons.length > 0, reasons };
}
```

- [x] **Step 4: Run tests, then export the public API**

Run: `npx vitest run packages/core/test/gating.test.ts`
Expected: all pass.

Replace `packages/core/src/index.ts` with:

```ts
export * from "./types.js";
export { parsePolicy, policySchema, PolicyError, type Policy } from "./policy.js";
export { classify, classifyAuthor, tierForPath } from "./classify.js";
export { gate, type GatingContext, type GatingResult } from "./gating.js";
```

Delete `packages/core/test/smoke.test.ts` (scaffold-only; superseded by real tests).

Run: `npx vitest run && npx tsc -b packages/core`
Expected: all green.

- [x] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): enforce-mode gating and public API"
```

---

> **Milestone note (core complete):** Opus review of 819df2d..319a169 found two criticals, both fixed in 5c9fa8a with red-first TDD: (C1) path-normalization bypass — `./`/`\`/leading-`/` dodged tier2 globs; now normalized at the core chokepoint, `..` rejected via `InvalidPathError` (exported; adapters must catch → CLI exit 2 / Action setFailed). (C2) empty-string globs now rejected at parse time. Core suite: 37 tests. Deferred as acceptable: matcher precompilation (M1, perf-only).

### Task 7: CLI package skeleton + git diff parsing

**Files:**
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`
- Create: `packages/cli/src/git.ts`
- Test: `packages/cli/test/git.test.ts`

- [x] **Step 1: Package skeleton**

`packages/cli/package.json`:

```json
{
  "name": "agent-interlock",
  "version": "0.1.0",
  "type": "module",
  "license": "Apache-2.0",
  "description": "Tool-neutral governance gate for AI-agent pull requests: protected paths + tiered merge rules.",
  "bin": { "agent-interlock": "./dist/index.js" },
  "files": ["dist"],
  "engines": { "node": ">=20" },
  "scripts": { "build": "tsc -p ." },
  "dependencies": {
    "@interlock-dev/core": "0.1.0",
    "commander": "^12.0.0"
  }
}
```

`packages/cli/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

Run: `npm install`
Expected: workspace link resolves `@interlock-dev/core`.

- [x] **Step 2: Write the failing tests**

`packages/cli/test/git.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getAuthorInfo, parseNameStatus } from "../src/git.js";

describe("parseNameStatus", () => {
  it("parses added/modified/deleted", () => {
    const out = "A\tdocs/new.md\nM\tsrc/engine.ts\nD\told.txt\n";
    expect(parseNameStatus(out)).toEqual([
      { path: "docs/new.md", status: "added" },
      { path: "src/engine.ts", status: "modified" },
      { path: "old.txt", status: "removed" },
    ]);
  });

  it("parses renames with both paths", () => {
    const out = "R100\tsrc/auth/old.ts\tdocs/new.md\n";
    expect(parseNameStatus(out)).toEqual([
      { path: "docs/new.md", previousPath: "src/auth/old.ts", status: "renamed" },
    ]);
  });

  it("ignores blank lines", () => {
    expect(parseNameStatus("\n\n")).toEqual([]);
  });
});

describe("getAuthorInfo", () => {
  it("collects branch, account, and trailer lines via the injected exec", () => {
    const calls: string[][] = [];
    const exec = (_cmd: string, args: string[]): string => {
      calls.push(args);
      if (args[0] === "rev-parse") return "claude/fix-1\n";
      if (args[0] === "log" && args[1] === "-1") return "Farshad\n";
      return "feat: thing\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n\x00";
    };
    const author = getAuthorInfo("main", exec);
    expect(author.branch).toBe("claude/fix-1");
    expect(author.account).toBe("Farshad");
    expect(author.trailers).toContain(
      "Co-Authored-By: Claude <noreply@anthropic.com>"
    );
  });
});
```

- [x] **Step 3: Run tests to verify they fail**

Run: `npx vitest run packages/cli/test/git.test.ts`
Expected: FAIL — cannot find module `../src/git.js`.

- [x] **Step 4: Implement**

`packages/cli/src/git.ts`:

```ts
import { execFileSync } from "node:child_process";
import type { AuthorInfo, ChangedFile } from "@interlock-dev/core";

export type Exec = (cmd: string, args: string[]) => string;

const defaultExec: Exec = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8" });

export function parseNameStatus(out: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const code = parts[0] ?? "";
    if (code.startsWith("R") || code.startsWith("C")) {
      if (parts[1] && parts[2])
        files.push({ path: parts[2], previousPath: parts[1], status: "renamed" });
    } else if (code === "A" && parts[1]) {
      files.push({ path: parts[1], status: "added" });
    } else if (code === "D" && parts[1]) {
      files.push({ path: parts[1], status: "removed" });
    } else if (parts[1]) {
      files.push({ path: parts[1], status: "modified" });
    }
  }
  return files;
}

export function getChangedFiles(base: string, exec: Exec = defaultExec): ChangedFile[] {
  return parseNameStatus(
    exec("git", ["diff", "--name-status", "-M", `${base}...HEAD`])
  );
}

const TRAILER_RE = /^[A-Za-z][A-Za-z-]*:\s.+/;

export function getAuthorInfo(base: string, exec: Exec = defaultExec): AuthorInfo {
  const branch = exec("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const account = exec("git", ["log", "-1", "--format=%an"]).trim() || "unknown";
  const bodies = exec("git", ["log", `${base}...HEAD`, "--format=%B%x00"]);
  const trailers: string[] = [];
  for (const body of bodies.split("\0")) {
    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (TRAILER_RE.test(line)) trailers.push(line);
    }
  }
  return { account, branch, trailers };
}
```

- [x] **Step 5: Run tests to verify they pass, commit**

Run: `npx vitest run packages/cli/test/git.test.ts`
Expected: all pass.

```bash
git add -A && git commit -m "feat(cli): git diff parsing and author info collection"
```

---

### Task 8: Verdict output formatting

**Files:**
- Create: `packages/cli/src/output.ts`
- Test: `packages/cli/test/output.test.ts`

- [x] **Step 1: Write the failing test**

`packages/cli/test/output.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatVerdict } from "../src/output.js";
import type { Verdict } from "@interlock-dev/core";

const verdict: Verdict = {
  tier: 2,
  authorClass: "agent",
  mode: "observe",
  perFile: [
    { path: "docs/a.md", tier: 0, matchedRule: "docs/**" },
    { path: "interlock.yml", tier: 2, matchedRule: "interlock.yml" },
  ],
  violations: [
    { kind: "agent-on-tier2", setting: "block", paths: ["interlock.yml"] },
  ],
  requirements: [
    "Tier 2 — protected paths touched (author: agent).",
    "BLOCKED — agent-on-tier2: interlock.yml",
  ],
};

describe("formatVerdict", () => {
  it("renders header, per-file table, and requirements", () => {
    const text = formatVerdict(verdict);
    expect(text).toContain("Tier 2");
    expect(text).toContain("agent");
    expect(text).toContain("docs/a.md");
    expect(text).toContain("interlock.yml");
    expect(text).toContain("BLOCKED — agent-on-tier2");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/cli/test/output.test.ts`
Expected: FAIL — cannot find module `../src/output.js`.

- [x] **Step 3: Implement**

`packages/cli/src/output.ts`:

```ts
import type { Verdict } from "@interlock-dev/core";

export function formatVerdict(verdict: Verdict): string {
  const lines: string[] = [];
  lines.push(
    `Interlock: Tier ${verdict.tier} (${verdict.authorClass} author, mode: ${verdict.mode})`
  );
  lines.push("");
  const width = Math.max(4, ...verdict.perFile.map((f) => f.path.length));
  lines.push(`${"PATH".padEnd(width)}  TIER  RULE`);
  for (const f of verdict.perFile) {
    lines.push(`${f.path.padEnd(width)}  ${String(f.tier).padEnd(4)}  ${f.matchedRule}`);
  }
  lines.push("");
  lines.push(...verdict.requirements);
  return lines.join("\n");
}
```

- [x] **Step 4: Run test to verify it passes, commit**

Run: `npx vitest run packages/cli/test/output.test.ts`
Expected: pass.

```bash
git add -A && git commit -m "feat(cli): human-readable verdict formatting"
```

---

### Task 9: `check` command

**Files:**
- Create: `packages/cli/src/commands/check.ts`
- Test: `packages/cli/test/check.test.ts`

- [x] **Step 1: Write the failing tests**

`packages/cli/test/check.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runCheck, type CheckDeps } from "../src/commands/check.js";
import type { AuthorInfo, ChangedFile } from "@interlock-dev/core";

const POLICY = `
version: 1
authors:
  agents:
    accounts: ["my-agent"]
tiers:
  tier0: ["docs/**"]
  tier2: ["interlock.yml"]
`;

function deps(overrides: Partial<CheckDeps> = {}): CheckDeps & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    readPolicy: () => POLICY,
    changedFiles: (): ChangedFile[] => [{ path: "docs/a.md", status: "modified" }],
    authorInfo: (): AuthorInfo => ({ account: "farshad" }),
    log: (s: string) => out.push(s),
    error: (s: string) => err.push(s),
    out,
    err,
    ...overrides,
  };
}

describe("runCheck", () => {
  it("exits 0 and prints a verdict for a clean diff", () => {
    const d = deps();
    expect(runCheck({ base: "main", json: false }, d)).toBe(0);
    expect(d.out.join("\n")).toContain("Tier 0");
  });

  it("exits 1 on a blocking violation", () => {
    const d = deps({
      changedFiles: () => [{ path: "interlock.yml", status: "modified" }],
      authorInfo: () => ({ account: "my-agent" }),
    });
    expect(runCheck({ base: "main", json: false }, d)).toBe(1);
  });

  it("warn-only violations exit 0", () => {
    const d = deps({
      changedFiles: () => [{ path: "interlock.yml", status: "modified" }],
      // human author → human-on-tier2 defaults to warn
    });
    expect(runCheck({ base: "main", json: false }, d)).toBe(0);
  });

  it("exits 2 with a hint when the policy file is missing", () => {
    const d = deps({
      readPolicy: () => {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
    });
    expect(runCheck({ base: "main", json: false }, d)).toBe(2);
    expect(d.err.join("\n")).toContain("agent-interlock init");
  });

  it("exits 2 on an invalid policy", () => {
    const d = deps({ readPolicy: () => "version: 99" });
    expect(runCheck({ base: "main", json: false }, d)).toBe(2);
  });

  it("--json emits machine-readable verdict", () => {
    const d = deps();
    runCheck({ base: "main", json: true }, d);
    const parsed = JSON.parse(d.out.join("\n"));
    expect(parsed.tier).toBe(0);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/cli/test/check.test.ts`
Expected: FAIL — cannot find module.

- [x] **Step 3: Implement**

`packages/cli/src/commands/check.ts`:

```ts
import { readFileSync } from "node:fs";
import {
  classify,
  parsePolicy,
  PolicyError,
  type AuthorInfo,
  type ChangedFile,
} from "@interlock-dev/core";
import { getAuthorInfo, getChangedFiles } from "../git.js";
import { formatVerdict } from "../output.js";

export interface CheckOptions {
  base: string;
  json: boolean;
}

export interface CheckDeps {
  readPolicy: () => string;
  changedFiles: (base: string) => ChangedFile[];
  authorInfo: (base: string) => AuthorInfo;
  log: (s: string) => void;
  error: (s: string) => void;
}

export const defaultCheckDeps: CheckDeps = {
  readPolicy: () => readFileSync("interlock.yml", "utf8"),
  changedFiles: (base) => getChangedFiles(base),
  authorInfo: (base) => getAuthorInfo(base),
  log: console.log,
  error: console.error,
};

export function runCheck(
  opts: CheckOptions,
  deps: CheckDeps = defaultCheckDeps
): number {
  let policyText: string;
  try {
    policyText = deps.readPolicy();
  } catch {
    deps.error(
      "No interlock.yml found. Run: npx agent-interlock init"
    );
    return 2;
  }

  let policy;
  try {
    policy = parsePolicy(policyText);
  } catch (e) {
    if (e instanceof PolicyError) {
      deps.error(e.message);
      return 2;
    }
    throw e;
  }

  const verdict = classify(
    deps.changedFiles(opts.base),
    deps.authorInfo(opts.base),
    policy
  );

  deps.log(opts.json ? JSON.stringify(verdict, null, 2) : formatVerdict(verdict));

  // Local check is advisory: exit 1 for anything stronger than a warning.
  const blocking = verdict.violations.some((v) => v.setting !== "warn");
  return blocking ? 1 : 0;
}
```

- [x] **Step 4: Run tests to verify they pass, commit**

Run: `npx vitest run packages/cli/test/check.test.ts`
Expected: all pass.

```bash
git add -A && git commit -m "feat(cli): check command with advisory exit codes"
```

---

### Task 10: `init` command

**Files:**
- Create: `packages/cli/src/commands/init.ts`
- Test: `packages/cli/test/init.test.ts`

- [x] **Step 1: Write the failing tests**

`packages/cli/test/init.test.ts`:

```ts
import { mkdtempSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPolicyYaml, runInit, WORKFLOW_SNIPPET } from "../src/commands/init.js";
import { parsePolicy } from "@interlock-dev/core";

function tempRepo(dirs: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "interlock-test-"));
  for (const d of dirs) mkdirSync(join(root, d), { recursive: true });
  return root;
}

describe("buildPolicyYaml", () => {
  it("produces a valid policy that includes detected directories", () => {
    const yamlText = buildPolicyYaml({ hasDocs: true, hasTests: true, hasWorkflows: true });
    const policy = parsePolicy(yamlText); // must round-trip through our own parser
    expect(policy.tiers.tier0).toContain("docs/**");
    expect(policy.tiers.tier0).toContain("tests/**");
    expect(policy.tiers.tier2).toContain(".github/**");
    expect(policy.tiers.tier2).toContain("interlock.yml"); // the off-switch rule, always
  });

  it("omits undetected directories but always protects itself", () => {
    const policy = parsePolicy(
      buildPolicyYaml({ hasDocs: false, hasTests: false, hasWorkflows: false })
    );
    expect(policy.tiers.tier0).not.toContain("docs/**");
    expect(policy.tiers.tier2).toContain("interlock.yml");
  });
});

describe("runInit", () => {
  it("writes interlock.yml and prints the workflow snippet", () => {
    const root = tempRepo(["docs", "tests", ".github/workflows"]);
    const out: string[] = [];
    const code = runInit({ cwd: root, force: false }, { log: (s) => out.push(s), error: () => {} });
    expect(code).toBe(0);
    expect(existsSync(join(root, "interlock.yml"))).toBe(true);
    expect(parsePolicy(readFileSync(join(root, "interlock.yml"), "utf8")).version).toBe(1);
    expect(out.join("\n")).toContain("interlock-dev/interlock@v1");
  });

  it("refuses to overwrite without --force", () => {
    const root = tempRepo();
    runInit({ cwd: root, force: false }, { log: () => {}, error: () => {} });
    const err: string[] = [];
    const code = runInit({ cwd: root, force: false }, { log: () => {}, error: (s) => err.push(s) });
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("--force");
  });
});

describe("WORKFLOW_SNIPPET", () => {
  it("requests only the permissions the README promises", () => {
    expect(WORKFLOW_SNIPPET).toContain("contents: read");
    expect(WORKFLOW_SNIPPET).toContain("pull-requests: write");
    expect(WORKFLOW_SNIPPET).toContain("issues: write");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/cli/test/init.test.ts`
Expected: FAIL — cannot find module.

- [x] **Step 3: Implement**

`packages/cli/src/commands/init.ts`:

```ts
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Detected {
  hasDocs: boolean;
  hasTests: boolean;
  hasWorkflows: boolean;
}

export const WORKFLOW_SNIPPET = `# .github/workflows/interlock.yml
name: Interlock
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  pull-requests: write
  issues: write
jobs:
  interlock:
    runs-on: ubuntu-latest
    steps:
      - uses: interlock-dev/interlock@v1
`;

export function buildPolicyYaml(d: Detected): string {
  const tier0: string[] = [];
  if (d.hasDocs) tier0.push("docs/**");
  tier0.push("**/*.md");
  if (d.hasTests) tier0.push("tests/**");

  const tier2: string[] = [];
  if (d.hasWorkflows) tier2.push(".github/**");
  tier2.push("interlock.yml"); // the gate cannot edit its own off-switch

  const list = (items: string[]) =>
    items.map((i) => `    - "${i}"`).join("\n");

  return `# Interlock policy — https://github.com/interlock-dev/interlock
version: 1
mode: observe            # flip to "enforce" once you trust the verdicts

authors:
  agents:
    accounts: ["*[bot]"]
    branches: ["claude/*", "codex/*", "agent/*"]
    trailers: ["Co-Authored-By: Claude*", "Co-Authored-By: *Codex*"]

tiers:
  tier0:                 # behaviour-neutral — candidate for auto-merge when CI is green
${list(tier0)}
  tier2:                 # protected paths — humans only
${list(tier2)}

rules:
  agent-on-tier2: block
  human-on-tier2: warn
`;
}

export interface InitOptions {
  cwd: string;
  force: boolean;
}

export interface InitIo {
  log: (s: string) => void;
  error: (s: string) => void;
}

export function runInit(opts: InitOptions, io: InitIo): number {
  const target = join(opts.cwd, "interlock.yml");
  if (existsSync(target) && !opts.force) {
    io.error("interlock.yml already exists (use --force to overwrite)");
    return 2;
  }
  const detected: Detected = {
    hasDocs: existsSync(join(opts.cwd, "docs")),
    hasTests:
      existsSync(join(opts.cwd, "tests")) ||
      existsSync(join(opts.cwd, "test")) ||
      existsSync(join(opts.cwd, "__tests__")),
    hasWorkflows: existsSync(join(opts.cwd, ".github", "workflows")),
  };
  writeFileSync(target, buildPolicyYaml(detected));
  io.log(`Wrote interlock.yml (mode: observe).`);
  io.log("");
  io.log("Add this workflow to finish the install:");
  io.log("");
  io.log(WORKFLOW_SNIPPET);
  io.log("Then open any PR — Interlock will post its first verdict.");
  return 0;
}
```

- [x] **Step 4: Run tests to verify they pass, commit**

Run: `npx vitest run packages/cli/test/init.test.ts`
Expected: all pass.

```bash
git add -A && git commit -m "feat(cli): init scaffolds policy from detected layout"
```

---

### Task 11: `explain` command + bin wiring

**Files:**
- Create: `packages/cli/src/commands/explain.ts`, `packages/cli/src/index.ts`
- Test: `packages/cli/test/explain.test.ts`

- [x] **Step 1: Write the failing tests**

`packages/cli/test/explain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runExplain } from "../src/commands/explain.js";

const POLICY = `
version: 1
tiers:
  tier0: ["docs/**"]
  tier2: [".github/**"]
`;

describe("runExplain", () => {
  it("explains a protected path", () => {
    const out: string[] = [];
    const code = runExplain(
      ".github/workflows/ci.yml",
      { readPolicy: () => POLICY, log: (s) => out.push(s), error: () => {} }
    );
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Tier 2");
    expect(out.join("\n")).toContain(".github/**");
  });

  it("explains the default tier", () => {
    const out: string[] = [];
    runExplain("src/x.ts", { readPolicy: () => POLICY, log: (s) => out.push(s), error: () => {} });
    expect(out.join("\n")).toContain("Tier 1");
    expect(out.join("\n")).toContain("default");
  });

  it("exits 2 on invalid policy", () => {
    const err: string[] = [];
    const code = runExplain("x", { readPolicy: () => "nope: 1", log: () => {}, error: (s) => err.push(s) });
    expect(code).toBe(2);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/cli/test/explain.test.ts`
Expected: FAIL — cannot find module.

- [x] **Step 3: Implement explain**

`packages/cli/src/commands/explain.ts`:

```ts
import { readFileSync } from "node:fs";
import { parsePolicy, PolicyError, tierForPath } from "@interlock-dev/core";

export interface ExplainDeps {
  readPolicy: () => string;
  log: (s: string) => void;
  error: (s: string) => void;
}

export const defaultExplainDeps: ExplainDeps = {
  readPolicy: () => readFileSync("interlock.yml", "utf8"),
  log: console.log,
  error: console.error,
};

export function runExplain(
  path: string,
  deps: ExplainDeps = defaultExplainDeps
): number {
  let policy;
  try {
    policy = parsePolicy(deps.readPolicy());
  } catch (e) {
    if (e instanceof PolicyError) {
      deps.error(e.message);
      return 2;
    }
    throw e;
  }
  const { tier, matchedRule } = tierForPath(path, policy);
  deps.log(`${path} → Tier ${tier} (rule: ${matchedRule})`);
  return 0;
}
```

- [x] **Step 4: Wire the bin entry**

`packages/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { runCheck } from "./commands/check.js";
import { runInit } from "./commands/init.js";
import { runExplain } from "./commands/explain.js";

const program = new Command();

program
  .name("agent-interlock")
  .description(
    "Tool-neutral governance gate for AI-agent pull requests."
  )
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold interlock.yml and print the workflow to paste")
  .option("--force", "overwrite an existing interlock.yml", false)
  .action((opts: { force: boolean }) => {
    process.exitCode = runInit(
      { cwd: process.cwd(), force: opts.force },
      { log: console.log, error: console.error }
    );
  });

program
  .command("check")
  .description("Classify the current branch's diff against the policy")
  .option("--base <ref>", "base ref to diff against", "main")
  .option("--json", "machine-readable output", false)
  .action((opts: { base: string; json: boolean }) => {
    process.exitCode = runCheck({ base: opts.base, json: opts.json });
  });

program
  .command("explain")
  .description("Show which rule catches a path and the tier it lands in")
  .argument("<path>", "repo-relative path to explain")
  .action((path: string) => {
    process.exitCode = runExplain(path);
  });

program.parse();
```

- [x] **Step 5: Run all tests, build, smoke-test the bin, commit**

Run: `npx vitest run && npx tsc -b packages/cli`
Expected: green.

Run: `node packages/cli/dist/index.js explain .github/workflows/x.yml || true` (from repo root — no interlock.yml yet, so expect the invalid/missing-policy error path, exit 2)
Expected: readable error, no stack trace.

```bash
git add -A && git commit -m "feat(cli): explain command and commander bin wiring"
```

---

### Task 12: Action helpers (pure)

**Files:**
- Create: `action/package.json`, `action/tsconfig.json`, `action/src/helpers.ts`
- Test: `action/test/helpers.test.ts`

- [x] **Step 1: Package skeleton**

`action/package.json`:

```json
{
  "name": "@interlock-dev/action",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "esbuild src/main.ts --bundle --platform=node --target=node20 --format=cjs --outfile=dist/index.js"
  },
  "dependencies": {
    "@actions/core": "^1.11.0",
    "@actions/github": "^6.0.0",
    "@interlock-dev/core": "0.1.0"
  },
  "devDependencies": { "esbuild": "^0.24.0" }
}
```

`action/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "build", "noEmit": true, "composite": false },
  "include": ["src"]
}
```

Run: `npm install`

- [x] **Step 2: Write the failing tests**

`action/test/helpers.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  buildComment,
  extractTrailers,
  mapFiles,
  MARKER,
  withRetry,
} from "../src/helpers.js";
import type { Verdict } from "@interlock-dev/core";

describe("mapFiles", () => {
  it("maps GitHub API file entries to ChangedFile", () => {
    expect(
      mapFiles([
        { filename: "docs/a.md", status: "modified" },
        { filename: "b.ts", status: "added" },
        { filename: "c.ts", status: "removed" },
        { filename: "new.ts", status: "renamed", previous_filename: "old.ts" },
      ])
    ).toEqual([
      { path: "docs/a.md", status: "modified" },
      { path: "b.ts", status: "added" },
      { path: "c.ts", status: "removed" },
      { path: "new.ts", previousPath: "old.ts", status: "renamed" },
    ]);
  });

  it("maps unknown statuses to modified", () => {
    expect(mapFiles([{ filename: "x", status: "changed" }])[0]?.status).toBe(
      "modified"
    );
  });
});

describe("extractTrailers", () => {
  it("pulls trailer-shaped lines from commit messages", () => {
    const trailers = extractTrailers([
      "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
      "fix: y",
    ]);
    expect(trailers).toEqual([
      "Co-Authored-By: Claude <noreply@anthropic.com>",
    ]);
  });
});

describe("buildComment", () => {
  const verdict: Verdict = {
    tier: 2,
    authorClass: "agent",
    mode: "enforce",
    perFile: [{ path: "interlock.yml", tier: 2, matchedRule: "interlock.yml" }],
    violations: [
      { kind: "agent-on-tier2", setting: "block", paths: ["interlock.yml"] },
    ],
    requirements: ["BLOCKED — agent-on-tier2: interlock.yml"],
  };

  it("contains the marker, a table, and the gating outcome", () => {
    const md = buildComment(verdict, {
      shouldFail: true,
      reasons: ["agent-on-tier2: blocked (interlock.yml)"],
    });
    expect(md).toContain(MARKER);
    expect(md).toContain("| `interlock.yml` | 2 |");
    expect(md).toContain("❌");
  });
});

describe("withRetry", () => {
  it("retries once then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("flake"))
      .mockResolvedValueOnce("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after two attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("down"));
    await expect(withRetry(fn)).rejects.toThrow("down");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

- [x] **Step 3: Run tests to verify they fail**

Run: `npx vitest run action/test/helpers.test.ts`
Expected: FAIL — cannot find module.

- [x] **Step 4: Implement**

`action/src/helpers.ts`:

```ts
import type { ChangedFile, Verdict } from "@interlock-dev/core";
import type { GatingResult } from "@interlock-dev/core";

export const MARKER = "<!-- interlock-verdict -->";

export interface ApiFile {
  filename: string;
  status: string;
  previous_filename?: string;
}

export function mapFiles(apiFiles: ApiFile[]): ChangedFile[] {
  return apiFiles.map((f) => {
    if (f.status === "renamed" && f.previous_filename) {
      return {
        path: f.filename,
        previousPath: f.previous_filename,
        status: "renamed" as const,
      };
    }
    const status =
      f.status === "added" || f.status === "removed"
        ? (f.status as "added" | "removed")
        : ("modified" as const);
    return { path: f.filename, status };
  });
}

const TRAILER_RE = /^[A-Za-z][A-Za-z-]*:\s.+/;

export function extractTrailers(commitMessages: string[]): string[] {
  const trailers: string[] = [];
  for (const message of commitMessages) {
    for (const raw of message.split("\n")) {
      const line = raw.trim();
      if (TRAILER_RE.test(line)) trailers.push(line);
    }
  }
  return trailers;
}

export function buildComment(verdict: Verdict, gating: GatingResult): string {
  const icon = gating.shouldFail ? "❌" : verdict.tier === 2 ? "⚠️" : "✅";
  const lines: string[] = [];
  lines.push(MARKER);
  lines.push(
    `### ${icon} Interlock — Tier ${verdict.tier} (${verdict.authorClass} author, mode: ${verdict.mode})`
  );
  lines.push("");
  lines.push("| Path | Tier | Rule |");
  lines.push("| --- | --- | --- |");
  for (const f of verdict.perFile) {
    lines.push(`| \`${f.path}\` | ${f.tier} | \`${f.matchedRule}\` |`);
  }
  lines.push("");
  for (const r of verdict.requirements) lines.push(`- ${r}`);
  if (gating.shouldFail) {
    lines.push("");
    lines.push(`**Check failed:** ${gating.reasons.join("; ")}`);
  }
  return lines.join("\n");
}

/** Two attempts, brief pause — in enforce mode there is no silent pass. */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
    return await fn();
  }
}
```

- [x] **Step 5: Run tests to verify they pass, commit**

Run: `npx vitest run action/test/helpers.test.ts`
Expected: all pass.

```bash
git add -A && git commit -m "feat(action): pure helpers — file mapping, trailers, comment, retry"
```

---

### Task 13: Action orchestration + bundle

**Files:**
- Create: `action/src/main.ts`, `action/action.yml`
- Modify: `action/package.json` (already has build script)

- [x] **Step 1: action.yml**

`action/action.yml`:

```yaml
name: "Interlock"
description: "Tool-neutral governance gate for AI-agent PRs: protected paths + reversibility-tiered merge rules from one interlock.yml."
author: "interlock-dev"
branding:
  icon: "shield"
  color: "gray-dark"
inputs:
  github-token:
    description: "Token used to read files and post the verdict (defaults to the workflow token)."
    default: "${{ github.token }}"
  policy-path:
    description: "Path to the policy file, read from the PR base branch."
    default: "interlock.yml"
runs:
  using: "node20"
  main: "dist/index.js"
```

Note: `action.yml` lives in `action/`, but the published action is referenced as `interlock-dev/interlock@v1` — at launch (checklist below) a root-level `action.yml` symlink-equivalent is created by copying `action/action.yml` to the repo root with `main: "action/dist/index.js"`. Add that file at launch, not now.

- [x] **Step 2: Implement main.ts**

`action/src/main.ts`:

```ts
import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  classify,
  classifyAuthor,
  gate,
  parsePolicy,
  PolicyError,
  type Policy,
} from "@interlock-dev/core";
import {
  buildComment,
  extractTrailers,
  mapFiles,
  MARKER,
  withRetry,
} from "./helpers.js";

type Octokit = ReturnType<typeof github.getOctokit>;

async function fetchPolicyText(
  octokit: Octokit,
  policyPath: string,
  baseRef: string
): Promise<string | null> {
  try {
    const res = await withRetry(() =>
      octokit.rest.repos.getContent({
        ...github.context.repo,
        path: policyPath,
        ref: baseRef,
      })
    );
    const data = res.data as { content?: string; encoding?: string };
    if (!data.content) return null;
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

async function countHumanApprovals(
  octokit: Octokit,
  prNumber: number,
  policy: Policy
): Promise<number> {
  const reviews = await withRetry(() =>
    octokit.paginate(octokit.rest.pulls.listReviews, {
      ...github.context.repo,
      pull_number: prNumber,
    })
  );
  const approvers = new Set(
    reviews
      .filter((r) => r.state === "APPROVED" && r.user)
      .filter(
        (r) => classifyAuthor({ account: r.user!.login }, policy) === "human"
      )
      .map((r) => r.user!.login)
  );
  return approvers.size;
}

async function upsertComment(
  octokit: Octokit,
  prNumber: number,
  body: string
): Promise<void> {
  const comments = await withRetry(() =>
    octokit.paginate(octokit.rest.issues.listComments, {
      ...github.context.repo,
      issue_number: prNumber,
    })
  );
  const existing = comments.find((c) => c.body?.includes(MARKER));
  if (existing) {
    await withRetry(() =>
      octokit.rest.issues.updateComment({
        ...github.context.repo,
        comment_id: existing.id,
        body,
      })
    );
  } else {
    await withRetry(() =>
      octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: prNumber,
        body,
      })
    );
  }
}

async function setTierLabel(
  octokit: Octokit,
  prNumber: number,
  tier: number
): Promise<void> {
  const wanted = `interlock:tier-${tier}`;
  const labels = await withRetry(() =>
    octokit.rest.issues.listLabelsOnIssue({
      ...github.context.repo,
      issue_number: prNumber,
    })
  );
  for (const l of labels.data) {
    if (l.name.startsWith("interlock:tier-") && l.name !== wanted) {
      await withRetry(() =>
        octokit.rest.issues.removeLabel({
          ...github.context.repo,
          issue_number: prNumber,
          name: l.name,
        })
      );
    }
  }
  if (!labels.data.some((l) => l.name === wanted)) {
    await withRetry(() =>
      octokit.rest.issues.addLabels({
        ...github.context.repo,
        issue_number: prNumber,
        labels: [wanted],
      })
    );
  }
}

async function run(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const policyPath = core.getInput("policy-path") || "interlock.yml";
  const octokit = github.getOctokit(token);
  const pr = github.context.payload.pull_request;
  if (!pr) {
    core.setFailed("Interlock only runs on pull_request events.");
    return;
  }
  const prNumber = pr.number;

  // The policy is read from the BASE ref: a PR cannot weaken the law that judges it.
  const policyText = await fetchPolicyText(
    octokit,
    policyPath,
    pr.base.ref as string
  );
  if (policyText === null) {
    core.info(
      `No ${policyPath} on ${pr.base.ref}. Run \`npx agent-interlock init\` to adopt Interlock.`
    );
    await core.summary
      .addRaw(
        `Interlock: no \`${policyPath}\` found on \`${pr.base.ref}\` — nothing to enforce. Run \`npx agent-interlock init\`.`
      )
      .write();
    return; // neutral: missing policy is a hint, not a failure
  }

  let policy: Policy;
  try {
    policy = parsePolicy(policyText);
  } catch (e) {
    if (e instanceof PolicyError) {
      core.setFailed(e.message); // invalid policy fails LOUD, never fail-open
      return;
    }
    throw e;
  }

  const apiFiles = await withRetry(() =>
    octokit.paginate(octokit.rest.pulls.listFiles, {
      ...github.context.repo,
      pull_number: prNumber,
      per_page: 100,
    })
  );
  const commits = await withRetry(() =>
    octokit.paginate(octokit.rest.pulls.listCommits, {
      ...github.context.repo,
      pull_number: prNumber,
      per_page: 100,
    })
  );

  const author = {
    account: (pr.user?.login as string) ?? "unknown",
    branch: pr.head?.ref as string | undefined,
    trailers: extractTrailers(commits.map((c) => c.commit.message)),
  };

  const verdict = classify(mapFiles(apiFiles), author, policy);
  const needsApprovals = verdict.violations.some(
    (v) => v.setting === "require-review"
  );
  const humanApprovalCount = needsApprovals
    ? await countHumanApprovals(octokit, prNumber, policy)
    : 0;
  const gating = gate(verdict, { humanApprovalCount });

  const comment = buildComment(verdict, gating);
  await upsertComment(octokit, prNumber, comment);
  await setTierLabel(octokit, prNumber, verdict.tier);
  await core.summary.addRaw(comment.replace(MARKER, "")).write();

  if (gating.shouldFail) {
    core.setFailed(gating.reasons.join("; "));
  } else {
    core.info(
      `Interlock: Tier ${verdict.tier} (${verdict.authorClass}), mode ${verdict.mode} — OK.`
    );
  }
}

run().catch((e: Error) => core.setFailed(`Interlock error: ${e.message}`));
```

- [x] **Step 3: Typecheck, bundle, verify the bundle is self-contained**

Run: `npx tsc -p action && npm run build -w action`
Expected: `action/dist/index.js` exists.

Run: `node -e "const m=require('./action/dist/index.js')" 2>&1 | head -3`
Expected: it executes and logs an Interlock failure about missing input/event (proves the bundle loads standalone without node_modules) — any output containing "Interlock" is success; module-not-found errors are failure.

- [x] **Step 4: Run the full suite and commit (including dist)**

Run: `npx vitest run && npx tsc -b packages/core packages/cli && npx tsc -p action`
Expected: green.

```bash
git add -A && git commit -m "feat(action): verdict check, sticky comment, tier label, bundled dist"
```

---

> **Milestone note (adapters complete):** Opus review of 5cfdffb..HEAD → fixes in 4c768a2: (C1) oversize-policy fail-open closed via decodeContentResponse throwing loud; (I1) CLI git errors → exit 2 with hint; (I3) stale approvals revoked via latestApprovers fold; (M3) verdict survives cosmetic-write failures; (M2) copied→modified comment. Suite: 75 tests. Doc duties pushed to T15: README must document author-detection divergence (CLI = git author name, Action = GitHub login) and exit-code contract "1 = blocking violation (stronger than warn)"; spec permissions wording (issues:write, not checks:write) ALREADY correct in workflow snippet — amend spec §Action accordingly.

### Task 14: Dogfood — Interlock governs its own repo

**Files:**
- Create: `interlock.yml` (repo root), `.github/workflows/interlock.yml`

- [x] **Step 1: Generate our own policy with our own tool**

Run: `node packages/cli/dist/index.js init`
Expected: `interlock.yml` written; snippet printed.

Then edit the generated `interlock.yml` tier2 list to also protect the engine's law-critical files (append to the generated tier2 list):

```yaml
    - "packages/core/src/policy.ts"
    - "packages/core/src/gating.ts"
    - "action/dist/**"
```

- [x] **Step 2: Add the workflow**

Write `.github/workflows/interlock.yml` with exactly the printed snippet, except the action reference uses the local path until the org repo exists:

```yaml
name: Interlock
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  pull-requests: write
  issues: write
jobs:
  interlock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./action
```

(`uses: ./action` requires checkout; the published `interlock-dev/interlock@v1` form does not. Swap at launch.)

- [x] **Step 3: Sanity-check our own verdict locally, commit**

Run: `node packages/cli/dist/index.js explain interlock.yml`
Expected: `interlock.yml → Tier 2 (rule: interlock.yml)`.

Run: `node packages/cli/dist/index.js explain docs/superpowers/specs/2026-06-12-interlock-v0.1-design.md`
Expected: Tier 0.

```bash
git add -A && git commit -m "chore: dogfood — interlock governs its own repository"
```

---

### Task 15: README — the 10-minute path

**Files:**
- Create: `README.md`, `LICENSE`

- [x] **Step 1: Write README.md**

Structure (write actual prose, not placeholders):

1. One-line pitch: *Deterministic governance gate for AI-agent pull requests. One policy file; protected paths + reversibility-tiered merge rules, enforced in CI whatever tool wrote the code.*
2. **Why** (3 sentences): agents are fast and occasionally catastrophic; reviewing everything kills the speed, trusting everything kills the repo. Interlock is the dial between those settings — and it's a fuse, not another AI: deterministic globs and rules, same verdict every time.
3. **The 10 minutes** — exactly four steps with the commands from `init` (copy the real snippet, including `mode: observe` default and the note about flipping to `enforce` + making the check required).
4. **Policy reference** — the full annotated `interlock.yml` from `buildPolicyYaml` with every key explained in a table.
5. **Semantics** — tier = max across files; renames count both paths; policy read from base ref; rule × mode matrix (observe/enforce × block/warn/require-review).
6. **CLI** — `init` / `check --base --json` / `explain` with exit codes (0/1/2).
7. **Roadmap** — v0.2 Claude Code hook (same policy file, enforced at the harness), v0.3 opt-in tier-0 auto-merge. Link to the spec.
8. Apache-2.0 badge/footer.

`LICENSE`: the standard Apache-2.0 text, copyright 2026 Farshad Pasbani.

- [x] **Step 2: Final full gate**

Run: `npx vitest run && npx tsc -b packages/core packages/cli && npx tsc -p action && npm run build -w action`
Expected: everything green, bundle reproducible (git diff on `action/dist` is empty or committed).

- [x] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: README with the 10-minute adoption path; Apache-2.0 LICENSE"
```

---

## Launch checklist (after the plan, needs the network — not TDD tasks)

These are deliberately outside the TDD task list; they need the GitHub org and human judgement:

1. Create GitHub org `interlock-dev`, repo `interlock`; push `main`.
2. Copy `action/action.yml` to repo root with `main: "action/dist/index.js"` so `uses: interlock-dev/interlock@v1` resolves; tag `v1` (moving major tag) + `v0.1.0`.
3. Run `/constitution-init` on the repo (solo adaptation, shadow mode) — the governed fleet builds the governor.
4. Swap the dogfood workflow to `uses: interlock-dev/interlock@v1` (drop checkout).
5. Sandbox E2E: open a docs-only PR (expect Tier 0 ✅), an agent-branch PR touching `.github/**` (expect blocked in enforce / verdict in observe), confirm sticky comment updates on push.
6. npm publish `agent-interlock` (decide scope at publish; spec leaves it open).
7. GitHub Marketplace listing ("Interlock" title availability checked here).
8. Launch content: the "governed fleet built this governor" post; constitution published alongside per spec.

---

## Self-review notes (already applied)

- **Spec coverage:** policy schema ✓ (T3), author classes ✓ (T4), classify semantics incl. renames/max-tier ✓ (T5), gating observe/enforce × block/warn/require-review ✓ (T6), CLI init/check/explain + exit codes ✓ (T9–T11), Action check/comment/label + base-ref policy + neutral-missing/loud-invalid + bounded retry ✓ (T12–T13), dogfood ✓ (T14), README/10-min path ✓ (T15), E2E + marketplace + constitution-init → launch checklist (network-dependent by nature).
- **Known simplification vs spec:** "interactive" init is detection-based with `--force` (no prompt library) — v0.1 reading of the spec, noted in spec's open questions territory.
- **Type consistency:** `Verdict`/`Violation`/`RuleSetting` defined once in T2 and imported everywhere; `gate` consumes `Verdict.mode` (no separate mode argument); `classifyAuthor` reused by the Action for human-approval counting.
