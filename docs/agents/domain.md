# Domain notes for agents

Single-context repository. The ubiquitous language lives in
[`../../CONTEXT.md`](../../CONTEXT.md); decisions of record live in [`../adr/`](../adr/). Read
both before implementing.

## Product orientation

**Interlock** is a deterministic governance gate for AI-agent pull requests. It reads
`interlock.yml` in a repo, classifies each changed file's path against the configured protected
paths and tier rules, and posts a sticky PR comment with the verdict (tier, policy, merge
eligibility). The Action runs on GitHub Actions via `.github/workflows/interlock.yml`.

**This repo dogfoods the product** — `interlock.yml` is present and the Interlock Action runs on
all PRs here. A constitutional scaffold PR (like the one that introduced this file) should itself
receive an Interlock verdict, stamping `Tier 2 / human-on-tier2` for changes to `.github/**` and
`interlock.yml`. If the stamp is absent or wrong, it is a product bug.

## Key packages

- `packages/core` — the engine: path classification (`classify.ts`), policy parsing (`policy.ts`),
  merge-gate logic (`gating.ts`). These are Tier-2 protected paths.
- `packages/cli` — the CLI entry point (`packages/cli/dist/index.js` after build).
- `action/` — the GitHub Action wrapper; `action/dist/**` is a committed reproducible bundle.

## Gotchas

- **`action/dist` is committed.** It must be regenerated via `npm run build -w action` and
  committed whenever `action/` source changes. CI verifies it is not stale.
- **No linter configured yet.** Use `npm run typecheck` where a lint command is required;
  note the absence in PR checklists.
- **`interlock.yml` tier2 list mirrors `loop-policy.md` §2 domain paths.** Keep both in sync —
  they are different representations of the same invariant (one is the product config, one is
  the fleet policy).

Fill this file with additional domain orientation as the project takes shape — external systems,
API conventions, units, numerical constants and their sources.
