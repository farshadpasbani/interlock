# Setup & commissioning — making the Constitution enforceable

A one-time runbook for the repo admin. The Constitution describes the rules; **this turns them
from prose the sovereign agreed to into rules GitHub enforces.** Until Step 1 is done, the tiers are a
gentleman's agreement — anyone (or any agent) can push straight to `main`.

> This file is a runbook, not law — edit it freely. It is the *last* change that may land on
> `main` without the gate, because it is the change that closes the gate.

---

## Step 1 — Branch protection on `main` (the critical one)

Two ways: the GitHub UI (click-through) or the API (reproducible). Either gives the same result.

### Option A — GitHub UI

**Settings → Branches → Add branch ruleset** (or *Add classic branch protection rule*) for
`main`, and enable:

| Setting | Enforces | Constitution |
|---|---|---|
| **Require a pull request before merging** | the hands cannot self-merge; nothing reaches `main` un-PR'd | Art. II, III |
| → **Require approvals: 1** | the human counter-signature on Tier-2 work | Art. III (Tier 2) |
| → **Require review from Code Owners** | the sovereign gates Tier-2 / germline changes | Art. II, III, X |
| → **Dismiss stale approvals on new commits** | re-review after the diff changes | Art. III |
| **Require status checks to pass** → select **`checks`** | `main` is always green; CI is the innate-immunity gate | Art. I, V |
| → **Require branches to be up to date before merging** | no merge onto a stale base | Art. I |
| **Do not allow bypassing the above settings** (a.k.a. *include administrators / enforce_admins*) | no organ sits above the law — even the sovereign goes through review | Art. II interlock |
| **Block force pushes** | history is not rewritten under the fleet | Art. VIII |
| **Restrict deletions** | `main` cannot be deleted | — |

The status check named **`checks`** is the job in `.github/workflows/ci.yml`. It only appears in
the picker *after the first CI run* — if you don't see it, push any commit / open any PR once,
let CI run, then add it.

### Option B — API (reproducible)

`gh` must be authenticated with admin on the repo. Then:

```bash
env -u GITHUB_TOKEN gh api -X PUT repos/interlock-dev/interlock/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["checks"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

> **Note on solo Tier-1:** The human gate on Tier-1 PRs was waived at genesis (Constitution
> Article III). The branch protection above still requires 1 approval for Code Owner paths
> (Tier 2). For Tier-1 PRs the agent loop merges on dual-agent-review + green CI once
> `status: live`. You can reinstate the human gate on Tier-1 at any time by amendment (Article X).

---

## Step 2 — Create the labels

The fleet speaks in labels. Create them once (the exact `gh label create` block lives in
[`triage-labels.md`](./triage-labels.md)). Run it from an environment authenticated for the repo,
or create the labels in the GitHub UI under **Issues → Labels**.

## Step 3 — Open the Loop Journal

Create one pinned issue titled **"Loop Journal"** — the fleet writes one comment per cycle there
(Constitution Article IX). Then set its number in [`loop-policy.md`](./loop-policy.md):
`journal_issue: <number>`. (That edit is germline — it goes through a PR.)

## Step 4 — Populate CODEOWNERS

[`.github/CODEOWNERS`](../../.github/CODEOWNERS) currently lists the sovereign (`@farshadpasbani`).
For solo operation, CODEOWNERS with a single owner means Tier-2 PRs need that owner's review —
which is the intended behaviour. If a second engineer joins, add them here and the cortex becomes
genuinely plural.

## Step 5 — Commission in shadow, then go live

The fleet boots in `shadow` (`loop-policy.md` → `status: shadow`): it runs every cycle but
**merges nothing**, labelling would-be merges `would-auto-merge` for you to audit. When **ten
consecutive `would-auto-merge` PRs** have been audited clean, flip
`status: live` (a germline edit — by PR). Auto-merge for Tiers 0 and 1 then turns on; Tier 2 stays
human forever.

## Step 6 — Optional: the event-driven pacemaker (sessionless — costs API tokens)

**Most people should skip this.** You wake the loop the free way — `/master-loop` once (it
self-paces while your session is open), `/loop /master-loop`, or a cloud `/schedule` — all on
your Claude Code subscription, no extra API billing. The pacemaker below makes the loop run with
**no live session at all**, but every wake spends **metered Anthropic API tokens**, so only add
it if you accept that cost. To enable it:

1. Add the repo secret `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions).
2. Install the Claude GitHub App: https://github.com/apps/claude
3. Add `.github/workflows/loop-tick.yml` (from the template's `pacemaker/`) via a PR — it's
   germline. It wakes on issue/PR/review/CI events + a 6-hour cron, runs one controller cycle
   headless, and respects `status: paused`.

Best enabled **after** you've gone `live` (Step 5).

---

## Verify

After Step 1, confirm the gate is real — try to push a trivial commit straight to `main`:

```bash
git commit --allow-empty -m "test: protection" && env -u GITHUB_TOKEN git push origin main
```

It should be **rejected** ("protected branch hook declined"). If it goes through, protection is
not active — recheck Step 1. (Delete the test commit afterward: `git reset --hard origin/main`.)
