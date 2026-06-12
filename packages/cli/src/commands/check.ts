import { readFileSync } from "node:fs";
import {
  classify,
  InvalidPathError,
  parsePolicy,
  PolicyError,
  type AuthorInfo,
  type ChangedFile,
} from "@interlock-dev/core";
import { getAuthorInfo, getChangedFiles } from "../git.js";
import { formatVerdict } from "../output.js";

export interface CheckOptions {
  base: string;
  json: boolean;
}

export interface CheckDeps {
  readPolicy: () => string;
  changedFiles: (base: string) => ChangedFile[];
  authorInfo: (base: string) => AuthorInfo;
  log: (s: string) => void;
  error: (s: string) => void;
}

export const defaultCheckDeps: CheckDeps = {
  readPolicy: () => readFileSync("interlock.yml", "utf8"),
  changedFiles: (base) => getChangedFiles(base),
  authorInfo: (base) => getAuthorInfo(base),
  log: console.log,
  error: console.error,
};

export function runCheck(
  opts: CheckOptions,
  deps: CheckDeps = defaultCheckDeps
): number {
  let policyText: string;
  try {
    policyText = deps.readPolicy();
  } catch {
    deps.error("No interlock.yml found. Run: npx agent-interlock init");
    return 2;
  }

  let policy;
  try {
    policy = parsePolicy(policyText);
  } catch (e) {
    if (e instanceof PolicyError) {
      deps.error(e.message);
      return 2;
    }
    throw e;
  }

  let verdict;
  try {
    verdict = classify(
      deps.changedFiles(opts.base),
      deps.authorInfo(opts.base),
      policy
    );
  } catch (e) {
    if (e instanceof InvalidPathError) {
      deps.error(e.message);
      return 2;
    }
    throw e;
  }

  deps.log(opts.json ? JSON.stringify(verdict, null, 2) : formatVerdict(verdict));

  // Local check is advisory: exit 1 for anything stronger than a warning.
  const blocking = verdict.violations.some((v) => v.setting !== "warn");
  return blocking ? 1 : 0;
}
