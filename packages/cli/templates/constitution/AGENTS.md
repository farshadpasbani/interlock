# AGENTS.md

Canonical, harness-neutral instructions for any AI agent working this repository — Claude Code,
Cursor, Codex, or otherwise. Tool-specific entrypoints (`CLAUDE.md`, `.cursor/rules/`,
`.claude/skills/`) are thin pointers to this file and to `docs/agents/master-loop.md`; the
substance lives here, once.

## Role

{{TEAM_AND_DOMAIN}}. {{END_USERS_AND_STAKES}}
Decisions reflect sound judgement and reviewability.

## Commands

Commands (replace with your stack):

```bash
{{INSTALL_CMD}}
{{TEST_CMD}}
{{LINT_CMD}}
{{FORMAT_CMD}}
{{TYPECHECK_CMD}}
{{RUN_CMD}}
```

## Architecture

_To be filled in as the application takes shape. Keep this section honest — it is the team's
map, and a stale map is worse than none (Constitution Article XI: reconcile docs to code when
they drift)._

## Code standards

_Adapt to the project. Sensible defaults:_
- Functions that compute something document inputs, outputs, and (where relevant) units.
- Constants that carry an external citation (a standard, a spec, a regulation) name their source.
- Strict layer separation: integration / domain logic / computation / I/O never mixed.

## The agent fleet — governance

This repo runs an autonomous-development fleet under a written, harness-neutral Constitution.
Any agent — whichever tool you are — operates under the same law:

- [`docs/agents/CONSTITUTION.md`](docs/agents/CONSTITUTION.md) — the charter: setpoints the fleet defends, and what it may never do.
- [`docs/agents/loop-policy.md`](docs/agents/loop-policy.md) — the dials: tiers, protected paths, commissioning `status`.
- [`docs/agents/master-loop.md`](docs/agents/master-loop.md) — the controller (the "brain stem"), tool-neutral, with a *Harness adapters* table that binds it to your specific tool.

Scale the approach to the task — do not run a multi-agent ceremony for a typo. Read the
Constitution before working the loop. The fleet is commissioning in **shadow**: nothing
auto-merges yet (Constitution Article X).

## Permissions

No approval needed: git, the package manager, tests, lint, builds. Always ask before:
secrets / licences, public exposure, deleting files, billed or external integrations.
