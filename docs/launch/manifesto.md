# I gave my coding agents a constitution

*The hero essay. Lives on the blog (feristal.com or equivalent), linked from every channel.
Lead with this; the tool is the call to action at the end.*

---

Over the last few days I've let AI agents write code and open pull requests against my
repositories while I sleep. Not as a demo — as my actual workflow. The thing that made that
safe enough to do wasn't a smarter model or a cleverer prompt. It was a written
**constitution**: a charter that defines what the agents may do on their own, what always
needs me, and what they may never touch.

I want to make the case for *governing* agents instead of *supervising* them — and then hand
you the first piece of it as working code.

## The dilemma everyone running capable agents hits

Review every change yourself and you've rebuilt the exact bottleneck you adopted agents to
escape. Trust them and merge freely, and sooner or later one helpfully "tidies up" your CI
config or rewrites an auth path at 2am, and you find out in production. Supervision doesn't
scale; blind trust doesn't survive. There's no dial between the two.

So I built one. The dial turned out to need a theory behind it.

## A healthy body is not goal-seeking — it is deviation-correcting

The theory I borrowed is from physiology. A goal-seeking system optimises a number and
treats everything in its way — including you — as a bottleneck to route around. A healthy
body doesn't work like that. It isn't chasing a target; it's defending a set of setpoints
against deviation. Your heart doesn't try to maximise beats. It holds 37°C and a blood pH,
and it corrects when they drift, through feedback loops you never consciously feel.

> Pursue output → metastasis. Defend setpoints → homeostasis.

Point an agent fleet at "maximise throughput" and it drifts into confident busywork —
plausible PRs nobody asked for, refactors that help no one, motion mistaken for progress.
Define what it must *defend* instead, and it stays sound. So the constitution doesn't tell
the agents what to achieve. It defines what they protect, and lets them act freely
everywhere else.

A few of the organs, because the specifics are the point:

**Tiered autonomy, drawn by reversibility of harm.** You notice your heartbeat only when
something's wrong; most of what keeps you alive runs beneath attention. Changes are sorted
the same way. *Tier 0* — docs, tests, anything behaviour-neutral — runs autonomically. *Tier
1* — ordinary code — gets review. *Tier 2* — the load-bearing walls: CI config, auth, the
governance files themselves — always needs a human. The line isn't drawn by importance; it's
drawn by how hard the damage is to undo.

**An immune system that knows self from non-self.** The fleet may only act on work anchored
*outside itself* — issues a human filed, the roadmap, the backlog. Work it invents *about
itself* is non-self wearing a self costume, and an immune system that attacks the self is
the disease. An agent that generates its own to-do list and then dutifully executes it isn't
being helpful; it's autoimmune.

**Reflexes faster than deliberation.** Red `main` freezes the whole fleet — no merges, no
new work, one job only: fix the break. A hand leaves a hot stove before the brain is told
there's heat.

**A barrier between what it learns and what it is.** The fleet writes lessons into its
*soma* — tests, docs, notes — constantly. But it can never edit its *germline*: the charter,
the policy, the gates. Acquired traits aren't inherited; one noisy night never rewrites the
inheritance. A change to the law requires a human-reviewed, human-merged pull request. The
organism doesn't get to rewrite its own DNA.

**Commissioning in shadow.** A new constitution isn't trusted on first contact. It runs the
full cycle but applies "would-have-merged" labels *instead of* merging, and rests there for
audit until a human has watched it be right enough times to flip it live. You prove a safety
interlock fires correctly before you wire it to the machine — not after.

The whole charter is public: **[CONSTITUTION.md](https://github.com/interlock-dev/interlock/blob/main/docs/agents/CONSTITUTION.md)**.

## From sermon to fuse

Most of that charter is prose — English an agent reads and, mostly, obeys. But "mostly
obeys" is not a guarantee, and a governance system you can talk out of governing isn't one.
An infection cannot be allowed to tell the immune system to stand down.

So I took the part that *must* be mechanical — the tiers, the protected paths, the rule that
an agent can't touch the load-bearing walls — and extracted it into deterministic code. No
model in the loop. Glob matching and rule evaluation: same input, same verdict, every time.

> Read the docstring → credulous. Read the fuse → grounded.

A second AI policing the first one just gives you two things that hallucinate. A fuse has no
opinions, no bad days, no jailbreak — which is exactly why you trust it with the thing that
matters. **The product is the law without the sermon.**

That extraction is **Interlock**. One `interlock.yml` in your repo; a GitHub Action that
stamps every PR with its tier — Tier 0 green, Tier 1 review, Tier 2 *agents may not pass*.
It reads its policy from the PR's base branch, so a pull request can't weaken the rules that
judge it. It protects its own config file by default, so the gate can't edit its own
off-switch. It starts in observe mode — labelling, never blocking — so you watch it be right
before you let it bite.

## The governor, governing its own birth

Here's the part I find hard to argue with. The repository that holds Interlock is governed
by the same constitution Interlock enforces. Most of v0.1 was built and adversarially
reviewed by an agent fleet running under that charter — Sonnet hands, Opus reviewers, tiered
merges, the whole physiology. One of those reviews caught a path-normalisation bug where a
`./`-prefixed path could dodge a protected-path rule; it's fixed, with tests, and it's
exactly the class of failure the governance exists to surface.

And the first thing the finished gate did, in CI, was look at its own setup pull request,
notice it touched protected paths, and stamp it **Tier 2** — declining to wave through the
very change that installed it.

The governor, governing its own birth. I can't think of a cleaner test.

## Try it

Interlock is v0.1, Apache-2.0, GitHub-Actions-only for now, and it runs entirely on your own
CI — nothing hosted, nothing touching your code.

```bash
npx agent-interlock init
```

That writes the policy and prints the workflow to paste. About a minute, start to finish.
The constitution it came from is in the repo; the tool is the first organ of it made
enforceable, and there will be more — a local pre-commit/Claude Code adapter next, so the
same policy holds before a PR even exists.

- **Tool:** https://github.com/interlock-dev/interlock
- **The constitution:** https://github.com/interlock-dev/interlock/blob/main/docs/agents/CONSTITUTION.md
- **Install:** `npx agent-interlock init`
