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

  it("rejects an unsupported version with the custom message", () => {
    expect(() => parsePolicy("version: 2")).toThrow(/version/);
    // the zod v4 `error` param must still surface our custom copy
    expect(() => parsePolicy("version: 2")).toThrow(/only version: 1 is supported/);
  });

  it("rejects unknown keys (catches typos)", () => {
    expect(() => parsePolicy("version: 1\ntires:\n  tier0: []")).toThrow(PolicyError);
  });

  it("rejects a bad rule value with a readable message", () => {
    expect(() =>
      parsePolicy("version: 1\nrules:\n  agent-on-tier2: maybe")
    ).toThrow(/agent-on-tier2/);
  });

  it("rejects empty-string globs at parse time", () => {
    expect(() =>
      parsePolicy('version: 1\ntiers:\n  tier2: [""]')
    ).toThrow(/non-empty/);
  });
});
