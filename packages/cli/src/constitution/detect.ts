import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exec } from "../git.js";

export interface RepoInfo {
  owner: string;
  repo: string;
  handle: string;
  account: string;
  detected: boolean;
}

export function parseRemote(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/) ?? null;
  if (!m || !m[1] || !m[2]) return null;
  return { owner: m[1], repo: m[2] };
}

export function detectRepo(cwd: string, exec: Exec): RepoInfo {
  let parsed: { owner: string; repo: string } | null = null;
  try {
    parsed = parseRemote(exec("git", ["remote", "get-url", "origin"]).trim());
  } catch {
    parsed = null;
  }
  let account = "";
  try {
    account = exec("git", ["config", "user.email"]).trim();
  } catch {
    account = "";
  }
  if (!parsed) {
    return { owner: "OWNER", repo: "REPO", handle: "OWNER", account: account || "OWNER", detected: false };
  }
  return {
    owner: parsed.owner,
    repo: parsed.repo,
    handle: parsed.owner,
    account: account || parsed.owner,
    detected: true,
  };
}

export interface StackCommands {
  install: string;
  test: string;
  lint: string;
  typecheck: string;
  format: string;
  run: string;
  ciName: string;
  detected: boolean;
}

const TODO = "echo 'TODO set this command' && false";

export function detectStack(cwd: string): StackCommands {
  const ciName = "checks";
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    let scripts: Record<string, string> = {};
    try {
      scripts = (JSON.parse(readFileSync(pkgPath, "utf8")).scripts as Record<string, string>) ?? {};
    } catch {
      scripts = {};
    }
    const run = (name: string, fallback: string) =>
      name in scripts ? `npm run ${name}` : fallback;
    return {
      install: "npm install",
      test: "test" in scripts ? "npm test" : TODO,
      lint: run("lint", "# no linter configured"),
      typecheck: run("typecheck", run("tsc", "# no typecheck configured")),
      format: run("format", "# no formatter configured"),
      run: run("start", run("dev", "# no run command configured")),
      ciName,
      detected: true,
    };
  }
  if (existsSync(join(cwd, "pyproject.toml")) && existsSync(join(cwd, "uv.lock"))) {
    return {
      install: "uv sync",
      test: "uv run pytest",
      lint: "uv run ruff check .",
      typecheck: "uv run mypy .",
      format: "uv run ruff format .",
      run: "# set your run command",
      ciName,
      detected: true,
    };
  }
  return {
    install: TODO, test: TODO, lint: TODO, typecheck: TODO, format: TODO, run: TODO,
    ciName, detected: false,
  };
}
