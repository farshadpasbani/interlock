import { describe, expect, it } from "vitest";
import { extractTrailers } from "../src/trailers.js";

describe("extractTrailers", () => {
  it("pulls trailer-shaped lines from the last paragraph only", () => {
    const trailers = extractTrailers([
      "feat: x\n\nbody text Note: not a trailer paragraph\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nSigned-off-by: F <f@x.com>",
      "fix: y",
    ]);
    expect(trailers).toEqual([
      "Co-Authored-By: Claude <noreply@anthropic.com>",
      "Signed-off-by: F <f@x.com>",
    ]);
  });

  it("does not collect subject lines of subject-only messages UNLESS trailer-shaped", () => {
    // A single-line message is its own last paragraph; "fix: y"-style
    // conventional-commit subjects are trailer-shaped, but single-paragraph
    // messages (subject == whole message) must not be scanned.
    expect(extractTrailers(["fix: y"])).toEqual([]);
    expect(extractTrailers(["Co-Authored-By: Claude <x@y>"])).toEqual([]);
  });

  it("handles empty and whitespace-only messages", () => {
    expect(extractTrailers(["", "   \n\n  "])).toEqual([]);
  });
});
