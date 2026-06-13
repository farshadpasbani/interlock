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
