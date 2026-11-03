# teach

My working copy of the **Alvar-method tutoring skills** for coding agents (Claude Code, Codex and others that read `SKILL.md` folders).

Based on [vasanthsreeram/Alvarmethod](https://github.com/vasanthsreeram/Alvarmethod) (MIT), which implements Eero Alvar's [*How I Use AI to Learn Things*](https://youtu.be/kzcI5F4tGiU), with local changes:

- free-response lock-ins after each teaching step (diagnostic probes stay multiple choice)
- a visible Markdown display log (Obsidian) mirrored from the canonical `.alvar/` state
- `~/.alvar/roots.md` index of learner roots, so sessions resume from any starting directory
- harness-neutral wording so the same files work in Claude Code and Codex

## Skills

| skill | job |
|---|---|
| `teach` | probe → mermaid plan → one reasoning step per turn with a lock-in |
| `probe` | graded diagnostic quiz that maps `known / edge / unknown / blocked` |
| `learn-profile` | interview that writes `.alvar/LEARNER.md` |
| `learn-verify` | fact-check a claim before it is taught |
| `learn-visual` | one SVG per idea, viewed and fixed before use |

Learner state (maps, sessions, logs) lives in each course folder's `.alvar/`, never in this repo.

## Install

Clone to `~/.agents/skills` (or anywhere) and symlink each skill folder into your agent's skills directory, e.g. `ln -s ~/.agents/skills/teach ~/.claude/skills/teach`.
