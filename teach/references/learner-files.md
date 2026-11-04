# Learner files

All session state lives in the **learner's working directory**, not in this skill repo.

```
.alvar/
  LEARNER.md                 # how this mind wants to be taught
  maps/<slug>.md             # probe results for one goal
  sessions/<date>-<slug>.md  # Resume block + plan + verification + steps + quizzes
  prep/<deck-slug>.md        # source-deck notes from the Prep agent (one per deck)
  visuals/<slug>-<n>.svg     # diagrams from learn-visual
  recall.md                  # active-recall deck: one row per card
  recall-state.json          # study day and last activity, kept by the recall hook
  recall-log.md              # every recall round: questions, answers, results
```

Who writes what is in [agents.md](agents.md): Prep writes `prep/`, Visual writes `visuals/`, Scribe writes only the session's `## Resume here` block. The recall hook writes `recall-state.json`, where the tutor writes only `skip_day` ([recall.md](recall.md)). The tutor writes everything else.

The recall hook finds the learner root by walking up from the folder the session started in, and never treats the home folder as one (`~/.alvar/` holds only `settings.md` and `roots.md`). Sessions started inside a course folder, or any folder under it, get the automatic recall offer; sessions started elsewhere still get it from the `teach` Turn 0 check.

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

When `.alvar/LEARNER.md` names a `Display log`, the learner reads lessons in Obsidian (or another Markdown viewer) and answers in the agent chat. The display log has two parts, and "update the display log" anywhere in these skills means **both**:

| part | file | how it changes | what it is for |
|---|---|---|---|
| **Live note** | the `Display log` file, e.g. `COMP2511 Learning Log.md` | **rewritten in full** every update | what the learner is looking at right now; always short, so it never needs scrolling |
| **Archive** | one note per session in the `Display archive` folder (default `Learning Log/`), e.g. `Learning Log/2026-11-04 Observer pattern.md` | **appended** in order, never rewritten | the complete record, for looking back; the learner is not expected to keep it open |

The `.alvar/` map and session files remain canonical state; both parts are visible mirrors of it. With `Display archive: none` in `LEARNER.md`, skip the archive and write only the live note.

### The live note

Before showing a plan, teaching a node, calling a diagnostic picker, or inviting a constructed response, rewrite the live note. It holds **only the current learning surface**, in this order, and nothing older:

```markdown
# <goal> · step <k> of <n>
<the Mermaid DAG: append :::current to the current node and end the graph with
 classDef current fill:#ffe08a,stroke:#b8860b,stroke-width:3px ; then the one-line tag legend>

## Step <k> · <node name>
<exactly one reasoning step>

### You asked: <question>          ← only while a side question about this step is open
<answer>

## Your check
<the pending check: every unbiased diagnostic choice, or one option-free lock-in>

## Last result
<the previous check in full, copied from the archive: its question with its data,
 the learner's answer, the verdict, the correction and the correct idea, and the route>

<sub>Full record: [[<archive note name>]]</sub>
```

- Drop sections that are empty (no plan yet during the probe, no last result on the first step).
- During a probe the heading is `# <goal> · probe`; during recall it is `# Recall · card <i> of <k>`, with the card's question under `## Your check` and the last card's full result (question, answer, grade and correct idea) under `## Last result`.
- At "done for now", rewrite it as a short stopping point: what locked, the next step, and the archive link. Do not leave a half-answered check in it.
- **Keep the last result whole.** Never shrink it to a one-line verdict: the learner revises from it, and a verdict without the question, their answer and the correction loses the context. Copy the result block exactly as appended to the archive, with the question it grades (a check's code or data has left `## Your check` by then, so it must come with the result). It is replaced, not accumulated, when the next check is graded.
- Everything else stays brief: the plan, side questions and the step itself, so the live note still holds only the current surface plus that one full result.

### The archive

**Mirror everything** into the session's archive note in the same turn, in order: the plan when shown, each step as taught, each check, the learner's answer (short faithful record), grading and corrections, and answers to side questions (as a `### You asked: …` block). Append; never rewrite earlier entries.

- One archive note per session file: `<Display archive>/<YYYY-MM-DD> <Goal>.md`, matching `.alvar/sessions/<date>-<slug>.md`. A resumed session keeps appending to its note. Start it with `# <goal>` and a link back to the live note.
- A recall round goes to `<Display archive>/<YYYY-MM-DD> Recall.md` (one per study day).
- Create the archive folder on first use.

**Write order each turn:** append to the archive, rewrite the live note, then reply in chat. The `.alvar/` files are for resuming; the archive is the readable record; the live note is the screen.

**Moving an existing long log.** If the live note already holds more than the current surface (it was written under the old append-only layout), move its whole contents unchanged into `<Display archive>/<date> Earlier log.md` (never delete it), then rewrite the live note. Tell the learner in one line where the old content went.

Use Obsidian-compatible math delimiters: `$...$` inline and `$$...$$` for display equations. Write real LaTeX commands such as `\sqrt{y}`, `\frac{a}{b}`, and `\infty`; do not use bare formula text or Unicode approximations when mathematical typesetting matters.

For a diagnostic probe, write the complete mathematical question and choices labelled `A`–`D` to the display log **before** opening the picker. Keep `D` as **I don't know**. The harness picker may then contain only the fixed reference instruction and letter buttons.

For a teaching lock-in, write one complete free-response prompt with no choices, answer bank, or correctness cues. The learner answers through the harness's normal conversation input and may write `I don't know`. After grading, record the learner's response and grading evidence in the canonical session file, append the result and route to the archive, and copy that whole result (with the question it grades) under `## Last result` in the live note.
