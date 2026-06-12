const TRAILER_RE = /^[A-Za-z][A-Za-z-]*:\s.+/;

/**
 * Extract git trailers (e.g. "Co-Authored-By: …") from commit messages.
 * Git convention: trailers live in the FINAL paragraph, separated from the
 * rest of the message by a blank line, and the paragraph consists of
 * trailer-shaped lines. Single-paragraph messages have no trailer block —
 * a subject like "fix: y" is trailer-shaped but is not a trailer.
 */
export function extractTrailers(commitMessages: string[]): string[] {
  const trailers: string[] = [];
  for (const message of commitMessages) {
    const paragraphs = message
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (paragraphs.length < 2) continue; // no separate trailer block
    const last = paragraphs[paragraphs.length - 1]!;
    const lines = last.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => TRAILER_RE.test(l))) {
      trailers.push(...lines);
    }
  }
  return trailers;
}
