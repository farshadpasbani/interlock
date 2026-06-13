# `init --with-constitution` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `agent-interlock init --with-constitution`, a deterministic (no-LLM, no-network) scaffold that lays down the full single-owner agent constitution alongside `interlock.yml`, with the protected-path list rendered from one source so `interlock.yml` and the loop-policy can't drift.

**Architecture:** Constitution template is vendored (solo form, `{{PLACEHOLDERS}}` intact) under `packages/cli/templates/constitution/`, embedded into the esbuild bundle at build time via a generated module so the published CLI stays a single self-contained file. Pure functions detect the repo/stack and fill placeholders; a thin command writes files + prints a setup checklist.

**Tech Stack:** TypeScript (NodeNext ESM), Node 20+, vitest, esbuild, commander. Reuses `interlock-core` and the existing `git.ts` `Exec` type.

**Spec:** `docs/superpowers/specs/2026-06-13-with-constitution-design.md`

---

## File structure

```
packages/cli/
  templates/constitution/                 # Task 1 — vendored, solo-form, placeholders intact
    CONSTITUTION.md  loop-policy.md  master-loop.md  field-guide.md  SETUP.md
    triage-labels.md  domain.md  AGENTS.md  CONTEXT.md  CODEOWNERS
    pull_request_template.md  adr-0001-adopt-agent-governance.md
    adapters/claude-SKILL.md  adapters/cursor-master-loop.mdc
  scripts/embed-templates.mjs             # Task 2 — templates/ → src/templates.generated.ts
  src/
    templates.generated.ts                # generated (gitignored); Record<relpath,string>
    constitution/
      detect.ts                           # Task 3,4 — parseRemote, detectRepo, detectStack
      render.ts                           # Task 5,6 — germlinePaths, buildValues, fillPlaceholders, OUTPUT_MAP, buildCi
    commands/
      constitution.ts                     # Task 7 — scaffoldConstitution (fs + checklist)
      init.ts                             # Task 8 — extend for --with-constitution
    index.ts                              # Task 8 — wire the flag
  package.json                            # Task 2 — build runs embed; prepublishOnly
  test/
    constitution-detect.test.ts           # Task 3,4
    constitution-render.test.ts           # Task 5,6
    constitution-scaffold.test.ts         # Task 7,9
```

The germline path list (used by both `interlock.yml` tier2 and the loop-policy domain globs) is the static set for any scaffolded repo:

```
docs/agents/**, .github/workflows/**, .github/CODEOWNERS, interlock.yml
```

---

### Task 1: Vendor the constitution template (solo form, placeholders intact)

**Files:**
- Create: `packages/cli/templates/constitution/**` (14 files, copied + adapted)

This is a content task, not logic. The source is the canonical template on this machine at
`~/.claude/constitution/`. The repo's own `docs/agents/` files are the **solo-adapted reference**
(same wording we want, but with values filled in — use them only to copy the *solo clause
wording*, never their filled-in values or interlock-specific paths).

- [x] **Step 1: Copy the 14 template files verbatim**

```bash
cd /Users/farshad/projects/interlock
mkdir -p packages/cli/templates/constitution/adapters
for f in CONSTITUTION.md loop-policy.md master-loop.md field-guide.md SETUP.md \
         triage-labels.md domain.md AGENTS.md CONTEXT.md CODEOWNERS \
         pull_request_template.md adr-0001-adopt-agent-governance.md; do
  cp ~/.claude/constitution/$f packages/cli/templates/constitution/$f
done
cp ~/.claude/constitution/adapters/claude-SKILL.md packages/cli/templates/constitution/adapters/
cp ~/.claude/constitution/adapters/cursor-master-loop.mdc packages/cli/templates/constitution/adapters/
```

Do NOT copy `pacemaker/`, `.git/`, `README.md`, `cursor-user-rules.md`, or `ci-templates/`
(CI is generated, not templated).

- [x] **Step 2: Apply the solo adaptation to CONSTITUTION.md**

In `packages/cli/templates/constitution/CONSTITUTION.md`, the canonical Tier-1 clause
(Article III) is team-default. Replace it with the solo wording. Find:

```
- **Tier 1 — reflexive, witnessed *and* counter-signed.** Ordinary feature/fix PRs. Merge on
  **green CI + both review agents clean + one human CODEOWNERS approval.** This is the team
  adaptation: until the fleet has earned trust, a human still counter-signs every behavioural
  change. Loosen the human gate later by amendment (Article X), once the metrics earn it.
```

Replace with:

```
- **Tier 1 — reflexive, witnessed by both review agents.** Ordinary feature/fix PRs. Merge on
  **green CI + both review agents clean.** The human counter-signature was waived by the solo
  sovereign at genesis; it can be reinstated by amendment (Article X) at any time.
```

- [x] **Step 3: Apply the solo adaptation to loop-policy.md (Tier-1 + the germline-globs placeholder)**

(a) The Tier-1 heading/body in `loop-policy.md` §2 is team-default. Find the canonical Tier-1
section header line:

```
### Tier 1 — reflexive, witnessed, counter-signed · merge on green CI + both review agents clean + **one CODEOWNERS human approval**
```

Replace with:

```
### Tier 1 — reflexive, witnessed by both review agents · merge on green CI + both review agents clean
```

and ensure the body paragraph reads (replace the canonical team paragraph that follows it):

```
Anything not Tier 0 and touching no protected path. The human counter-signature was waived by
the solo sovereign at genesis (Article III); it can be reinstated by amendment (Article X).
```

(b) Replace the canonical "Domain path globs — KEEP THIS LIST CURRENT" list body with a single
placeholder so the list is rendered from one source. Find the domain-globs list (the bulleted
paths under the "Domain path globs" heading) and replace just the bullet list with:

```
{{GERMLINE_GLOBS}}
```

Leave the "Germline path globs (present from day one)" list above it as-is (those are the
controller's own files: CONSTITUTION.md, loop-policy.md, master-loop.md, adapters, workflows,
CODEOWNERS).

- [x] **Step 4: Apply the solo adaptation to master-loop.md and field-guide.md**

In both files, the Tier-1 merge rule appears in a table row / tier list. Make the Tier-1
condition read "green CI + both review agents clean" with no human-approval requirement
(the canonical says "+ one CODEOWNERS approval" or "counter-signed"). Concretely:

- `master-loop.md`: in the merge-rule table, the Tier 1 row's "Merge condition" cell should read
  `green CI **+ both review agents clean** (human gate waived at genesis — see Constitution Art. III)`.
- `field-guide.md`: in the tier table, the Tier 1 row should say merge on `green CI + both review
  agents clean` (drop any "+ human approval").

Use the repo's `docs/agents/master-loop.md` and `docs/agents/README.md` as the reference for the
exact solo phrasing — copy the *wording* of the Tier-1 cells, not their filled values.

- [x] **Step 5: Verify placeholders intact and team wording gone**

```bash
cd /Users/farshad/projects/interlock
grep -rl 'counter-sign' packages/cli/templates/constitution/ || echo "no counter-sign clauses (good)"
grep -roE '\{\{[A-Z_]+\}\}' packages/cli/templates/constitution/ | sort -u
grep -rn 'GERMLINE_GLOBS' packages/cli/templates/constitution/loop-policy.md
```

Expected: no `counter-sign` matches; the placeholder set lists `{{OWNER}} {{REPO}}
{{OWNER_HANDLE}} {{GIT_ACCOUNT}} {{TEAM_AND_DOMAIN}} {{PROJECT_DESCRIPTION}}
{{END_USERS_AND_STAKES}} {{INSTALL_CMD}} {{TEST_CMD}} {{LINT_CMD}} {{TYPECHECK_CMD}}
{{FORMAT_CMD}} {{RUN_CMD}} {{CI_CHECK_NAME}} {{GERMLINE_GLOBS}}`; the GERMLINE_GLOBS line is
present in loop-policy.md.

- [x] **Step 6: Commit**

```bash
git add packages/cli/templates/constitution
git commit -m "chore(cli): vendor solo-form constitution template (placeholders intact)"
```

---

### Task 2: Embed script + generated module + build wiring

**Files:**
- Create: `packages/cli/scripts/embed-templates.mjs`
- Modify: `packages/cli/package.json` (build + prepublishOnly + clean)
- Modify: `.gitignore` (ignore the generated module)
- Test: `packages/cli/test/constitution-embed.test.ts`

- [x] **Step 1: Write the embed script**

`packages/cli/scripts/embed-templates.mjs`:

```js
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const templatesDir = join(root, "templates", "constitution");
const outFile = join(root, "src", "templates.generated.ts");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(templatesDir).sort();
const entries = files.map((f) => {
  const rel = relative(templatesDir, f).split("\\").join("/");
  const content = readFileSync(f, "utf8");
  return `  ${JSON.stringify(rel)}: ${JSON.stringify(content)},`;
});

const banner = "// GENERATED by scripts/embed-templates.mjs — do not edit by hand.\n";
writeFileSync(
  outFile,
  banner +
    "export const CONSTITUTION_TEMPLATES: Record<string, string> = {\n" +
    entries.join("\n") +
    "\n};\n"
);
console.log(`embedded ${files.length} template files → src/templates.generated.ts`);
```

- [x] **Step 2: Generate it and verify**

Run: `node packages/cli/scripts/embed-templates.mjs`
Expected: `embedded 14 template files → src/templates.generated.ts`, and the file exists.

- [x] **Step 3: Wire build + ignore the generated file**

In `packages/cli/package.json`, change `build` and add `prepublishOnly` so the embed runs first:

```json
"scripts": {
  "build": "node scripts/embed-templates.mjs && esbuild src/index.ts --bundle --platform=node --target=node20 --format=cjs --outfile=dist/index.js",
  "prepublishOnly": "npm run build"
}
```

In root `.gitignore`, add a line:

```
packages/cli/src/templates.generated.ts
```

- [x] **Step 4: Write the test (the generated module is loadable and complete)**

`packages/cli/test/constitution-embed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CONSTITUTION_TEMPLATES } from "../src/templates.generated.js";

describe("embedded templates", () => {
  it("contains the core constitution files, non-empty", () => {
    for (const key of [
      "CONSTITUTION.md",
      "loop-policy.md",
      "master-loop.md",
      "CODEOWNERS",
      "adapters/claude-SKILL.md",
    ]) {
      expect(CONSTITUTION_TEMPLATES[key], key).toBeTruthy();
      expect(CONSTITUTION_TEMPLATES[key].length).toBeGreaterThan(10);
    }
  });

  it("preserves placeholders for runtime filling", () => {
    expect(CONSTITUTION_TEMPLATES["loop-policy.md"]).toContain("{{GERMLINE_GLOBS}}");
    expect(CONSTITUTION_TEMPLATES["CODEOWNERS"]).toContain("{{OWNER_HANDLE}}");
  });
});
```

- [x] **Step 5: Run + commit**

Run: `npx vitest run packages/cli/test/constitution-embed.test.ts`
Expected: 2 pass.

```bash
git add packages/cli/scripts packages/cli/package.json .gitignore packages/cli/test/constitution-embed.test.ts
git commit -m "build(cli): embed constitution templates into the bundle at build time"
```

(Note: `src/templates.generated.ts` is gitignored — do not commit it; it regenerates on build.)

---

### Task 3: `parseRemote` + `detectRepo`

**Files:**
- Create: `packages/cli/src/constitution/detect.ts`
- Test: `packages/cli/test/constitution-detect.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/cli/test/constitution-detect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectRepo, parseRemote } from "../src/constitution/detect.js";

describe("parseRemote", () => {
  it("parses https remotes", () => {
    expect(parseRemote("https://github.com/me/proj.git")).toEqual({ owner: "me", repo: "proj" });
    expect(parseRemote("https://github.com/me/proj")).toEqual({ owner: "me", repo: "proj" });
  });
  it("parses ssh remotes", () => {
    expect(parseRemote("git@github.com:me/proj.git")).toEqual({ owner: "me", repo: "proj" });
  });
  it("returns null on junk", () => {
    expect(parseRemote("")).toBeNull();
    expect(parseRemote("not a url")).toBeNull();
  });
});

describe("detectRepo", () => {
  it("derives owner/repo/handle/account from git", () => {
    const exec = (_c: string, args: string[]): string => {
      if (args[0] === "remote") return "git@github.com:me/proj.git\n";
      if (args[0] === "config") return "me@example.com\n";
      return "";
    };
    expect(detectRepo("/x", exec)).toEqual({
      owner: "me", repo: "proj", handle: "me", account: "me@example.com", detected: true,
    });
  });
  it("flags undetected when there is no remote", () => {
    const exec = (_c: string, args: string[]): string => {
      if (args[0] === "remote") throw new Error("no remote");
      return "";
    };
    const r = detectRepo("/x", exec);
    expect(r.detected).toBe(false);
    expect(r.owner).toBe("OWNER");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run packages/cli/test/constitution-detect.test.ts`
Expected: FAIL — cannot find module `../src/constitution/detect.js`.

- [ ] **Step 3: Implement (part 1)**

`packages/cli/src/constitution/detect.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exec } from "../git.js";

export interface RepoInfo {
  owner: string;
  repo: string;
  handle: string;
  account: string;
  detected: boolean;
}

export function parseRemote(url: string): { owner: string; repo: string } | null {
  const m =
    url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/) ?? null;
  if (!m || !m[1] || !m[2]) return null;
  return { owner: m[1], repo: m[2] };
}

export function detectRepo(cwd: string, exec: Exec): RepoInfo {
  let parsed: { owner: string; repo: string } | null = null;
  try {
    parsed = parseRemote(exec("git", ["remote", "get-url", "origin"]).trim());
  } catch {
    parsed = null;
  }
  let account = "";
  try {
    account = exec("git", ["config", "user.email"]).trim();
  } catch {
    account = "";
  }
  if (!parsed) {
    return { owner: "OWNER", repo: "REPO", handle: "OWNER", account: account || "OWNER", detected: false };
  }
  return {
    owner: parsed.owner,
    repo: parsed.repo,
    handle: parsed.owner,
    account: account || parsed.owner,
    detected: true,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run packages/cli/test/constitution-detect.test.ts`
Expected: parseRemote + detectRepo tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/constitution/detect.ts packages/cli/test/constitution-detect.test.ts
git commit -m "feat(cli): detectRepo + parseRemote for constitution scaffold"
```

---

### Task 4: `detectStack`

**Files:**
- Modify: `packages/cli/src/constitution/detect.ts` (append)
- Test: `packages/cli/test/constitution-detect.test.ts` (append)

- [ ] **Step 1: Append failing tests**

```ts
import { detectStack } from "../src/constitution/detect.js";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

function tmp(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), "stack-"));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}

describe("detectStack", () => {
  it("maps npm scripts when package.json present", () => {
    const d = tmp({ "package.json": JSON.stringify({ scripts: { test: "vitest", typecheck: "tsc --noEmit" } }) });
    const s = detectStack(d);
    expect(s.install).toBe("npm install");
    expect(s.test).toBe("npm test");
    expect(s.typecheck).toBe("npm run typecheck");
    expect(s.ciName).toBe("checks");
    expect(s.detected).toBe(true);
  });
  it("uses uv when pyproject + uv.lock present", () => {
    const d = tmp({ "pyproject.toml": "[project]", "uv.lock": "" });
    const s = detectStack(d);
    expect(s.install).toBe("uv sync");
    expect(s.test).toBe("uv run pytest");
  });
  it("falls back generically when nothing recognised", () => {
    const d = tmp({ "README.md": "x" });
    const s = detectStack(d);
    expect(s.detected).toBe(false);
    expect(s.test).toContain("TODO");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run packages/cli/test/constitution-detect.test.ts`
Expected: FAIL — `detectStack` is not exported.

- [ ] **Step 3: Implement (append to detect.ts)**

```ts
export interface StackCommands {
  install: string;
  test: string;
  lint: string;
  typecheck: string;
  format: string;
  run: string;
  ciName: string;
  detected: boolean;
}

const TODO = "echo 'TODO: set this command' && false";

export function detectStack(cwd: string): StackCommands {
  const ciName = "checks";
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    let scripts: Record<string, string> = {};
    try {
      scripts = (JSON.parse(readFileSync(pkgPath, "utf8")).scripts as Record<string, string>) ?? {};
    } catch {
      scripts = {};
    }
    const run = (name: string, fallback: string) =>
      name in scripts ? `npm run ${name}` : fallback;
    return {
      install: "npm install",
      test: "test" in scripts ? "npm test" : TODO,
      lint: run("lint", "# no linter configured"),
      typecheck: run("typecheck", run("tsc", "# no typecheck configured")),
      format: run("format", "# no formatter configured"),
      run: run("start", run("dev", "# no run command configured")),
      ciName,
      detected: true,
    };
  }
  if (existsSync(join(cwd, "pyproject.toml")) && existsSync(join(cwd, "uv.lock"))) {
    return {
      install: "uv sync",
      test: "uv run pytest",
      lint: "uv run ruff check .",
      typecheck: "uv run mypy .",
      format: "uv run ruff format .",
      run: "# set your run command",
      ciName,
      detected: true,
    };
  }
  return {
    install: TODO, test: TODO, lint: TODO, typecheck: TODO, format: TODO, run: TODO,
    ciName, detected: false,
  };
}
```

- [ ] **Step 4: Run to verify pass, commit**

Run: `npx vitest run packages/cli/test/constitution-detect.test.ts`
Expected: all pass.

```bash
git add packages/cli/src/constitution/detect.ts packages/cli/test/constitution-detect.test.ts
git commit -m "feat(cli): detectStack (npm/uv/fallback) for constitution scaffold"
```

---

### Task 5: `render.ts` — germlinePaths, buildValues, fillPlaceholders, OUTPUT_MAP

**Files:**
- Create: `packages/cli/src/constitution/render.ts`
- Test: `packages/cli/test/constitution-render.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/cli/test/constitution-render.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildValues, fillPlaceholders, germlinePaths, OUTPUT_MAP,
} from "../src/constitution/render.js";
import type { RepoInfo, StackCommands } from "../src/constitution/detect.js";

const repo: RepoInfo = { owner: "me", repo: "proj", handle: "me", account: "me@x.com", detected: true };
const stack: StackCommands = {
  install: "npm install", test: "npm test", lint: "# none", typecheck: "npm run typecheck",
  format: "# none", run: "# none", ciName: "checks", detected: true,
};

describe("germlinePaths", () => {
  it("is the fixed protected set", () => {
    expect(germlinePaths()).toEqual([
      "docs/agents/**", ".github/workflows/**", ".github/CODEOWNERS", "interlock.yml",
    ]);
  });
});

describe("buildValues", () => {
  it("fills all 15 placeholders with no {{ }} left when applied", () => {
    const v = buildValues(repo, stack);
    expect(v.OWNER).toBe("me");
    expect(v.REPO).toBe("proj");
    expect(v.OWNER_HANDLE).toBe("me");
    expect(v.TEST_CMD).toBe("npm test");
    expect(v.CI_CHECK_NAME).toBe("checks");
    // GERMLINE_GLOBS is a markdown bullet list of the germline paths
    expect(v.GERMLINE_GLOBS).toContain("- `docs/agents/**`");
    expect(v.GERMLINE_GLOBS).toContain("- `interlock.yml`");
  });
});

describe("fillPlaceholders", () => {
  it("replaces every {{KEY}} present in values", () => {
    const out = fillPlaceholders("a {{OWNER}}/{{REPO}} z", buildValues(repo, stack));
    expect(out).toBe("a me/proj z");
    expect(out).not.toMatch(/\{\{/);
  });
  it("leaves a clear marker for the cosmetic prose fields", () => {
    const v = buildValues(repo, stack);
    expect(v.PROJECT_DESCRIPTION).toMatch(/proj/);
  });
});

describe("OUTPUT_MAP", () => {
  it("maps template keys to canonical repo paths", () => {
    expect(OUTPUT_MAP["CONSTITUTION.md"]).toBe("docs/agents/CONSTITUTION.md");
    expect(OUTPUT_MAP["field-guide.md"]).toBe("docs/agents/README.md");
    expect(OUTPUT_MAP["CODEOWNERS"]).toBe(".github/CODEOWNERS");
    expect(OUTPUT_MAP["adapters/claude-SKILL.md"]).toBe(".claude/skills/master-loop/SKILL.md");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run packages/cli/test/constitution-render.test.ts`
Expected: FAIL — cannot find module `../src/constitution/render.js`.

- [ ] **Step 3: Implement**

`packages/cli/src/constitution/render.ts`:

```ts
import type { RepoInfo, StackCommands } from "./detect.js";

export function germlinePaths(): string[] {
  return ["docs/agents/**", ".github/workflows/**", ".github/CODEOWNERS", "interlock.yml"];
}

export function buildValues(repo: RepoInfo, stack: StackCommands): Record<string, string> {
  const globs = germlinePaths().map((g) => `- \`${g}\``).join("\n");
  return {
    OWNER: repo.owner,
    REPO: repo.repo,
    OWNER_HANDLE: repo.handle,
    GIT_ACCOUNT: repo.account,
    INSTALL_CMD: stack.install,
    TEST_CMD: stack.test,
    LINT_CMD: stack.lint,
    TYPECHECK_CMD: stack.typecheck,
    FORMAT_CMD: stack.format,
    RUN_CMD: stack.run,
    CI_CHECK_NAME: stack.ciName,
    GERMLINE_GLOBS: globs,
    // Cosmetic orientation prose — generic, editable, never blocks.
    PROJECT_DESCRIPTION: `${repo.repo} — describe your project in one line`,
    TEAM_AND_DOMAIN: `${repo.owner}, solo maintainer; describe the domain in one line`,
    END_USERS_AND_STAKES: `who relies on ${repo.repo} and why correctness matters (edit me)`,
  };
}

export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key: string) =>
    key in values ? values[key]! : whole
  );
}

/** Template relative-path → repo-relative output path. */
export const OUTPUT_MAP: Record<string, string> = {
  "CONSTITUTION.md": "docs/agents/CONSTITUTION.md",
  "loop-policy.md": "docs/agents/loop-policy.md",
  "master-loop.md": "docs/agents/master-loop.md",
  "field-guide.md": "docs/agents/README.md",
  "SETUP.md": "docs/agents/SETUP.md",
  "triage-labels.md": "docs/agents/triage-labels.md",
  "domain.md": "docs/agents/domain.md",
  "adr-0001-adopt-agent-governance.md": "docs/adr/0001-adopt-agent-governance.md",
  "AGENTS.md": "AGENTS.md",
  "CONTEXT.md": "CONTEXT.md",
  "CODEOWNERS": ".github/CODEOWNERS",
  "pull_request_template.md": ".github/pull_request_template.md",
  "adapters/claude-SKILL.md": ".claude/skills/master-loop/SKILL.md",
  "adapters/cursor-master-loop.mdc": ".cursor/rules/master-loop.mdc",
};
```

- [ ] **Step 4: Run to verify pass, commit**

Run: `npx vitest run packages/cli/test/constitution-render.test.ts`
Expected: all pass.

```bash
git add packages/cli/src/constitution/render.ts packages/cli/test/constitution-render.test.ts
git commit -m "feat(cli): render — germlinePaths, buildValues, fillPlaceholders, OUTPUT_MAP"
```

---

### Task 6: `buildCi` + `buildClaudeMd`

**Files:**
- Modify: `packages/cli/src/constitution/render.ts` (append)
- Test: `packages/cli/test/constitution-render.test.ts` (append)

- [ ] **Step 1: Append failing tests**

```ts
import { buildCi, buildClaudeMd } from "../src/constitution/render.js";

describe("buildCi", () => {
  it("generates a checks job running install/typecheck/test", () => {
    const yml = buildCi(stack);
    expect(yml).toContain("name: CI");
    expect(yml).toContain("checks:");
    expect(yml).toContain("npm install");
    expect(yml).toContain("npm run typecheck");
    expect(yml).toContain("npm test");
  });
  it("skips comment-only commands", () => {
    const yml = buildCi({ ...stack, typecheck: "# none" });
    expect(yml).not.toContain("# none");
  });
});

describe("buildClaudeMd", () => {
  it("points at AGENTS.md and the master-loop", () => {
    const md = buildClaudeMd();
    expect(md).toContain("@AGENTS.md");
    expect(md).toContain(".claude/skills/master-loop");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run packages/cli/test/constitution-render.test.ts`
Expected: FAIL — `buildCi`/`buildClaudeMd` not exported.

- [ ] **Step 3: Implement (append to render.ts)**

```ts
export function buildCi(stack: StackCommands): string {
  const real = (c: string) => c && !c.trim().startsWith("#");
  const steps: string[] = [`      - run: ${stack.install}`];
  if (real(stack.typecheck)) steps.push(`      - run: ${stack.typecheck}`);
  if (real(stack.test)) steps.push(`      - run: ${stack.test}`);
  const node =
    stack.install.startsWith("npm")
      ? "      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm\n"
      : "";
  return `name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  ${stack.ciName}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${node}${steps.join("\n")}
`;
}

export function buildClaudeMd(): string {
  return `@AGENTS.md

# Claude Code binding

This repo is governed by the agent Constitution (docs/agents/CONSTITUTION.md). The
master-loop controller binding for Claude Code lives at .claude/skills/master-loop/SKILL.md —
run /master-loop to operate the fleet. Status: shadow (see docs/agents/loop-policy.md).
`;
}
```

- [ ] **Step 4: Run to verify pass, commit**

Run: `npx vitest run packages/cli/test/constitution-render.test.ts`
Expected: all pass.

```bash
git add packages/cli/src/constitution/render.ts packages/cli/test/constitution-render.test.ts
git commit -m "feat(cli): render — stack-aware ci.yml + thin CLAUDE.md"
```

---

### Task 7: `scaffoldConstitution` (fs writes + checklist)

**Files:**
- Create: `packages/cli/src/commands/constitution.ts`
- Test: `packages/cli/test/constitution-scaffold.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/cli/test/constitution-scaffold.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scaffoldConstitution } from "../src/commands/constitution.js";

function gitRepo(): string {
  const d = mkdtempSync(join(tmpdir(), "scaffold-"));
  execFileSync("git", ["init", "-q"], { cwd: d });
  execFileSync("git", ["remote", "add", "origin", "git@github.com:me/proj.git"], { cwd: d });
  writeFileSync(join(d, "package.json"), JSON.stringify({ scripts: { test: "vitest", typecheck: "tsc --noEmit" } }));
  return d;
}

describe("scaffoldConstitution", () => {
  it("writes the constitution with no surviving placeholders and shadow mode", () => {
    const d = gitRepo();
    const out: string[] = [];
    const code = scaffoldConstitution({ cwd: d, force: false }, { log: (s) => out.push(s), error: () => {} });
    expect(code).toBe(0);
    expect(existsSync(join(d, "docs/agents/CONSTITUTION.md"))).toBe(true);
    expect(existsSync(join(d, ".github/CODEOWNERS"))).toBe(true);
    expect(existsSync(join(d, ".claude/skills/master-loop/SKILL.md"))).toBe(true);
    expect(existsSync(join(d, ".github/workflows/ci.yml"))).toBe(true);
    const policy = readFileSync(join(d, "docs/agents/loop-policy.md"), "utf8");
    expect(policy).toContain("status: shadow");
    expect(policy).toContain("`docs/agents/**`");           // germline globs rendered
    // INVARIANT: no placeholder survives anywhere
    const grep = execFileSync("grep", ["-rE", "\\{\\{", join(d, "docs"), join(d, ".github"), join(d, "AGENTS.md")], {
      cwd: d, encoding: "utf8",
    }).catch?.(() => "") ?? "";
    expect(grep).toBe("");
  });

  it("CODEOWNERS names the detected owner", () => {
    const d = gitRepo();
    scaffoldConstitution({ cwd: d, force: false }, { log: () => {}, error: () => {} });
    expect(readFileSync(join(d, ".github/CODEOWNERS"), "utf8")).toContain("@me");
  });

  it("refuses to overwrite an existing constitution without --force", () => {
    const d = gitRepo();
    scaffoldConstitution({ cwd: d, force: false }, { log: () => {}, error: () => {} });
    const err: string[] = [];
    const code = scaffoldConstitution({ cwd: d, force: false }, { log: () => {}, error: (s) => err.push(s) });
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("--force");
  });

  it("prints the one-time setup checklist", () => {
    const d = gitRepo();
    const out: string[] = [];
    scaffoldConstitution({ cwd: d, force: false }, { log: (s) => out.push(s), error: () => {} });
    const text = out.join("\n");
    expect(text).toMatch(/branch protection/i);
    expect(text).toMatch(/gh label create|labels/i);
  });
});
```

Note: the `grep` invariant in the first test uses a try/catch shape — `grep` exits 1 when it finds
nothing. Implement the assertion as: run grep, treat a non-zero "no matches" exit as empty output.
Replace the brittle `.catch?.` line with:

```ts
    let grep = "";
    try {
      grep = execFileSync("grep", ["-rE", "\\{\\{", "docs", ".github", "AGENTS.md"], { cwd: d, encoding: "utf8" });
    } catch (e: any) {
      grep = e.status === 1 ? "" : (() => { throw e; })();
    }
    expect(grep).toBe("");
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run packages/cli/test/constitution-scaffold.test.ts`
Expected: FAIL — cannot find module `../src/commands/constitution.js`.

- [ ] **Step 3: Implement**

`packages/cli/src/commands/constitution.ts`:

```ts
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAuthorInfo } from "../git.js"; // reuse the existing default Exec
import { execFileSync } from "node:child_process";
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

const defaultExec = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { cwd: process.cwd(), encoding: "utf8" });

export function scaffoldConstitution(opts: ScaffoldOptions, io: ScaffoldIo): number {
  const guard = join(opts.cwd, "docs/agents/CONSTITUTION.md");
  if (existsSync(guard) && !opts.force) {
    io.error("docs/agents/CONSTITUTION.md already exists — this repo already has a constitution. Re-run with --force to overwrite.");
    return 2;
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
    if (!dest) continue; // safety: only write known mappings
    write(dest, fillPlaceholders(content, values));
  }
  // 2. Generated files.
  write(".github/workflows/ci.yml", buildCi(stack));
  write("CLAUDE.md", buildClaudeMd());

  if (!repo.detected) {
    io.log("⚠ No git remote detected — CODEOWNERS uses a placeholder handle. Set a real GitHub handle in .github/CODEOWNERS before going live, or CODEOWNERS will not enforce.");
  }
  if (!stack.detected) {
    io.log("⚠ No recognised stack — fill the command placeholders in .github/workflows/ci.yml and docs/agents/.");
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
```

(Remove the unused `getAuthorInfo`/`defaultExec` import line if your linter flags it — the
per-call `exec` closure over `opts.cwd` is what's used.)

- [ ] **Step 4: Run to verify pass, commit**

Run: `npx vitest run packages/cli/test/constitution-scaffold.test.ts`
Expected: all pass (requires `npm run build -w packages/cli` first so `templates.generated.ts` exists — run `node packages/cli/scripts/embed-templates.mjs` if needed).

```bash
git add packages/cli/src/commands/constitution.ts packages/cli/test/constitution-scaffold.test.ts
git commit -m "feat(cli): scaffoldConstitution — write filled templates + setup checklist"
```

---

### Task 8: Wire `--with-constitution` into `init` + germline-synced `interlock.yml`

**Files:**
- Modify: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/test/init.test.ts` (append)

- [ ] **Step 1: Append failing tests to `packages/cli/test/init.test.ts`**

```ts
import { buildPolicyYaml } from "../src/commands/init.js";
import { germlinePaths } from "../src/constitution/render.js";

describe("buildPolicyYaml with germline (constitution mode)", () => {
  it("renders tier2 from germlinePaths when asked", () => {
    const yaml = buildPolicyYaml({ hasDocs: true, hasTests: true, hasWorkflows: true }, true);
    for (const g of germlinePaths()) expect(yaml).toContain(`"${g}"`);
  });
  it("default (no germline) keeps the lean tier2", () => {
    const yaml = buildPolicyYaml({ hasDocs: false, hasTests: false, hasWorkflows: false }, false);
    expect(yaml).toContain('"interlock.yml"');
    expect(yaml).not.toContain('"docs/agents/**"');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run packages/cli/test/init.test.ts`
Expected: FAIL — `buildPolicyYaml` takes 1 arg (TS error / wrong tier2).

- [ ] **Step 3: Implement — extend `buildPolicyYaml` and `runInit` in `init.ts`**

Change the `buildPolicyYaml` signature to accept an optional germline flag and, when set, use
`germlinePaths()` for tier2. Add this import at the top of `init.ts`:

```ts
import { germlinePaths } from "../constitution/render.js";
import { scaffoldConstitution } from "./constitution.js";
```

Replace the `buildPolicyYaml` function's `tier2` construction so the signature becomes
`buildPolicyYaml(d: Detected, withConstitution = false)` and:

```ts
  const tier2: string[] = [];
  if (withConstitution) {
    tier2.push(...germlinePaths());
  } else {
    if (d.hasWorkflows) tier2.push(".github/**");
    tier2.push("interlock.yml"); // the gate cannot edit its own off-switch
  }
```

Extend `InitOptions` with `withConstitution?: boolean` and, at the end of `runInit`, after the
`interlock.yml` write and the workflow print, call the scaffold when requested:

```ts
  if (opts.withConstitution) {
    io.log("");
    return scaffoldConstitution({ cwd: opts.cwd, force: opts.force }, io);
  }
  return 0;
```

Also pass `withConstitution` into `buildPolicyYaml(detected, opts.withConstitution ?? false)` at
the write site inside `runInit`.

- [ ] **Step 4: Wire the flag in `index.ts`**

In `packages/cli/src/index.ts`, on the `init` command add the option and thread it through:

```ts
  .command("init")
  .description("Scaffold interlock.yml and print the workflow to paste")
  .option("--force", "overwrite an existing interlock.yml", false)
  .option("--with-constitution", "also scaffold the full agent constitution", false)
  .action((opts: { force: boolean; withConstitution: boolean }) => {
    process.exitCode = runInit(
      { cwd: process.cwd(), force: opts.force, withConstitution: opts.withConstitution },
      { log: console.log, error: console.error }
    );
  });
```

- [ ] **Step 5: Run to verify pass + full suite + typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/index.ts packages/cli/test/init.test.ts
git commit -m "feat(cli): init --with-constitution flag; germline-synced interlock.yml"
```

---

### Task 9: End-to-end integration test + germline-sync assertion

**Files:**
- Modify: `packages/cli/test/constitution-scaffold.test.ts` (append)

- [ ] **Step 1: Append the integration test**

```ts
import { runInit } from "../src/commands/init.js";

describe("init --with-constitution (end to end)", () => {
  it("scaffolds a coherent, placeholder-free, germline-synced repo", () => {
    const d = gitRepo();
    const code = runInit({ cwd: d, force: false, withConstitution: true }, { log: () => {}, error: () => {} });
    expect(code).toBe(0);

    // interlock.yml tier2 and loop-policy germline globs agree
    const policyYml = readFileSync(join(d, "interlock.yml"), "utf8");
    const loopPolicy = readFileSync(join(d, "docs/agents/loop-policy.md"), "utf8");
    for (const g of ["docs/agents/**", ".github/workflows/**", ".github/CODEOWNERS", "interlock.yml"]) {
      expect(policyYml, "interlock.yml tier2").toContain(`"${g}"`);
      expect(loopPolicy, "loop-policy globs").toContain(`\`${g}\``);
    }

    // CI job is named `checks` to match SETUP/branch-protection
    expect(readFileSync(join(d, ".github/workflows/ci.yml"), "utf8")).toContain("checks:");

    // no placeholder anywhere in the written tree
    let grep = "";
    try {
      grep = execFileSync("grep", ["-rIE", "\\{\\{", "docs", ".github", "AGENTS.md", "CONTEXT.md", "CLAUDE.md", "interlock.yml"], { cwd: d, encoding: "utf8" });
    } catch (e: any) {
      grep = e.status === 1 ? "" : (() => { throw e; })();
    }
    expect(grep, "surviving placeholders").toBe("");
  });
});
```

- [ ] **Step 2: Run to verify pass**

Run: `npx vitest run packages/cli/test/constitution-scaffold.test.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/test/constitution-scaffold.test.ts
git commit -m "test(cli): end-to-end --with-constitution scaffold + germline sync"
```

---

### Task 10: Bundle verification + final gate

**Files:** none (verification only)

- [ ] **Step 1: Rebuild the CLI bundle (with the embed step) and smoke-test**

Run: `npm run build -w packages/cli`
Expected: `embedded 14 template files …` then esbuild emits `dist/index.js`. The bundle is a
single file; the templates are inlined (no `templates/` read at runtime).

Run, in a throwaway dir:
```bash
P=$(mktemp -d); cd "$P"; git init -q; git remote add origin git@github.com:me/proj.git
echo '{"scripts":{"test":"vitest","typecheck":"tsc --noEmit"}}' > package.json
node /Users/farshad/projects/interlock/packages/cli/dist/index.js init --with-constitution
test -f docs/agents/CONSTITUTION.md && echo "scaffold OK"
grep -rIE '\{\{' docs .github AGENTS.md interlock.yml && echo "PLACEHOLDER LEAK" || echo "no placeholders ✓"
cd /; rm -rf "$P"
```
Expected: "scaffold OK", "no placeholders ✓".

- [ ] **Step 2: Full gate**

Run: `npx vitest run && npm run typecheck`
Expected: everything green (existing 76 + the new constitution tests).

- [ ] **Step 3: Commit any leftover (none expected) and stop for review**

```bash
git status --short   # should be clean
```

---

## Self-review notes (already applied)

- **Spec coverage:** vendored solo template ✓ (T1), embed/self-contained ✓ (T2), detect
  (stack + repo) ✓ (T3–T4), placeholder fill + OUTPUT_MAP + germlinePaths ✓ (T5), stack-aware
  CI + CLAUDE.md ✓ (T6), scaffold + checklist + overwrite-guard + no-network ✓ (T7),
  `--with-constitution` flag + germline-synced interlock.yml ✓ (T8), grep-no-`{{` invariant +
  germline-sync assertion ✓ (T9), single-file bundle verified ✓ (T10).
- **Deferred per spec (not in this plan):** `--team` (dropped), `--pr`/label/branch-protection
  automation (printed as checklist), LLM prose adaptation, pacemaker.
- **Type consistency:** `RepoInfo`/`StackCommands` defined in `detect.ts` (T3–T4), consumed by
  `render.ts` (T5–T6) and `constitution.ts` (T7); `germlinePaths()` is the single source used by
  both `render.buildValues` (loop-policy globs) and `init.buildPolicyYaml` (interlock.yml tier2);
  `OUTPUT_MAP` keys match the embedded template relative paths from T1/T2.
- **Known nuance for the implementer:** the scaffold test suite needs `templates.generated.ts`
  to exist — run `node packages/cli/scripts/embed-templates.mjs` (or `npm run build -w
  packages/cli`) before the first `vitest` run in Tasks 7+.
