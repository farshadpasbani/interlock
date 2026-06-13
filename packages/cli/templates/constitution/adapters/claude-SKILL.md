---
name: master-loop
description: Run the autonomous-development controller (the "brain stem") for this repo — one homeostatic cycle. Triggers on /master-loop, "run the loop", "work the fleet". NOT for one-off implementation tasks.
---

# Master Loop — Claude Code adapter

This is the **Claude Code binding** of a harness-neutral controller. The full operating
procedure — the cycle ladder, tier evaluation, the worker brief, the prohibitions — is the
single source of truth at **[`docs/agents/master-loop.md`](../../../docs/agents/master-loop.md)**.
Read it and follow it exactly; it is identical for every harness. This file only binds the
three neutral verbs to Claude Code primitives.

**Announce at start:** "Running the master loop — one homeostatic cycle. Status: <status>."

## Claude Code bindings (the *Harness adapters* row for this tool)

- **Spawn a worker / fix worker** → the **Agent** tool (a background sub-agent), given the
  self-contained brief from `master-loop.md`. Group by file surface; one worker per surface.
- **Dual review (Tier 1)** → two parallel **Agent** calls — a correctness lens and a structural
  lens — read on the next cycle.
- **Schedule the next cycle** → **ScheduleWakeup** (pass the same `/master-loop` prompt), or run
  under `/loop`. Pace by state: PRs in flight / red main → tight (~240s); idle → long (~1800s);
  `paused` → don't schedule.

## Everything else

Is in `docs/agents/master-loop.md` and is harness-neutral: reading the law each cycle, the
GitHub sense batch, the cycle ladder (0–9), tier evaluation, shadow-mode rules, the journal, and
the "what you must never do" list. **Do not duplicate or paraphrase it here** — read it live so
this adapter never drifts from the law. If the two ever disagree, `master-loop.md` wins.
