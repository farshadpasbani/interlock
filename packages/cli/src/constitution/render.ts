import type { RepoInfo, StackCommands } from "./detect.js";

export function germlinePaths(): string[] {
  return [
    "docs/agents/**",
    ".github/workflows/**",
    ".github/CODEOWNERS",
    ".claude/skills/master-loop/**",
    ".cursor/rules/master-loop.mdc",
    "interlock.yml",
  ];
}

export function buildValues(repo: RepoInfo, stack: StackCommands): Record<string, string> {
  const globs = germlinePaths().map((g) => `- \`${g}\``).join("\n");
  return {
    OWNER: repo.owner,
    REPO: repo.repo,
    OWNER_HANDLE: repo.handle,
    GIT_ACCOUNT: repo.account,
    INSTALL_CMD: stack.install,
    TEST_CMD: stack.test,
    LINT_CMD: stack.lint,
    TYPECHECK_CMD: stack.typecheck,
    FORMAT_CMD: stack.format,
    RUN_CMD: stack.run,
    CI_CHECK_NAME: stack.ciName,
    GERMLINE_GLOBS: globs,
    PROJECT_DESCRIPTION: `${repo.repo} — describe your project in one line`,
    TEAM_AND_DOMAIN: `${repo.owner}, solo maintainer; describe the domain in one line`,
    END_USERS_AND_STAKES: `who relies on ${repo.repo} and why correctness matters (edit me)`,
  };
}

export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key: string) =>
    key in values ? values[key]! : whole
  );
}

export function buildCi(stack: StackCommands): string {
  const real = (c: string) => c && !c.trim().startsWith("#");
  const steps: string[] = [`      - run: ${stack.install}`];
  if (real(stack.typecheck)) steps.push(`      - run: ${stack.typecheck}`);
  if (real(stack.test)) steps.push(`      - run: ${stack.test}`);
  const node =
    stack.install.startsWith("npm")
      ? "      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm\n"
      : "";
  return `name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  ${stack.ciName}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${node}${steps.join("\n")}
`;
}

export function buildClaudeMd(): string {
  return `@AGENTS.md

# Claude Code binding

This repo is governed by the agent Constitution (docs/agents/CONSTITUTION.md). The
master-loop controller binding for Claude Code lives at .claude/skills/master-loop/SKILL.md —
run /master-loop to operate the fleet. Status: shadow (see docs/agents/loop-policy.md).
`;
}

/** Template relative-path → repo-relative output path. */
export const OUTPUT_MAP: Record<string, string> = {
  "CONSTITUTION.md": "docs/agents/CONSTITUTION.md",
  "loop-policy.md": "docs/agents/loop-policy.md",
  "master-loop.md": "docs/agents/master-loop.md",
  "field-guide.md": "docs/agents/README.md",
  "SETUP.md": "docs/agents/SETUP.md",
  "triage-labels.md": "docs/agents/triage-labels.md",
  "domain.md": "docs/agents/domain.md",
  "adr-0001-adopt-agent-governance.md": "docs/adr/0001-adopt-agent-governance.md",
  "AGENTS.md": "AGENTS.md",
  "CONTEXT.md": "CONTEXT.md",
  "CODEOWNERS": ".github/CODEOWNERS",
  "pull_request_template.md": ".github/pull_request_template.md",
  "adapters/claude-SKILL.md": ".claude/skills/master-loop/SKILL.md",
  "adapters/cursor-master-loop.mdc": ".cursor/rules/master-loop.mdc",
};
