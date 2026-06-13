# Don't orchestrate your agents. Give them a brain stem.

*Second essay — the deep-dive on the loop. The manifesto makes the case for governing agents;
this one shows the engine that does the governing. The loop is the selling point — lead with it.*

---

Most "agentic coding" still has a human in the middle of every cycle. You prompt an agent, it
works, you review, you merge, you prompt the next one. The agent is autonomous; the *workflow*
is not. You've automated the typing and kept the babysitting.

The piece that removes the babysitter — without removing the safety — is a **loop**. Not a
script that fires agents at a queue, but a controller that runs the way a body runs the
thousand things it never troubles you with. I call it the brain stem, and it's the part of
this system I'd actually sell you.

## One cycle, and only one job

The loop wakes, does exactly one thing, records it, and goes back to sleep. That one thing is
never "make progress." It's **correct the single largest deviation from where things should
be.**

> Sense → correct the largest deviation → record → sleep.

That inversion is the whole trick, and it's the same one the [constitution](https://github.com/interlock-dev/interlock/blob/main/docs/agents/CONSTITUTION.md)
is built on: a healthy system isn't goal-seeking, it's deviation-correcting. A loop told to
maximise throughput fills your repo with confident busywork. A loop told to defend a set of
setpoints — `main` is green, nothing merges unreviewed, no teammate is ever blocked waiting on
it — stays quiet when nothing's wrong and acts decisively when something is. An organism that
acts when nothing is wrong isn't healthy; it's feverish.

The cycle is **stateless in the agent's context and stateful in the world.** Nothing is held
in a conversation between runs — every fact is read back from GitHub at the top of the cycle
and written back to GitHub at the bottom. Lose the process, lose nothing. The repository is
the memory; the agent is just the thing that reads it this minute.

## The regulator never touches the code

The first law of the loop: **the controller writes no application code. Ever.** It senses,
dispatches, merges, labels, and journals — nothing else. Even fixing a red `main` is delegated
to a worker it spawns.

This sounds like a limitation. It's the opposite — it's what keeps the whole thing honest.
The moment the regulator becomes the hands, it stops regulating; a thermostat that starts
carrying firewood is no longer measuring the room. So the powers are held apart: the **brain
stem** decides what needs doing, the **hands** (worker agents, each in an isolated worktree)
do it, and the **cortex** — you — holds the decisions that are constitutionally yours. No organ
can reach its own off-switch.

## The ladder: triage, not a to-do list

When the loop senses trouble, it doesn't work through a list top to bottom. It fixes the
*worst* thing and stops, because fixing the worst thing often changes what the second-worst
thing even is. The rungs, in fixed order:

1. **Kill switch.** If the policy says `paused`, write one line and stop. Your hand on the
   brain stem — and because the policy file is a protected path, the loop can never un-pause
   itself.
2. **The red-`main` reflex** — and this is the rung I'm proudest of, because it refuses to be
   stupid about failure. It first *classifies the red*. A **code-red** (a test or build
   genuinely broke) triggers a hard halt: no merges, no new work, spawn exactly one fix worker
   against the break, and notify. But a **gate-down** — CI couldn't even run, because Actions
   billing is exhausted or the runner failed at startup — is a tooling outage, not a bug.
   Spawning a "fix worker" against an empty wallet is theatre. So instead it holds all merges
   (a dead gate can't certify anything green), pauses dispatch, and pings the human to restore
   CI. Same red X on GitHub; two completely different ailments; two correct responses. Most
   automation can't tell "the patient is bleeding" from "the lights went out."
3. **Fold the answered inbox.** Any question you've replied to gets folded back in and
   re-queued.
4. **Service open PRs by tier.** Green Tier-0 (docs, tests) merges on CI alone. Tier-1 (ordinary
   code) merges on green CI plus two independent agent reviews. Tier-2 (CI config, auth, the
   governance files) never merges automatically — it waits for you. Worst-file-wins: one
   protected path in the diff makes the whole PR Tier 2.
5. **Reclaim stale work.** A claimed task with no commits for two cycles is released back to the
   queue. Tissue that isn't healing gets reabsorbed.
6. **Dispatch.** While there's worker capacity and ready work, it claims tasks, groups them by
   file surface so two agents never fight over the same files, and spawns one worker per surface.
7. **Replenish — only from outside itself.** This is the safety rail that matters most, so it
   gets its own section.
8. **Record.** One journal comment per cycle: a human summary, a *waiting-on-you* digest, and a
   machine-readable metrics block. Notifications fire on exactly four events — a question for you,
   a red-`main` halt, CI down, a batch ready for audit — and nothing else. Notify on everything
   and you mute it; notify only on what needs a conscious decision and you wake for the
   emergency.

## The immune rule: it can only act on work you anchored

An agent loop that invents its own work is the dangerous kind — the one that "improves" things
nobody asked to change and calls it initiative. This one structurally cannot. It may only act
on work anchored **outside the fleet**: issues you filed, the roadmap you wrote, the backlog.
Work the loop dreams up about itself is non-self wearing a self costume, and an immune system
that attacks the self is the disease, not the defence.

So replenishment is strict: fully specified work becomes ready; underspecified work becomes a
*question for you*, never an invented spec; an agent's unprompted "we should refactor X" can be
*filed* for your triage but never promoted to ready by the loop itself. The fleet's autonomy is
real, but its agenda is always yours.

## The dials, and why they're locked

All of this is tuned from one file — the [loop policy](https://github.com/interlock-dev/interlock/blob/main/docs/agents/loop-policy.md):
the kill switch, how many workers run at once, which paths are protected, when to replenish, how
long before stale work is reclaimed, even which model tier handles which role (cheap workhorses
for grunt implementation, the strongest models reserved for planning and for reviewing
protected-path changes, where being wrong is unrecoverable).

And the policy file is itself a protected path. The loop reads its own constraints every cycle
and **can never edit them.** It can learn — it writes tests, reconciles docs, leaves notes — but
it writes those into the body, never into the law. Acquired traits aren't inherited; one noisy
night never rewrites the inheritance. Changing the dials takes a human-reviewed, human-merged
pull request. The organism does not get to rewrite its own DNA.

## Commissioning in shadow

You don't wire a new safety system straight to the machine. A freshly installed loop runs in
**shadow**: it executes the full cycle but, instead of merging, it labels each PR with what it
*would* have done and leaves it for you to audit. It earns its way to `live` only after you've
watched it be right enough consecutive times — and a single bad audit resets the count. Trust is
a ladder you climb, not a switch you flip on faith.

## This is the part worth buying

[Interlock](https://github.com/interlock-dev/interlock) — the deterministic tier-gate from the
[first essay](https://interlock.feristal.com/) — is one organ of this system: the fuse that
makes the tiers mechanical instead of merely written. But the loop is the nervous system that
*uses* the fuse. It's the difference between a tool you operate and an organism that operates
itself, safely, because every dangerous degree of freedom — inventing work, editing its own
rules, merging what it shouldn't, running while you're trying to stop it — is closed off by
construction rather than by hoping the model behaves.

The full controller and its dials are public, and a fleet running under them built most of the
tool you'd install:

- The brain stem: [master-loop.md](https://github.com/interlock-dev/interlock/blob/main/docs/agents/master-loop.md)
- The dials: [loop-policy.md](https://github.com/interlock-dev/interlock/blob/main/docs/agents/loop-policy.md)
- The first organ, installable today: `npx agent-interlock init`
- Repo: [github.com/interlock-dev/interlock](https://github.com/interlock-dev/interlock)
