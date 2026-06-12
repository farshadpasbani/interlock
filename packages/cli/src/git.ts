import { execFileSync } from "node:child_process";
import type { AuthorInfo, ChangedFile } from "@interlock-dev/core";
import { extractTrailers } from "@interlock-dev/core";

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

export function getAuthorInfo(base: string, exec: Exec = defaultExec): AuthorInfo {
  const branch = exec("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const account = exec("git", ["log", "-1", "--format=%an"]).trim() || "unknown";
  const bodies = exec("git", ["log", `${base}...HEAD`, "--format=%B%x00"]);
  const messages = bodies.split("\0").filter((b) => b.trim().length > 0);
  const trailers = extractTrailers(messages);
  return { account, branch, trailers };
}
