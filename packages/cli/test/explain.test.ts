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

  it("exits 2 on a malformed path", () => {
    const err: string[] = [];
    const code = runExplain("a/../b", { readPolicy: () => POLICY, log: () => {}, error: (s) => err.push(s) });
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("..");
  });

  it("exits 2 when policy file cannot be read (ENOENT)", () => {
    const err: string[] = [];
    const code = runExplain("src/x.ts", {
      readPolicy: () => { throw Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }); },
      log: () => {},
      error: (s) => err.push(s),
    });
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("No interlock.yml found");
  });
});
