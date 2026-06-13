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

function grepPlaceholders(cwd: string): string {
  try {
    return execFileSync("grep", ["-rIE", "\\{\\{", "docs", ".github", "AGENTS.md", "CONTEXT.md"], { cwd, encoding: "utf8" });
  } catch (e: any) {
    if (e.status === 1) return ""; // grep exits 1 when no matches — that's success
    throw e;
  }
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
    expect(policy).toContain("`docs/agents/**`"); // germline globs rendered from {{GERMLINE_GLOBS}}
    expect(grepPlaceholders(d)).toBe("");          // INVARIANT: no {{ }} survives
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
