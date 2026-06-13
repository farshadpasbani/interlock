# Loop Policy — autonomic settings for the agent fleet

Enacts **Articles III, IV, and X** of the [Constitution](./CONSTITUTION.md). The Constitution
is the law; this file is the dials. The brain stem (the controller at
`docs/agents/master-loop.md`, bound to each agent tool by a thin adapter) reads this file
**fresh at the top of every cycle**.

> **Germline (Article X).** This file is a Tier-2 protected path. The fleet reads it every
> cycle and may **never** edit it. Only a CODEOWNERS human — a reviewed, merged change —
> alters these dials.

---

## 1. Machine-readable state

```yaml
status: shadow              # live | shadow | paused  — the kill switch (Article IV)
shadow_clean_required: 10   # consecutive would-auto-merge PRs a sovereign must audit clean to go live
shadow_clean_count: 0       # a sovereign increments this as audits pass; any dirty audit resets it to 0
worker_cap: 3               # max concurrent worker agents
replenish_below: 6          # ready-for-agent depth that triggers replenishment — 2× worker_cap
stale_after_cycles: 2       # in-progress with no commit activity for this many cycles → reclaim
journal_issue: null         # the pinned Loop Journal issue number; set once created
```

`paused` → cycle stops at step 0. `shadow` → full cycle, **no merges**, qualifying PRs get
`would-auto-merge` and rest at `in-review`. `live` → qualifying PRs merge per tier. The team
flips `shadow → live` only after `shadow_clean_count` reaches `shadow_clean_required`.

---

## 2. The autonomic boundary — tiers (Article III)

Worst-wins: one protected line makes the whole PR Tier 2.

### Tier 0 — pure autonomic · merge on green CI alone · single review
A PR whose diff touches **only**: `docs/**`, `**/*.md` (except the semantic-authority docs
below), `tests/**`, `.gitignore`, lockfile-only dependency bumps. Behaviour-neutral.

### Tier 1 — reflexive, witnessed by both review agents · merge on green CI + both review agents clean
Anything not Tier 0 and touching no protected path. The human approval requirement was waived
by the solo sovereign at genesis (Article III); it can be reinstated by amendment (Article X).

### Tier 2 — somatic · always a CODEOWNERS human · no exceptions
A PR is Tier 2 if it touches any **path glob** or trips any **content trigger** below.

**Germline path globs (present from day one):**
- `docs/agents/CONSTITUTION.md`
- `docs/agents/loop-policy.md` — this file
- `docs/agents/master-loop.md` — the controller's own operating procedure
- `.claude/skills/master-loop/**`, `.cursor/rules/master-loop.mdc`, and any other per-tool
  controller adapter — the brain stem must not rewrite how it runs on any harness
- `.github/workflows/**` — the gates (Article II interlock)
- `.github/CODEOWNERS` — the cortex's own membership

**Domain path globs — KEEP THIS LIST CURRENT (Article III).** The repo has no application
code yet. As it grows, add the paths whose worst outcome is hard to reverse. Likely
candidates for this project, to add when they land:
{{GERMLINE_GLOBS}}

**Content triggers (read the diff):**
- Any new or changed **credential / licence / secret handling** or external network egress.
- Any change to a numerical constant that carries an engineering or code citation (a sourced
  number is an engineering assertion wherever it lives).
- **Semantic authority:** a hunk in `CONTEXT.md` that adds or changes a **term definition**
  (not a typo fix), or a **new ADR / any change to an existing ADR's `Status`/`Decision`** —
  these are `needs-engineer` proposals, never silent Tier-0 merges (Article XI).

> Drawn by **reversibility of harm, not by size**. Moving a path across this boundary is a
> constitutional amendment (Article X).

---

## 3. The cycle ladder (Articles I, IV, VI)

Correct the **largest deviation** in this order:
1. **Kill switch** — `paused` → stop.
2. **Reflex: red `main`** — first **classify the red** (a reflex fires on a wound, not a blackout):
   - **Code-red** — a job actually ran and failed (real test / lint / type / build break): hard
     halt; dispatch one fix worker against the break; record; neural-notify; sleep. *Stop the bleed.*
   - **Gate-down** — CI *could not run*: Actions quota / minutes / billing exhausted,
     `startup_failure`, no run for the head SHA, or every job failing in seconds at setup. This is a
     tooling outage, not a code bug. **Do not dispatch a fix worker** (it cannot fix billing).
     **Hold all merges** (a dead gate can't certify green — the innate immune system is offline) and
     **pause new dispatch** (don't pile up PRs nothing can verify). **Neural-notify the human to
     restore CI.** Still run the bookkeeping rungs (inbox, reclaim, journal). Resume automatically
     once a real CI run goes green. *Restore the power; don't operate in the dark.*
3. **Fold answered inbox** — `needs-engineer` with a fresh team reply → fold in, flip to `ready-for-agent`.
4. **Service open PRs** — merge (or `would-auto-merge`-label) qualifying greens by tier; fix worker on red PR CI.
5. **Reclaim stale work** — `in-progress` idle ≥ `stale_after_cycles` → back to the queue.
6. **Dispatch** — workers onto ready nodes, grouped by file surface, up to `worker_cap`.
7. **Replenish** — only if `ready` depth < `replenish_below`, external signal only.
8. **Record** — journal + metrics + notifications.

---

## 4. Replenishment sources (Article V — self/non-self)

In priority order, anchored **outside the fleet**:
1. **Team-filed issues** labelled `needs-triage` or already specified.
2. **`docs/ROADMAP.md`** — team-authored themes. The loop **reads** it; never writes it.
3. **Doc-vs-code drift** noticed while doing real work (Article XI) → small reconciliation task.

**Honesty rule:** fully specified → `ready-for-agent`; underspecified → a draft-spec issue +
a `needs-engineer` question; never an invented spec. A review agent's unprompted suggestion →
`needs-triage` only.

---

## 5. Labels

| Label | Meaning | Set by |
|---|---|---|
| `ready-for-agent` | Fully specified, ready for a worker | team / replenishment |
| `needs-triage` | Filed, awaiting team specification | anyone |
| `in-progress` | A worker has claimed it | brain stem |
| `in-review` | PR open, awaiting merge decision | worker |
| `needs-engineer` | A *decision* referred to the team (decide-for-me) | worker |
| `blocked` | A *failure* needs a human (debug-me) | worker |
| `would-auto-merge` | Shadow mode: this PR *would* have merged; audit it | brain stem |

---

## 6. Notifications (Article IX — four triggers only)

New `needs-engineer` questions · a red-`main` halt (code-red) · a **gate-down** (CI can't run —
restore quota/billing) · a shadow batch ready for audit · a loop error. Everything else is
hormonal (the journal).

---

## 7. Model & effort assignments

Two dials set the cost↔quality tradeoff per role: the agent's **capability tier** and its
**reasoning effort**. Spend where being wrong is expensive (planning, review); economise where the
plan already constrains the risk (grunt implementation, bookkeeping).

**This is provider-neutral.** Teammates run different agent tools (Claude, OpenAI/Codex, Gemini,
…) with different models and different reasoning controls. The **roles below are the law**; the
concrete model names are a **per-tool mapping** each person fills for their own setup. Map onto
whatever you have — don't block on a specific vendor's model.

**The roles (universal):**

| Role | Capability tier | Reasoning effort |
|---|---|---|
| **Orchestrator** (this controller) | capable / mid | standard — it senses, classifies tiers, dispatches, journals; no deep reasoning, no code |
| **Implementer** (worker) | workhorse (fast, cheap) | standard; **low** for trivial Tier-0 chores |
| **Planner / decomposition** | frontier (strongest) | high |
| **Reviewer / tests** (correctness > cost) | frontier | high; **max** where a miss is unrecoverable (protected-path review) |

**The mapping (fill your tool's row; add rows for tools teammates use):**

| Provider / tool | workhorse | frontier | reasoning-effort control |
|---|---|---|---|
| **Anthropic — Claude Code** *(example, current)* | `claude-sonnet-4-6`; `claude-haiku-4-5` (cheapest impl) | `claude-opus-4-8`; `claude-fable-5` (ceiling) | `output_config.effort` = low/medium/high/xhigh/max. **`xhigh` only on Fable 5 / Opus 4.7–4.8**; Sonnet caps at high/max; **Haiku 4.5 has no effort — omit it** |
| **OpenAI — Codex** | _your fast tier_ | _your reasoning tier_ | `reasoning_effort` (low/medium/high), where supported |
| **Google — Gemini** | _Flash-class_ | _Pro-class_ | thinking budget / thinking config, where supported |
| **Your tool** | _fill in_ | _fill in_ | _its effort control, or "none"_ |

**Effort, in brief:**
- Default to **standard**; raise it only where the role *and* the model both warrant it. Lower
  effort → fewer, terser tool calls and fewer tokens.
- **Non-monotonic on cost:** on agentic work, *higher* effort up front often *lowers* total spend
  by cutting turn count — pair it with the self-contained worker brief (§ dispatch), which gives
  the full task spec up front.
- "Reasoning effort" goes by different names per provider, and **some cheap models don't expose it
  at all** — where a model has no effort knob, just omit it.
- Both dials are **advisory** — applied where the harness exposes them (fully on API/SDK dispatch;
  partially in an interactive session). A sovereign overrides per-task only by saying so.

Model lineups age fast — re-confirm concrete names against your provider's current reference, and
edit only the **mapping** rows, never the role principle. Read this section fresh each cycle.

---

## 8. Process glossary

Domain vocabulary lives in `CONTEXT.md`. These are *process* terms only.

- **Cycle** — one homeostatic scan: sense → correct the largest deviation → record → sleep.
- **Brain stem** — the controller. Dispatches; never writes code.
- **Worker / hands** — an agent that writes code in an isolated worktree.
- **Tier** — a PR's autonomy class (0/1/2), by reversibility of harm.
- **Shadow** — commissioning mode: full cycle, no real merges, audit instead.
- **Sovereign** — any CODEOWNERS human (the cortex is plural here).
- **Referred pain** — a `needs-engineer` question: flag the decision, keep working.
