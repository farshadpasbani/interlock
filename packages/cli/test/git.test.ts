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
    expect(author.trailers).not.toContain("feat: thing");
  });
});
