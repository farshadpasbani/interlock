# Interlock v0.1 — Design

**Date:** 2026-06-12
**Status:** Approved (brainstorm session 2026-06-12)
**Repo home:** `interlock-dev/interlock` (GitHub org to create) · npm: `agent-interlock` · License: Apache-2.0

## What Interlock is

A tool-neutral governance gate for repositories where AI coding agents open pull requests:
**protected paths + reversibility-tiered merge rules, enforced deterministically in CI** —
regardless of which harness (Claude Code, Codex, Cursor, GitHub Actions bots) authored the
change. One policy file, `interlock.yml`, is the single source of law; thin adapters enforce
it on every surface.

In machine-safety engineering, an interlock physically prevents a machine from operating
while the guard is open. This is that, for merges.

## Why (business context, condensed)

- Market scan (2026-06-12, 24 sources, adversarially verified) confirmed: platforms ship
  partial, vendor-locked governance primitives; **tool-neutral cross-platform merge
  governance is open**. Microsoft's Agent Governance Toolkit is runtime-security-shaped and
  leaves merge/repo governance unaddressed.
- Wedge: cross-platform protected-paths + tiered auto-merge gate over GitHub Actions /
  Codex / Claude Code. Verdict: micro-SaaS-sized — matching the founder's goal.
- Validation instrument: OSS adoption curve (installs / stars / npm downloads as reach;
  kill rule = flat conversion-given-reach for 6–8 weeks post-launch).
- Constraints: solo bootstrapper, product-only, £200–300/mo total burn → **zero-hosting
  architecture for v0.x** (everything runs on the user's compute).
- Prototype: the founder's personal agent constitution (`~/.claude/constitution/`) — prose
  law executed by LLM controllers. Interlock extracts its enforceable core (tiers by
  reversibility of harm, protected paths, author classes) and makes it deterministic code.
  The product is the law without the sermon.

## Day-1 adopter and the 10-minute path

**Adopter:** the solo agentic builder running Claude Code / Codex fleets on their own repos.

**The 10 minutes:**
1. `npx agent-interlock init` → interactive scaffold writes `interlock.yml` (~3 min)
2. Add the Action workflow file (printed by `init`, one paste) (~2 min)
3. Open any PR → tier verdict appears as check + comment + label (the wow) (~2 min)
4. Optional, documented as "minute 9": flip `mode: enforce` and make the check required in
   branch protection.

**First wow = passive tier verdict on every PR.** No merge rights requested on day 1; the
tool earns trust in observe mode first (the product's own onboarding mirrors
shadow-commissioning). Auto-merge is a later opt-in (v0.3).

## Architecture — CLI engine + thin adapters (Approach C)

```
interlock/                     (monorepo, npm workspaces, single version)
  packages/core/               # the engine: policy schema + classify() — pure, no I/O
  packages/cli/                # agent-interlock: init / check / explain
  action/                      # GitHub Action wrapper (bundled JS, calls core)
  docs/
  interlock.yml                # dogfood: Interlock governs its own repo
```

The engine is a pure function; adapters are thin. Tool-neutrality is a property of the
architecture, not a roadmap slide. Stack: TypeScript, Node 20+. Glob matching: picomatch.
Policy validation: zod.

### The policy file — `interlock.yml`

```yaml
version: 1
mode: observe            # observe = verdicts only · enforce = check fails on violations

authors:
  agents:
    accounts: ["*[bot]", "my-agent-account"]     # PR author account globs
    branches: ["claude/*", "codex/*", "agent/*"] # head-branch prefixes
    trailers: ["Co-Authored-By: Claude*", "Co-Authored-By: *Codex*"]  # commit trailers
  # any PR not matching an agent pattern is treated as human-authored

tiers:
  tier0:                 # behaviour-neutral — candidate for auto-merge when CI is green
    - "docs/**"
    - "**/*.md"
    - "tests/**"
  tier2:                 # protected paths — the germline
    - ".github/**"
    - "interlock.yml"    # default: the gate cannot edit its own off-switch
    - "src/auth/**"      # (init suggests candidates; user edits)
  # everything else = tier1 — ordinary reviewed change

rules:
  agent-on-tier2: block  # block | warn
  human-on-tier2: warn   # warn | require-review
```

**Rule semantics by mode:** a rule produces a *violation*. In `observe` mode violations are
reported (comment/check summary) but the check succeeds. In `enforce` mode: `block` → the
check fails while the violation exists; `require-review` → the check fails until at least
one human-classified (non-agent) approval exists on the PR; `warn` → reported, never fails
the check.

**Semantics:**
- A PR's tier = **max tier across its changed files** (tier2 > tier1 > tier0). One
  protected file makes the whole PR Tier 2.
- Author classification: a PR is agent-authored if **any** of account glob, branch glob, or
  any commit trailer matches. Otherwise human.
- Renamed files count as both old and new path. Deleted files count as touching the path.
- `interlock.yml` is itself tier2 by default (the interlock rule, self-applied). `init`
  writes it; removing it is the user's sovereign right and their funeral.

### The engine — `packages/core`

```ts
classify(changedFiles: ChangedFile[], author: AuthorInfo, policy: Policy): Verdict

Verdict = {
  tier: 0 | 1 | 2,
  perFile: [{ path, tier, matchedRule }],
  violations: [{ kind: "agent-on-tier2" | ..., paths, ruleSetting }],
  requirements: string[],          // human-readable: what this PR needs to merge
}
```

Deterministic, no network, no side effects. Policy parse errors throw a typed error with a
human-readable message (line/field).

### The CLI — `packages/cli` (`agent-interlock`)

- `init` — interactive scaffold: detects docs/tests directories, proposes protected-path
  candidates (`.github/**`, CI configs, the policy file itself), writes `interlock.yml`,
  prints the Action workflow snippet to paste.
- `check [--base <ref>] [--json]` — classifies the current branch's diff against base.
  Human-readable verdict table; `--json` for machines. Exit codes: 0 = pass or warn-only,
  1 = blocking violation (stronger than warn), 2 = config/input error.
- `explain <path>` — prints which rule matches the path, its tier, and why.

### The GitHub Action — `action/` (`interlock-dev/interlock@v1`)

- Trigger: `pull_request` (opened, synchronize, reopened).
- Reads changed files + author metadata from the GitHub API (no full clone needed), runs
  the engine, then writes three things:
  1. **Check run** — pass/fail/neutral with a summary table (file → tier → matched rule).
  2. **Sticky PR comment** — marker-based, updated in place on each push.
  3. **Label** — `interlock:tier-0|1|2`.
- `mode: observe` → check always succeeds (neutral on violations, verdict still visible).
- `mode: enforce` → check fails on violations; user adds it as a required status check
  (documented one-liner).
- Permissions requested: `pull-requests: write`, `issues: write`, `contents: read` — labels/comments go through the issues API; no `checks: write` needed (the job itself is the check); no merge rights in v0.1.

## Failure semantics — fails like a safety device

- **Invalid policy → loud failure.** Check fails with the parse error; CLI exits 2. Never
  fail-open: a guard with a broken sensor stops the machine.
- **Missing policy → neutral check** with a one-line "run `npx agent-interlock init`" hint.
  First-touch funnel, not a punishment.
- **GitHub API errors → bounded retry, then fail with reason.** In enforce mode there is no
  silent pass.

## Testing

- **Engine:** fixture-table tests — `(policy, changedFiles, author) → expected Verdict` —
  covering tier precedence, overlapping globs, rename/delete edges, and the author-detection
  matrix (account × branch × trailer). TDD throughout. Invariant test: adding a file to a PR
  never lowers its tier (monotonicity).
- **Action:** unit tests with recorded API fixtures; E2E smoke against a real sandbox repo
  in CI.
- **Dogfood:** Interlock runs on Interlock's own repo from the first PR, and the repo is
  scaffolded with the founder's `/constitution-init` — a governed agent fleet building the
  governor. That recursion is also the launch story.

## Scope

**v0.1 (the validation instrument):**
- `packages/core` engine + policy schema
- CLI: `init`, `check`, `explain`
- GitHub Action: verdict check + sticky comment + label, observe & enforce modes
- Docs: README with the 10-minute path; GitHub Marketplace listing

**v0.2:** Claude Code hook adapter — the same `interlock.yml` blocks protected-path edits
locally at the harness level (the cross-platform proof in code).

**v0.3:** Tier-0 auto-merge — opt-in flag; enables GitHub native auto-merge on qualifying
PRs (requires `contents: write`; gated behind explicit policy setting).

**Post-traction (v0.4+):** constitution template pack — an optional scaffold of the full
agent-fleet operating manual (the founder's constitution), via `interlock init
--with-constitution` and/or a companion `interlock-dev/constitution` repo. **Published
beside the product, never bundled into the core:** Interlock stays the deterministic fuse a
stranger installs in 10 minutes; the constitution is the philosophy layer believers opt
into after the gate has earned trust. The constitution also serves as the flagship launch
content piece (the "governed fleet built this governor" story).

**Explicitly out of scope for v0.x:** hosted services, org-wide policy, dashboards, GitLab/
Bitbucket, audit exports — that is the paid team layer, gated on the adoption curve.

## Success criteria & kill rule

- **Reach:** marketplace installs, npm downloads, GitHub stars (denominator).
- **Conversion:** repos with `interlock.yml` committed / repeat CI runs (numerator).
- **Kill rule:** flat conversion-given-reach for 6–8 consecutive weeks post-launch with
  non-trivial reach → kill or pivot. (Flat with *zero* reach is a distribution failure, not
  a product verdict — fix reach first.)

## Open questions (deferred, not blocking)

- npm scope: unscoped `agent-interlock` vs scoped `@interlock-dev/cli` — decide at publish.
- Marketplace listing name availability ("Interlock" listing title) — check at publish.
- Whether `init` should detect existing agent bot accounts from repo PR history (nice v0.2
  touch).
