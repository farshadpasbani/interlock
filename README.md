# Interlock

Deterministic governance gate for AI-agent pull requests. One policy file; protected paths + reversibility-tiered merge rules, enforced in CI whatever tool wrote the code.

## Why

Agents are fast and occasionally catastrophic. Reviewing every PR yourself kills the speed advantage; trusting everything kills the repo's invariants. Interlock is the dial between — and it's a fuse, not another AI: deterministic glob matching and rule evaluation, same verdict every time. No LLM judges your PR. The policy is a YAML file you can read and reason about in under five minutes, and the gate cannot silently fail open.

## The 10-minute install

1. **Initialise the policy:**

   ```bash
   npx agent-interlock init
   ```

   This writes `interlock.yml` at your repo root (in `observe` mode — reports verdicts without blocking anything) and prints the workflow snippet to paste.

2. **Add the workflow.** Paste what `init` printed, or create `.github/workflows/interlock.yml` with:

   ```yaml
   name: Interlock
   on:
     pull_request:
       types: [opened, synchronize, reopened]
   permissions:
     contents: read
     pull-requests: write
     issues: write
   jobs:
     interlock:
       runs-on: ubuntu-latest
       steps:
         - uses: interlock-dev/interlock@v1
   ```

3. **Open any PR.** Interlock posts its first verdict as a sticky comment, applies an `interlock:tier-N` label, and writes a job summary table (file → tier → matched rule). In observe mode the job always passes — you are watching, not blocking.

4. **When you trust the verdicts:** flip `mode: enforce` in `interlock.yml` and add `interlock` as a required status check in your branch protection settings. Minute 9 of the 10.

## The tiers

| Tier | Typical paths | Default treatment |
|------|--------------|-------------------|
| **Tier 0** | docs, tests, `**/*.md` | Behaviour-neutral — auto-merge candidate when CI is green |
| **Tier 1** | Everything not listed in tier0 or tier2 | Normal review — no special rule |
| **Tier 2** | CI config, auth, the policy file itself | Protected — humans only |

A few invariants worth knowing:

- **PR tier = MAX across all changed files.** One Tier 2 file in a thousand-file PR makes the whole PR Tier 2.
- **Renames count on both paths.** Moving a file out of a protected directory is not an escape hatch.
- **The policy is always read from the PR's base branch.** A PR cannot weaken the rule that judges it.
- **`interlock.yml` protects itself by default.** The gate cannot edit its own off-switch — it is a Tier 2 path in the generated policy.

## Policy reference

The annotated default `interlock.yml` (as written by `init` on a repo with `docs/` and `.github/workflows/`):

```yaml
# Interlock policy — https://github.com/interlock-dev/interlock
version: 1
mode: observe            # flip to "enforce" once you trust the verdicts

authors:
  agents:
    accounts: ["*[bot]"]
    branches: ["claude/*", "codex/*", "agent/*"]
    trailers: ["Co-Authored-By: Claude*", "Co-Authored-By: *Codex*"]

tiers:
  tier0:                 # behaviour-neutral — candidate for auto-merge when CI is green
    - "docs/**"
    - "**/*.md"
  tier2:                 # protected paths — humans only
    - ".github/**"
    - "interlock.yml"

rules:
  agent-on-tier2: block
  human-on-tier2: warn
```

### Key reference

| Key | Values | Description |
|-----|--------|-------------|
| `version` | `1` | Schema version. Only `1` is valid in v0.1. |
| `mode` | `observe` \| `enforce` | `observe` — report verdicts, never fail. `enforce` — apply rules, fail on violations. |
| `authors.agents.accounts` | glob list | GitHub LOGIN globs (Action) or git author name globs (CLI) identifying agent authors. |
| `authors.agents.branches` | glob list | Branch name prefixes treated as agent-authored regardless of commit authorship. |
| `authors.agents.trailers` | glob list | Git trailer patterns (last paragraph of commit message only) that mark a commit as agent-authored. |
| `tiers.tier0` | glob list | Paths whose changes are behaviour-neutral — docs, tests, markdown. |
| `tiers.tier2` | glob list | Protected paths — CI config, auth code, the policy file. Tier 1 is everything else. |
| `rules.agent-on-tier2` | `block` \| `warn` | What happens when an agent author touches a Tier 2 path. |
| `rules.human-on-tier2` | `warn` \| `require-review` | What happens when a human author touches a Tier 2 path. |

### Rule × mode matrix

| Rule setting | `observe` mode | `enforce` mode |
|-------------|---------------|---------------|
| `block` | Violation reported in comment/summary; job succeeds | Check fails; PR cannot be merged via required status |
| `require-review` | Violation reported; job succeeds | Check fails until ≥ 1 human approval is present |
| `warn` | Violation reported; job succeeds | Violation reported; job still succeeds |

## How author detection works

Author classification happens in two places with slightly different inputs — the Action is the source of truth in CI, the CLI is an advisory pre-flight:

- **GitHub Action:** classifies by the PR author's GitHub **login**. This is what runs in CI and what matters for enforcement. `*[bot]` matches GitHub's bot-account suffix (e.g. `github-actions[bot]`).
- **Local CLI (`check`):** classifies by the git commit author **name** from the local history. Useful as a smoke-test before pushing, but the login and the name can differ for the same commit (particularly for bot accounts).

The three signals are OR-ed: an author is treated as an agent if **any** of the following match:

1. `accounts` glob matches the author's login/name.
2. `branches` glob matches the PR branch name.
3. `trailers` glob matches a git trailer in the commit message.

**Trailers** follow the standard git trailer convention: only the last paragraph of the commit message is scanned for `Key: Value` lines. A `feat: add thing` subject line is not a trailer and is never matched.

## CLI

```bash
npx agent-interlock init [--force]
npx agent-interlock check [--base <ref>] [--json]
npx agent-interlock explain <path>
```

| Command | Description |
|---------|-------------|
| `init` | Detects repo structure, writes `interlock.yml`, prints the workflow snippet. `--force` overwrites an existing policy. |
| `check` | Diffs the working branch against `<ref>` (default: `main`), classifies changed files, applies rules, prints a verdict table. `--json` emits machine-readable JSON. |
| `explain <path>` | Prints which rule matches the path, its tier, and why. Useful for debugging policy glob order. |

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0` | Pass, or warn-only violations (nothing stronger than `warn`) |
| `1` | Blocking violation — at least one violation with a setting stronger than `warn` |
| `2` | Config/input error — missing or invalid policy, bad base ref, malformed paths |

## Failure semantics

Interlock fails like a safety device, not a network call:

- **Invalid policy → loud failure.** The check fails with the parse error; the CLI exits 2. Never fail-open — a guard with a broken sensor stops the machine.
- **Missing policy → neutral hint.** The Action reports that no `interlock.yml` was found and suggests running `init`; it does not fail the build.
- **Oversized policy (> 1 MB) → loud refusal.** Rejected explicitly rather than silently treated as absent.
- **API errors → one retry, then fail with reason.** Transient GitHub API failures get one automatic retry; persistent failures surface the HTTP status and body so you know why.

## Roadmap

- **v0.2:** Claude Code hook adapter — the same `interlock.yml` enforced at the harness level, pre-commit, before a PR even exists.
- **v0.3:** Opt-in Tier-0 auto-merge — when all changed files are Tier 0 and CI is green, Interlock merges automatically.

Full design spec: [docs/superpowers/specs/2026-06-12-interlock-v0.1-design.md](docs/superpowers/specs/2026-06-12-interlock-v0.1-design.md)

---

Apache-2.0 © 2026 Farshad Pasbani
