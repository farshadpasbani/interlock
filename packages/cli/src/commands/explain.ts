import { readFileSync } from "node:fs";
import {
  InvalidPathError,
  parsePolicy,
  PolicyError,
  tierForPath,
} from "@interlock-dev/core";

export interface ExplainDeps {
  readPolicy: () => string;
  log: (s: string) => void;
  error: (s: string) => void;
}

export const defaultExplainDeps: ExplainDeps = {
  readPolicy: () => readFileSync("interlock.yml", "utf8"),
  log: console.log,
  error: console.error,
};

export function runExplain(
  path: string,
  deps: ExplainDeps = defaultExplainDeps
): number {
  let policy;
  try {
    policy = parsePolicy(deps.readPolicy());
  } catch (e) {
    if (e instanceof PolicyError) {
      deps.error(e.message);
      return 2;
    }
    // Filesystem errors (ENOENT, EACCES, etc.) — don't stack-trace on the most
    // common new-user path; give an actionable message instead.
    if (
      e instanceof Error &&
      "code" in e &&
      typeof (e as NodeJS.ErrnoException).code === "string"
    ) {
      deps.error(
        "No interlock.yml found. Run: npx agent-interlock init"
      );
      return 2;
    }
    throw e;
  }
  try {
    const { tier, matchedRule } = tierForPath(path, policy);
    deps.log(`${path} → Tier ${tier} (rule: ${matchedRule})`);
    return 0;
  } catch (e) {
    if (e instanceof InvalidPathError) {
      deps.error(e.message);
      return 2;
    }
    throw e;
  }
}
