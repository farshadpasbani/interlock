# AGENTS.md

Canonical, harness-neutral instructions for any AI agent working this repository — Claude Code,
Cursor, Codex, or otherwise. Tool-specific entrypoints (`CLAUDE.md`, `.cursor/rules/`,
`.claude/skills/`) are thin pointers to this file and to `docs/agents/master-loop.md`; the
substance lives here, once.

## Role

Farshad Pasbani, solo founder-engineer; dev-infra tooling for AI-agent governance. Interlock — deterministic governance gate for AI-agent pull requests (protected paths + tiered merge rules from one interlock.yml).
Decisions reflect sound judgement and reviewability.

End users: developers and teams who let AI coding agents open PRs; the product's whole promise is that the gate never fails open — a wrong verdict either blocks honest work or waves a protected-path change through.

## Commands

```bash
npm install
npx vitest run
npm run typecheck
# No linter configured yet — use npm run typecheck where a lint command is required.
# No formatter configured yet — same note.
npm run typecheck
node packages/cli/dist/index.js --help
```

## Architecture

This repo is a monorepo with three packages:

- **`packages/core`** — the engine: path classification (`classify.ts`), policy parsing
  (`policy.ts`), merge-gate logic (`gating.ts`). These are Tier-2 protected paths.
- **`packages/cli`** — the CLI entry point. Run via `node packages/cli/dist/index.js --help`
  after `npm run build`.
- **`action/`** — the GitHub Action wrapper. `action/dist/**` is a **committed reproducible
  bundle** — regenerate with `npm run build -w action` and commit whenever action source changes.
  CI verifies the bundle is not stale.

`interlock.yml` in the repo root is the product's own dogfood gate configuration.

_Keep this section honest — it is the team's map, and a stale map is worse than none
(Constitution Article XI: reconcile docs to code when they drift)._

## Code standards

- Functions that compute something document inputs, outputs, and (where relevant) units.
- Constants that carry an external citation (a standard, a spec, a regulation) name their source.
- Strict layer separation: integration / domain logic / computation / I/O never mixed.
- Every bug fix leaves a regression test — the antibody for that pathogen (Constitution Article V).

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
