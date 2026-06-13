# Security Hardening Bundle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for Task 2 (behaviour change). Tasks 1 and 3 are dependency/doc changes verified by the commands listed under each. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three security gaps surfaced by an end-to-end review of the repo, without changing the action's public API or the gate's runtime behaviour:

1. **Dependency hygiene** — resolve the high-severity `undici` advisories pulled in transitively through `@actions/github`, and add Dependabot so deps don't rot again.
2. **Gate self-protection gap** — `buildPolicyYaml` only adds `.github/**` to Tier 2 when `.github/workflows` already exists, but the documented install flow adds the workflow *after* `init`. Result: a consumer's own Interlock workflow file ends up unprotected, so an agent PR could neuter the gate as a Tier-1 change. Always protect `.github/**`.
3. **Threat model is undocumented** — add `SECURITY.md` stating that Interlock is a governance *aid*, not a containment *boundary*, plus a disclosure channel.

**Out of scope (deliberate):** least-privilege token tightening (`pull-requests: write→read`) and README trust-boundary copy — deferred to a fast-follow. Repo-settings toggles (secret scanning, push protection, Dependabot security updates, private vulnerability reporting) were enabled out-of-band via the API and are not part of this PR.

**Tech Stack:** TypeScript (NodeNext ESM), Node 20+, vitest, esbuild. npm workspaces monorepo (single root lockfile).

---

## Files

```
package.json                              # Task 1 — `overrides` pin for undici IF needed
package-lock.json                         # Task 1 — regenerated
action/dist/index.cjs                     # Task 1 — rebuilt so CI's reproducibility gate stays green
.github/dependabot.yml                    # Task 1 — NEW
packages/cli/src/commands/init.ts         # Task 2 — always protect .github/**
packages/cli/test/init.test.ts            # Task 2 — RED test first
SECURITY.md                               # Task 3 — NEW
docs/superpowers/plans/2026-06-13-security-hardening.md  # this plan
```

---

## Task 1 — Dependency hygiene + Dependabot

- [ ] `npm ci`, then `npm audit` — capture the baseline (expect 6 high / 2 moderate via undici).
- [ ] Resolve the advisory with the **smallest blast radius**: prefer a root `package.json` `overrides` entry pinning `undici` to a patched version that satisfies `@actions/http-client`'s range, over `npm audit fix --force`. **Do NOT major-bump `@actions/github`** — that changes the action's API surface. If `overrides` can't resolve it cleanly, STOP and report rather than forcing a breaking bump.
- [ ] `npm install` to update the lockfile.
- [ ] Rebuild the action bundle: `npm run build -w action`. The committed `action/dist/index.cjs` must match (CI gate "Action bundle is reproducible").
- [ ] Add `.github/dependabot.yml`: ecosystems `npm` (directory `/`) and `github-actions` (directory `/`), `schedule.interval: weekly`, group minor+patch updates to keep PR noise down.

**Acceptance:** `npm audit` reports **0 high and 0 critical**; `npm run typecheck` and `npx vitest run` pass; `git diff --quiet -- action/dist` after rebuild; the bundle still reaches input parsing under the Actions loader (`node action/dist/index.cjs` exits 1 and mentions `github-token`); `.github/dependabot.yml` is valid YAML covering both ecosystems.

## Task 2 — Close the `.github/**` gate-protection gap (TDD)

- [ ] **RED:** in `packages/cli/test/init.test.ts`, add an assertion to the `hasWorkflows: false` case that `policy.tiers.tier2` contains `.github/**` (today it only asserts `interlock.yml`). Run vitest; confirm it fails.
- [ ] **GREEN:** in `buildPolicyYaml` (non-constitution branch), always push `.github/**` to `tier2`, removing the `if (d.hasWorkflows)` guard. Keep `interlock.yml`. Constitution mode (germlinePaths) is unchanged — it already lists `.github/workflows/**`.
- [ ] Confirm the whole `init` test file is green, including the `hasWorkflows: true` case (still contains `.github/**`).

**Acceptance:** `buildPolicyYaml({hasDocs:false,hasTests:false,hasWorkflows:false})` yields a policy whose `tier2` contains both `.github/**` and `interlock.yml`; all existing init tests still pass.

## Task 3 — SECURITY.md

- [ ] Add `SECURITY.md` at repo root with two sections:
  - **Threat model / what Interlock is and isn't.** Interlock is a *governance aid that makes agent-PR review legible*, not a *security containment boundary*. Its strength rests on three assumptions a reader should not over-trust: (a) **agent self-identification** — `classifyAuthor` is an allowlist; anything not matching the agent accounts/branches/trailers is treated as a human and gets the lenient tier; (b) **`mode: observe` is the default** — nothing is enforced until flipped to `enforce`; (c) **only the listed paths are protected**, with case-sensitive glob matching. State plainly: an adversarial agent that declines to self-identify routes around the strict path — Interlock governs *cooperating* agents.
  - **Reporting a vulnerability.** Direct reporters to GitHub's private vulnerability reporting ("Report a vulnerability" under the repo's Security tab). No public issue for security reports.

**Acceptance:** `SECURITY.md` exists, names the three trust assumptions, and points to GitHub private vulnerability reporting.

---

## Verification (run all before declaring done)

```bash
npm ci
npm audit                                              # 0 high, 0 critical
npm run typecheck
npx vitest run                                         # all pass, incl. new init assertion
npm run build -w action && git diff --quiet -- action/dist && echo "dist reproducible"
node action/dist/index.cjs 2>&1 | grep -q github-token && echo "bundle loads"
node packages/cli/scripts/embed-templates.mjs && git diff --quiet -- packages/cli/src/templates.generated.ts && echo "templates reproducible"
```

Then run the `verify-before-done` skill: exercise the unhappy paths (audit with no network, `init` in a repo with and without `.github/`), confirm environment parity (the CI gates above are the environment the action actually runs in), and confirm no invariant was left un-lifted (the gate's own config must be Tier 2 in *every* `init` path).

## Commits (one concern each)

1. `build(deps): pin undici to patched version; resolve audit advisories + add dependabot`
2. `fix(cli): always protect .github/** in default init policy`
3. `docs: add SECURITY.md with threat model and disclosure channel`
