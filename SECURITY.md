# Security Policy

## Threat model — what Interlock is, and what it is not

Interlock is a **governance aid that makes agent-PR review legible** — a deterministic
fuse that classifies each pull request by author and by the reversibility tier of the paths
it touches, then posts a verdict you can read in seconds. It is **not a security
containment boundary**. It governs *cooperating* agents; it does not contain adversarial
ones.

Its usefulness rests on three assumptions. Trust the verdict exactly as far as you trust
these — no further:

1. **Agent self-identification is honest (allowlist, fail-to-human).**
   `classifyAuthor` is a positive allowlist: a PR is treated as agent-authored only if its
   account, head branch, or a commit trailer matches one of the patterns under
   `authors.agents` in your policy. Anything that does not match falls through to the
   **human** class — which gets the *lenient* treatment. An agent that declines to
   self-identify (commits under a plain account, off an unlisted branch, with no agent
   trailer) is therefore classified as a human and routes around the strict agent rules.
   Interlock cannot tell a quiet agent from a person; it only governs agents that announce
   themselves.

2. **`mode: observe` is the default — nothing is enforced until you flip it.**
   A freshly initialised `interlock.yml` ships in `observe` mode: the gate computes and
   posts verdicts but the CI job always passes. Nothing is actually blocked until you
   change `mode: enforce` **and** add `interlock` as a required status check in branch
   protection. Until both are true, the gate is a reporter, not a guard.

3. **Only the listed paths are protected, and globs are case-sensitive.**
   Protection is whatever your `tiers.tier2` globs match — nothing more. Path matching is
   case-sensitive glob matching; the default tier for an unmatched path is the lenient
   Tier 1. A path you did not think to list, or listed with the wrong case, is not
   protected. The protected set is exactly the set you wrote down.

The practical upshot: Interlock raises the cost and the visibility of an agent quietly
editing a protected path, and it gives a human a legible, deterministic verdict to act on.
It does not stop a determined adversary who controls the agent's identity or the policy
file's review. Pair it with branch protection, required reviews, and `enforce` mode — and
treat its verdict as a signal to a human, not as a wall.

## Reporting a vulnerability

Please report security issues **privately**, not as a public issue.

Use GitHub's private vulnerability reporting: go to the repository's **Security** tab and
click **"Report a vulnerability"**
(<https://github.com/farshadpasbani/interlock/security/advisories/new>). This opens a
private advisory thread visible only to the maintainers.

Do not open a public issue or PR for a security report — public disclosure before a fix is
available puts every consumer of the action at risk.

## Maintenance — pinned dependencies

`undici` is held to `^6.24.0` by a root `overrides` in `package.json` to resolve the
`undici` ≤ 6.23.0 advisory cluster (HTTP request/response smuggling, CRLF injection, and
unbounded-decompression DoS — GHSA-2mjp-6q6p-2qxm, GHSA-4992-7rv2-5pvq, GHSA-g9mf-h72j-4rw9
and related). It enters transitively through `@actions/http-client`, whose entire declared
`^5` range pulls a vulnerable `undici`. Remove the override once `@actions/http-client`
ships a release whose transitive `undici` is already ≥ 6.24.0; the pin is a stopgap, not
policy.
