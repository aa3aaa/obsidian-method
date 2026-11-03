# Learner files

All session state lives in the **learner's working directory**, not in this skill repo.

```
.alvar/
  LEARNER.md                 # how this mind wants to be taught
  maps/<slug>.md             # probe results for one goal
  sessions/<date>-<slug>.md  # Resume block + plan + verification + steps + quizzes
  prep/<deck-slug>.md        # source-deck notes from the Prep agent (one per deck)
  visuals/<slug>-<n>.svg     # diagrams from learn-visual
```

Who writes what is in [agents.md](agents.md): Prep writes `prep/`, Visual writes `visuals/`, Scribe writes only the session's `## Resume here` block. The tutor writes everything else.

Create `.alvar/` on first use.

## Finding the learner root

The agent is not always launched inside the learner's folder (Claude Code and Codex are often started from the home directory). Before creating anything:

1. If the working directory has `.alvar/`, use it.
2. Otherwise read `~/.alvar/roots.md`, the index of known learner roots. Pick the root whose subject matches the goal. To resume without a named goal, pick the root with the most recently modified session file and say which one you chose. If two roots fit, ask.
3. Treat the chosen root as the working directory for every `.alvar/` and display-log path. Use absolute paths when the harness does not let you change directory.
4. Only create a new `.alvar/` after confirming the folder with the learner, then add a line for it to `~/.alvar/roots.md` (create that file, headed `# Learner roots`, if it does not exist).

## Resuming

In the chosen root, open the newest session file. Read its `## Resume here` block, the map it names, and `LEARNER.md`. Open the full `## Log` only for the pending node. If the block is missing, or older than the last log entry, run the Scribe agent first ([agents.md](agents.md)).

`roots.md` holds one line per root: `- <absolute path> — <subject> — <display log or "none">`. It is an index only; never put learner state in it.

## LEARNER.md

If missing, run `learn-profile` or write a stub from `assets/LEARNER.md` and ask 3–5 questions to fill it. Do not invent a personality.

Read LEARNER.md at the start of every `teach` session. It controls:

- voice and density
- how they want struggle
- what they already treat as solid
- whether they want visuals, mermaid, LaTeX, or a long markdown log

## Map file

```markdown
# Map — <goal>

Updated: <ISO date>
Goal: <one sentence>

## Strands
| strand | status | evidence |
|--------|--------|----------|
| line integrals | known | Q2 correct, explained work |
| Stokes | edge | recognized statement, missed Faraday link |
| differential forms | unknown | said so |
| SR field mix | blocked | answered "I don't know" |

Status: `known` | `edge` | `unknown` | `blocked`

## Quiz log
- Q1 [line integrals] C — correct
```

## Session file

```markdown
# Session — <goal>
Date:
Model:
Goal:

## Resume here
(written by the Scribe agent; see agents.md)

## Plan
\`\`\`mermaid
graph TD
  A[covector] --> B[1-form]
  B --> C[wedge]
\`\`\`

## Verification
| id | claim | verdict | source | teach as |
|---|---|---|---|---|

## Log
### Node: covector
- style: step | truth | discover (planned | confusion | retry | request)
- taught:
- visual:
- lock-in prompt:
- learner response:
- grading evidence:
- result: lock-in | retry | insert-prereq
```

Keep these files updated as you go. They are the persistence layer (the portable stand-in for a markdown-log / Obsidian pane).

## Optional visible Markdown display log

When `.alvar/LEARNER.md` names a `Display log`, keep that vault-relative Markdown file synchronized as the learner-facing presentation surface. The `.alvar/` map and session files remain canonical state; the display log is a visible mirror for Obsidian or a markdown-log pane.

Before showing a plan, teaching a node, calling a diagnostic picker, or inviting a constructed response, update the display log first. It should contain only the current learning surface:

- the goal and current node
- the Mermaid dependency DAG
- exactly one reasoning step
- the pending check: either every unbiased diagnostic choice or one option-free teaching lock-in
- the latest result and next route after the learner answers

**Mirror everything.** Every explanation the learner receives goes into the display log in the same turn: lessons, checks, grading and corrections, **and answers to side questions** (as a `### You asked: …` block). Write it to the log before replying in chat. The `.alvar/` files are for resuming; the display log is what the learner reads and revises from, so it must be complete.

Use Obsidian-compatible math delimiters: `$...$` inline and `$$...$$` for display equations. Write real LaTeX commands such as `\sqrt{y}`, `\frac{a}{b}`, and `\infty`; do not use bare formula text or Unicode approximations when mathematical typesetting matters.

For a diagnostic probe, write the complete mathematical question and choices labelled `A`–`D` to the display log **before** opening the picker. Keep `D` as **I don't know**. The harness picker may then contain only the fixed reference instruction and letter buttons.

For a teaching lock-in, write one complete free-response prompt with no choices, answer bank, or correctness cues. The learner answers through the harness's normal conversation input and may write `I don't know`. After grading, record the learner's response and grading evidence in the canonical session file, then mirror a concise result and route to the display log.
