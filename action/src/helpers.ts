import type { ChangedFile, Verdict } from "@interlock-dev/core";
import type { GatingResult } from "@interlock-dev/core";
import { extractTrailers } from "@interlock-dev/core";

export const MARKER = "<!-- interlock-verdict -->";

export interface ApiFile {
  filename: string;
  status: string;
  previous_filename?: string;
}

export function mapFiles(apiFiles: ApiFile[]): ChangedFile[] {
  return apiFiles.map((f) => {
    if (f.status === "renamed" && f.previous_filename) {
      return {
        path: f.filename,
        previousPath: f.previous_filename,
        status: "renamed" as const,
      };
    }
    const status =
      f.status === "added" || f.status === "removed"
        ? (f.status as "added" | "removed")
        : ("modified" as const);
    return { path: f.filename, status };
  });
}

export { extractTrailers };

export function buildComment(verdict: Verdict, gating: GatingResult): string {
  const icon = gating.shouldFail ? "❌" : verdict.tier === 2 ? "⚠️" : "✅";
  const lines: string[] = [];
  lines.push(MARKER);
  lines.push(
    `### ${icon} Interlock — Tier ${verdict.tier} (${verdict.authorClass} author, mode: ${verdict.mode})`
  );
  lines.push("");
  lines.push("| Path | Tier | Rule |");
  lines.push("| --- | --- | --- |");
  for (const f of verdict.perFile) {
    lines.push(`| \`${f.path}\` | ${f.tier} | \`${f.matchedRule}\` |`);
  }
  lines.push("");
  for (const r of verdict.requirements) lines.push(`- ${r}`);
  if (gating.shouldFail) {
    lines.push("");
    lines.push(`**Check failed:** ${gating.reasons.join("; ")}`);
  }
  return lines.join("\n");
}

/** Two attempts, brief pause — in enforce mode there is no silent pass. */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
    return await fn();
  }
}
