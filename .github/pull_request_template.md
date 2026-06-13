## What & why


## Tier (see `docs/agents/loop-policy.md` §2)
- [ ] **Tier 0** — docs / tests / chore only (auto-merge on green CI)
- [ ] **Tier 1** — feature / fix (green CI + dual agent review)
- [ ] **Tier 2** — touches a protected path (always a CODEOWNERS human)

## Checklist
- [ ] Tests cover the change; every fix left a regression test (Constitution Art. V)
- [ ] `npm run typecheck` · `npx vitest run` green locally (no linter configured yet)
- [ ] Any doc this change made stale is reconciled here (Art. XI)
- [ ] No `CONTEXT.md` definition or ADR changed silently (proposed via `needs-engineer` instead)
- [ ] If `action/` source changed: `npm run build -w action` run and `action/dist` committed
