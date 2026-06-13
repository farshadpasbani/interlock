import { describe, expect, it } from "vitest";
import {
  buildCi, buildClaudeMd, buildValues, fillPlaceholders, germlinePaths, OUTPUT_MAP,
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
      "docs/agents/**",
      ".github/workflows/**",
      ".github/CODEOWNERS",
      ".claude/skills/master-loop/**",
      ".cursor/rules/master-loop.mdc",
      "interlock.yml",
    ]);
  });
});

describe("buildValues", () => {
  it("fills all placeholders with no {{ }} left when applied", () => {
    const v = buildValues(repo, stack);
    expect(v.OWNER).toBe("me");
    expect(v.REPO).toBe("proj");
    expect(v.OWNER_HANDLE).toBe("me");
    expect(v.TEST_CMD).toBe("npm test");
    expect(v.CI_CHECK_NAME).toBe("checks");
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
  it("provides a generic project-description value", () => {
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

describe("buildCi no-stack safety", () => {
  it("emits run values with no colon-space that would break YAML", () => {
    const noStack = {
      install: "echo 'TODO set this command' && false",
      test: "echo 'TODO set this command' && false",
      lint: "echo 'TODO set this command' && false",
      typecheck: "echo 'TODO set this command' && false",
      format: "echo 'TODO set this command' && false",
      run: "echo 'TODO set this command' && false",
      ciName: "checks", detected: false,
    };
    const yml = buildCi(noStack);
    for (const line of yml.split("\n").filter((l) => l.includes("- run:"))) {
      // the value after "run:" must not itself contain ": " (colon-space)
      const value = line.split("- run:")[1] ?? "";
      expect(value.includes(": "), line).toBe(false);
    }
  });
});
