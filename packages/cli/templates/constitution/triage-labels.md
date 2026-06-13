# Triage labels

| Label | Meaning |
|---|---|
| `needs-triage` | A human needs to evaluate / specify this |
| `ready-for-agent` | Fully specified, ready for an autonomous worker |
| `ready-for-human` | Requires human implementation |
| `in-progress` | A worker has claimed it |
| `in-review` | PR open, awaiting the merge decision |
| `needs-engineer` | A *decision* is referred to the team (decide-for-me) |
| `blocked` | A *failure* needs a human (debug-me) |
| `would-auto-merge` | Shadow mode: this PR would have merged; audit it |
| `wontfix` | Will not be actioned |

`needs-engineer` (a decision) and `blocked` (a failure) are different nerves and need
different human responses — keep them distinct (Constitution Article VI).

Create any missing labels on first use:

```bash
gh label create needs-engineer   --color 8A2BE2 --description "Decision referred to the team (decide-for-me)"
gh label create would-auto-merge --color 0E8A16 --description "Shadow: would have auto-merged; audit it"
gh label create in-progress      --color FBCA04 --description "A worker has claimed this"
gh label create in-review        --color 1D76DB --description "PR open, awaiting merge decision"
gh label create blocked          --color B60205 --description "A failure needs a human"
gh label create ready-for-agent  --color 0E8A16 --description "Specified, ready for an autonomous worker"
```
