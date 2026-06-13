# Working with the agent fleet — a field guide for humans

New to this repo? Start here. This is the plain-English explainer; the formal documents it
points to add the depth once you want it. **You do not need to read the Constitution to be
productive** — you need this page.

## The two-minute version

This repo is partly built by **AI agents** working autonomously, and partly by **you**. To stop
that from being chaos, the repo carries a written **Constitution**: a set of rules for what the
agents may do on their own, what always needs a human, and what they may never touch.

The guiding idea, in one line: **the agents handle the mechanical work consistently; humans make
the judgement calls.** The agents write code, run tests, open PRs, fix the build. You decide what
should be built, whether it's *right*, and you hold the off-switch.

If you've ever managed a capable but junior team, you already have the model: delegate the
well-defined work, stay close on the decisions that carry real consequences.

## Your role: you're the "sovereign"

The Constitution calls the human **sovereign** (listed in
[`.github/CODEOWNERS`](../../.github/CODEOWNERS)). In practice that means three things are
*yours*, and the fleet can never take them:

1. **The judgement calls** — what to build, and whether an answer is engineering-correct.
2. **The protected code** — the safety-critical paths (see below) only ever merge with your review.
3. **The off-switch** — you can pause the whole fleet at any time (see *Stop everything*).

## The day-to-day: what you actually do

| You see… | What it means | What you do |
|---|---|---|
| A PR labelled **`in-review`** | An agent finished work and opened a PR | Review it like any teammate's PR. How much scrutiny depends on its **tier** (below). |
| A PR labelled **`would-auto-merge`** | We're in commissioning (*shadow*) — this PR *would* have merged automatically | **Audit it.** Does it look right? This is how the fleet earns trust (see *Right now*). |
| An issue labelled **`needs-engineer`** | An agent hit a **decision** it shouldn't make alone | Answer the numbered questions on the issue — tersely is fine. The agent picks it back up. |
| An issue labelled **`blocked`** | An agent hit a **failure** it couldn't fix | Help debug, or reassign. (Different from `needs-engineer`: that's "decide for me", this is "I'm stuck".) |
| You want new work done | — | File a GitHub issue, or add a theme to [`../ROADMAP.md`](../ROADMAP.md). The fleet only works on things humans asked for. |
| You want to run the loop yourself | — | See *Running the loop* below — it works from whatever AI tool you use. |

### The tiers — how much a PR needs you

Every PR falls into one of three tiers, by **how bad it is if it's wrong** (not by size):

- **Tier 0 — docs, tests, chores.** Behaviour-neutral. Merges automatically once CI is green. You don't need to look.
- **Tier 1 — ordinary features and fixes.** Merges on green CI + both agent reviews. The human counter-signature was **waived at genesis** (solo sovereign — see [Constitution](./CONSTITUTION.md) Article III). You can reinstate it anytime by amendment.
- **Tier 2 — the protected paths.** The safety-critical code, the CI gates, the governance docs themselves — and this repo's own core engine (`policy.ts`, `gating.ts`, `classify.ts`, `interlock.yml`, `action/dist/**`). **Always a human, no exceptions.** As the critical integrations and the core algorithms land, they join this list — see [`loop-policy.md`](./loop-policy.md) §2.

One line touching a protected path makes the whole PR Tier 2. When in doubt, the fleet escalates *to* you, never away.

## Right now: we're in "shadow mode"

The fleet is **commissioning**. In shadow mode it runs the full process but **merges nothing** —
it just labels PRs `would-auto-merge` and leaves them for you. Your job during commissioning:
**audit those PRs.** Once ten in a row are clean, flip the switch to `live` and
auto-merge (Tiers 0 and 1) turns on. Until then, every merge is still yours. Nothing lands
on `main` behind your back.

## Running the loop (any tool)

The controller is **tool-neutral** — Claude Code, Cursor, Codex, or otherwise. Tell your agent to
"run the master loop" and it will read [`master-loop.md`](./master-loop.md) and follow it. The
*Harness adapters* table at the bottom of that file says how your specific tool spawns workers and
paces cycles. You don't have to babysit it; you respond when it flags `needs-engineer` or a
Tier-2 PR.

## Stop everything (the kill switch)

Open [`loop-policy.md`](./loop-policy.md), set `status: paused` at the top, commit. The fleet
halts at the start of its next cycle and does nothing until a human sets it back. The fleet
*cannot* un-pause itself — that switch is wired to you alone.

## "What this is NOT" — for the reasonably skeptical

- **It is not the AI merging to `main` unchecked.** Safety-critical code is Tier 2: always human. Right now (shadow) *nothing* auto-merges at all.
- **It is not replacing engineering judgement.** The fleet executes; it does not decide what's correct. That stays with you, by design.
- **It is not a black box.** Every cycle is logged to a journal issue; every rule is in these files; every protected path is in one short list you can read in a minute.
- **It is not locked to one AI vendor.** The law is harness-neutral — switch tools freely.
- **It is dogfooding the product.** This repo uses its own Interlock gate on all PRs — you'll see it stamp tier and policy verdicts as a sticky comment. If something looks wrong with the verdict, it's also a bug report.

## The mental model (optional, for the curious)

The Constitution is written as a *physiological charter* — it treats the fleet like a living body
that defends its own health (a green build, reviewed code, a memory that stays accurate) the way
your body holds its temperature, without you thinking about it. It's a memory aid, not a
requirement. If that framing helps, read [`CONSTITUTION.md`](./CONSTITUTION.md). If it doesn't,
this page and the tier table are all you need.

## Where to find what

| I want to… | Read |
|---|---|
| Understand my day-to-day | **this page** |
| Set the repo up / enforce the rules (admin, one-time) | [`SETUP.md`](./SETUP.md) — branch protection, labels, commissioning |
| Know the exact rules (tiers, protected paths, labels) | [`loop-policy.md`](./loop-policy.md), [`triage-labels.md`](./triage-labels.md) |
| Understand *why* the repo works this way | [`CONSTITUTION.md`](./CONSTITUTION.md), [`../adr/0001-adopt-agent-governance.md`](../adr/0001-adopt-agent-governance.md) |
| Run the loop from my AI tool | [`master-loop.md`](./master-loop.md) |
| Know the project's commands & conventions | [`../../AGENTS.md`](../../AGENTS.md) |
