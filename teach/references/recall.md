# Active recall

Teaching locks an idea in once. Recall keeps it. Every node the learner locks in becomes a **card**; cards come back on a growing schedule, and when cards are due the learner is offered a short round before anything else. Recall is retrieval, not recognition: every card is answered free-response, the same as a lock-in.

The loop stays the same: one card per turn, one constructed response, grade, update, next.

## Files

All in the learner root's `.alvar/` (see [learner-files.md](learner-files.md)):

```
.alvar/
  recall.md            # the deck: one row per card (canonical)
  recall-state.json    # study day, last activity, skip day (written by the hook; the tutor writes only skip_day)
  recall-log.md        # every recall round: questions, answers, results
```

### The deck — `recall.md`

```markdown
# Recall deck
<!-- One row per card. Dates are YYYY-MM-DD. Escape a pipe inside a cell as \|. box: 1–6, or retired / paused. -->

| id | topic | idea | kind | source | box | last | due | history |
|---|---|---|---|---|---|---|---|---|
| R1 | Observer pattern | Subject keeps a list of observers and calls `update()` on each when its state changes; observers register and deregister themselves | concept | sessions/2026-11-04-patterns.md#observer; prep/week05-lec.md p.12 | 2 | 2026-11-05 | 2026-11-08 | 11-04 L, 11-05 + |
```

| column | what goes in it |
|---|---|
| `id` | `R1`, `R2`, … never reused |
| `topic` | 2–4 words; the hook shows these in the banner |
| `idea` | One sentence, in course notation: what the learner must be able to explain, decide or do. It is the *idea*, not a question and not the answer to one old prompt, so a fresh question can be built from it every time |
| `kind` | `concept` (explain + governing condition), `compute` (decisive step on fresh data), or `method` (pick the method for a fresh situation and justify the cue) |
| `source` | Session file and node, plus the prep page if the idea came from a deck. Used to rebuild data and wording |
| `box` | `1`–`6`, or `retired` / `paused` (the hook ignores both) |
| `last` | Date last reviewed (or locked) |
| `due` | Next due date |
| `history` | Short trail: `MM-DD L` locked, `+` correct, `~` partial, `-` wrong, `s` skipped |

### The state — `recall-state.json`

Written by the hook ([hooks/recall-check.js](../../hooks/recall-check.js)) on session starts, prompts and turn ends (activity-only updates at most every 5 minutes):

```json
{ "study_day": "2026-11-05", "last_activity": "2026-11-05T08:12:03.000Z",
  "sessions": { "<session id>": "2026-11-05" }, "skip_day": "2026-11-05" }
```

`sessions` records the last study day each session saw; it is how the hook offers once per session per study day. The tutor only ever writes `skip_day`, by read-modify-write that keeps every other field. If the file does not exist, create it with just `skip_day`.

**The study day for dates you write.** Read `study_day` from `recall-state.json` when the hook is watching this root (see "Without the hook" below); otherwise use today's date. Use that one value for `last`, `due` and log headings throughout a round or lesson.

## Making cards

- **When a lock-in passes**, add one card for that node: box `1`, `last` = study day, `due` = study day + 1, history `MM-DD L`. A node that taught two separable ideas may get two cards; never more.
- **When a node ends taught-not-verified** (the learner asked to skip), add its card the same way. It is the card most likely to need the review.
- `truth` nodes get a `concept` card; `discover` nodes get a card on the decisive move (`concept` or `method`); `step` nodes take whatever kind fits.
- Write the `idea` from what was actually taught and verified, in the course's notation. Never put a claim the Verifier marked `contradicted` or `unknown` on a card.
- Do not card probe results. Only taught nodes become cards.
- Cards from assessed work: none. The assessed-work rule in `LEARNER.md` applies to recall exactly as to teaching.

### Building the deck from earlier sessions

On "build my recall deck" (or the first recall run in a root that has sessions but no deck): read every `.alvar/sessions/*.md` `## Log`, and card each node whose `result` is `lock-in` or that is marked taught-not-verified, skipping nodes already in the deck (match on `source`). Stagger the new cards' `due` dates, oldest sessions first, so no more than `recall_max` fall on one day. Show the learner the new rows before writing them.

## The schedule (Leitner boxes)

| box | interval |
|---|---|
| 1 | 1 day |
| 2 | 3 days |
| 3 | 7 days |
| 4 | 14 days |
| 5 | 30 days |
| 6 | 60 days |

Grade each answer with the lock-in table in [lock-in-response.md](lock-in-response.md), then move the card:

| grade | card moves to | `due` |
|---|---|---|
| correct decisive step, result and sound reason | next box (box 6 stays 6) | study day + new box's interval |
| right result, thin or missing reason; sound method with a local slip; right answer for a surface reason | same box | study day + that box's interval |
| wrong, misconception, or `I don't know` | box 1 | study day + 1 |
| learner said "skip" for this card | same box | study day + 1 |

A card graded wrong also moves its strand in the topic map back to `edge` (from `known`), with the recall as evidence.

## When recall is offered

Two routes lead to the same offer.

**With the hook installed (Claude Code).** The hook decides and tells you through context headed "Active recall status". It works on a **study day**, not the raw date:

- A new study day starts on a new calendar day once the learner has had a break: crossing midnight after at least `recall_cross_gap` hours idle (default 2) starts it at once; crossing midnight mid-session keeps yesterday's study day until an idle gap of at least `recall_idle_gap` hours (default 4), or until `recall_day_ceiling` o'clock (default 12) if there never is one. A study day never lags more than one calendar day, and one in the future (clock or timezone moved back) resets to today.
- A **new session** (startup, `/clear`, fork) in a learner root offers recall whenever cards are due.
- In an **open or resumed session**, recall is offered on the first prompt after a new study day starts.
- Never when `recall: off`, when nothing is due, when the learner chose **Skip today** for this study day, or twice in one session on one study day.

Cards are due when `due` ≤ study day.

**Without the hook** (other harnesses, the desktop app, the hook not installed, or a session started outside the course folder so the hook cannot see it). First check whether the hook is watching this root: it rewrites `last_activity` in `recall-state.json` on every prompt and turn end, so a `last_activity` within the last 10 minutes means it is (another Claude Code session in the same folder can also cause this; either way the hook is handling the folder). Then trust the hook and do not offer on your own; it already applied the study-day rules. Otherwise, at the start of every `teach` session and when `/recall` runs, read `recall.md`. If cards are due on today's date and `recall-state.json` has no `skip_day` for today, make the same offer, once per session. Use today's date as the study day.

## Offering a round

Make the offer as a picker (the harness question tool, see [quiz-ui.md](quiz-ui.md)), before doing whatever the learner asked:

- question: `<n> recall cards due in <course> (<topics>). Do a round now?`
- header: `Recall`
- options, in this order:
  - `Do <k>`: `k` = min(n, `recall_max`); description names the topics
  - `Quick 2`: shown only when k > 2
  - `Not now`: "Carry on; I'll ask again in a new session or tomorrow"
  - `Skip today`: "No more recall prompts until tomorrow"

Then:

- **Do / Quick**: run the round, then return to what the learner asked for.
- **Not now**: carry on with their request. Write nothing.
- **Skip today**: write `skip_day` = study day to `recall-state.json`, leave the cards as they are, and carry on.
- A dismissed picker counts as **Not now**.

If the learner opened with a question or a pending lock-in answer, answer or grade that first, then offer. Never discard what they typed.

## Running a round

1. **Pick cards.** Most overdue first, then by box (lowest first). Interleave: no two cards with the same `topic` back to back when you can avoid it.
2. **Ask one card at a time.** Build a **fresh question** from the card's `idea`, `kind` and `source`. Never repeat the lock-in prompt, or the previous recall prompt for this card (check `recall-log.md`), word for word; change the scenario, data or angle. Follow the prompt-writing rules in [lock-in-response.md](lock-in-response.md): one decisive question, its own data, no plug-and-chug. Do not reveal the topic name if it gives the answer away.
3. **Stop and wait** for the learner's answer in chat. No options, no hints up front.
4. **Grade** with the lock-in table, verdict first. Then give the correct idea in two or three lines, whatever the grade, so every card ends with the right version in view. On a partial answer, ask once for the missing piece before grading (the "unanswered parts" rule), unless the learner says skip.
5. **Update the deck row** immediately: `box`, `last`, `due`, `history`. Then the next card.
6. **Second chance.** Cards graded wrong come back once at the end of the round in a fresh form. This does not change their schedule; it closes the loop while the correction is fresh.

`I don't know` is a fine answer: give the idea, grade it wrong, move on. Do not let a round turn into a lecture; a card that reveals a real gap goes to the debrief.

## After the round

- One-line summary: `4 cards: 3 ✓, 1 ✗ (Liskov substitution)`, and when the next cards are due.
- For each wrong card, offer to re-teach that node now as a discover node ([discovery.md](discovery.md)), or to add it to the next `teach` plan.
- Append the round to `recall-log.md`:

```markdown
## 2026-11-05 — 4 cards (study day 2026-11-05)
- R1 Observer pattern — Q: <the question, with its data> — A: <short faithful record> — + (box 2 → 3, due 2026-11-12)
```

- If `LEARNER.md` names a display log, follow the display-log rules in [learner-files.md](learner-files.md): the live note shows only the current card (`# Recall · card <i> of <k>`, its question, and the last card's result), and the whole round (each question, answer, grade and correct idea) is appended to the archive note `<Display archive>/<date> Recall.md`. When the round ends, rewrite the live note back to the lesson the learner returns to.
- Then go back to what the learner originally asked for.

## Settings

In `~/.alvar/settings.md` (all optional):

```markdown
recall: on            # off: never offer, and the hook stays silent
recall_max: 5         # cards in a full round
recall_cross_gap: 2   # hours idle when crossing midnight that start a new study day
recall_idle_gap: 4    # hours idle needed after working through midnight
recall_day_ceiling: 12 # o'clock: after working through midnight, the new study day starts by then at the latest
```

`--status` also lists any deck rows it could not read (a bad date or box), which are skipped until fixed. A pipe inside code, such as `a || b`, is read correctly, but escaping it as `\|` is safest.

To check what the hook would do, from a course folder run `node <repo>/hooks/recall-check.js --status`.
