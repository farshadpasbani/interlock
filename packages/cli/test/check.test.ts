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

  it("exits 2 on malformed paths from the diff (InvalidPathError)", () => {
    const d = deps({
      changedFiles: () => [{ path: "foo/../interlock.yml", status: "modified" }],
    });
    expect(runCheck({ base: "main", json: false }, d)).toBe(2);
    expect(d.err.join("\n")).toContain("..");
  });

  it("--json emits machine-readable verdict", () => {
    const d = deps();
    runCheck({ base: "main", json: true }, d);
    const parsed = JSON.parse(d.out.join("\n"));
    expect(parsed.tier).toBe(0);
  });
});
