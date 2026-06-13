@AGENTS.md

# Claude Code binding

This repo is governed by the agent Constitution (docs/agents/CONSTITUTION.md). The
master-loop controller binding for Claude Code lives at .claude/skills/master-loop/SKILL.md —
run /master-loop to operate the fleet. Status: shadow (see docs/agents/loop-policy.md).

Stack commands: install `npm install` · test `npx vitest run` · typecheck `npm run typecheck`
· build `npm run build`. The committed Action bundle must stay reproducible:
`npm run build -w action && git diff --quiet -- action/dist`.
