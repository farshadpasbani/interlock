# 0001 — Adopt tiered-autonomy agent governance (the Constitution)

- Status: Accepted (commissioning in shadow)
- Date: 2026-06-13

## Context

This repository is built by a solo founder-engineer and an autonomous agent fleet.
Without an explicit, shared rule for what agents may do unsupervised, every change either waits
on a human (the loop is theatre) or merges unreviewed (the engineering core is unguarded). We
want the rules in place *before* the first feature lands, so they grow with the code rather
than being retrofitted onto a codebase that already learned bad habits.

The product itself (Interlock) is a governance gate for AI-agent PRs — so the fleet that builds
it is also governed by it. This creates a dogfood loop: the fleet's own PRs are stamped by the
product, giving immediate E2E signal on every workflow change.

## Decision

Adopt the physiological charter in [`../agents/CONSTITUTION.md`](../agents/CONSTITUTION.md) and
the operative dials in [`../agents/loop-policy.md`](../agents/loop-policy.md). In summary:

- **Tiered autonomy by reversibility of harm.** Tier 0 (docs/tests/chore) auto-merges on green
  CI; Tier 1 (features/fixes) needs green CI + dual agent review (human gate waived at genesis —
  solo sovereign, can reinstate by amendment); Tier 2 (protected paths) is always the sovereign.
- **Solo sovereign.** Authority lives in `@farshadpasbani` via `.github/CODEOWNERS`.
- **Self-modification ban.** The fleet may never edit its own gates, policy, or charter.
- **External-anchor rule.** The fleet acts only on human-anchored work; it never invents its own.
- **Shadow commissioning.** Nothing auto-merges until ten consecutive clean audits.
- **Dogfood loop.** The product's own `interlock.yml` gates the fleet's PRs — verdicts on
  constitution-touching PRs are a live E2E test of the Action.

## Consequences

- The protected-path list (`loop-policy.md` §2) is the audit surface and **must be kept current**
  as the codebase grows — domain-critical paths join it when they land. Critically: `interlock.yml`
  must mirror the same paths, since the product enforces them in dogfood mode.
- The human counter-signature on Tier 1 is deliberately omitted for solo operation; it is
  restored by a future amendment once a second engineer joins or the sovereign decides the
  track record warrants a belt-and-suspenders approach.
- Governance changes are themselves germline — amended only by a CODEOWNERS-reviewed PR.
- The committed `action/dist` bundle must remain reproducible; CI verifies this on every push.
