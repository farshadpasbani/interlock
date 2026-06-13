# 0001 — Adopt tiered-autonomy agent governance (the Constitution)

- Status: Accepted (commissioning in shadow)
- Date: 2026-06-10

## Context

This repository is built collaboratively by a human team and an autonomous agent fleet.
Without an explicit, shared rule for what agents may do unsupervised, every change either waits
on a human (the loop is theatre) or merges unreviewed (the engineering core is unguarded). We
want the rules in place *before* the first feature lands, so they grow with the code rather
than being retrofitted onto a codebase that already learned bad habits.

## Decision

Adopt the physiological charter in [`../agents/CONSTITUTION.md`](../agents/CONSTITUTION.md) and
the operative dials in [`../agents/loop-policy.md`](../agents/loop-policy.md). In summary:

- **Tiered autonomy by reversibility of harm.** Tier 0 (docs/tests/chore) auto-merges on green
  CI; Tier 1 (features/fixes) needs green CI + dual agent review + one CODEOWNERS human
  approval; Tier 2 (protected paths) is always a human.
- **Plural sovereign.** Authority lives in the team via `.github/CODEOWNERS`, never one person.
- **Self-modification ban.** The fleet may never edit its own gates, policy, or charter.
- **External-anchor rule.** The fleet acts only on human-anchored work; it never invents its own.
- **Shadow commissioning.** Nothing auto-merges until ten consecutive clean audits.

## Consequences

- The protected-path list (`loop-policy.md` §2) is the audit surface and **must be kept current**
  as the codebase grows — domain-critical paths (the the external system integration, the core algorithms,
  credential handling) join it when they land.
- The Tier-1 human approval was waived by the solo sovereign at genesis (Article III); it can
  be reinstated by a future ADR if the team grows or the metrics warrant it.
- Governance changes are themselves germline — amended only by a CODEOWNERS-reviewed PR.
