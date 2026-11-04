---
name: recall
description: >
  Active-recall round over the learner's spaced-repetition deck — fresh
  free-response questions on cards that are due, graded and rescheduled with
  Leitner boxes. Use when the user runs /recall or /skill:recall, says recall,
  review my cards, spaced repetition, what's due, build my recall deck, or when
  context says recall cards are due.
license: MIT
metadata:
  author: aa3aaa
  version: "1.0"
  source: "Eero Alvar — How I Use AI to Learn Things https://youtu.be/kzcI5F4tGiU"
---

# Recall

Retrieval keeps what teaching locked in. One card per turn, free response, graded, rescheduled.

Read before the first card:

1. [../teach/references/recall.md](../teach/references/recall.md) — **the whole protocol**: deck format, schedule, when to offer, running a round.
2. [../teach/references/learner-files.md](../teach/references/learner-files.md) — finding the learner root, and the display-log rules.
3. [../teach/references/lock-in-response.md](../teach/references/lock-in-response.md) — prompt-writing rules and the grading table.
4. `.alvar/LEARNER.md` (voice, assessed-work rule, display log) and `~/.alvar/settings.md` (recall settings).

## What to do

- **Cards due** (from the hook's "Active recall status" context, or from reading `.alvar/recall.md`): offer a round with the picker in recall.md, "Offering a round".
- **Run directly** (`/recall`): skip the offer and start the round. If nothing is due, say when the next cards are due and offer an early review of the lowest-box cards.
- **"Build my recall deck"**: card every locked node from the earlier session logs, as in recall.md, "Building the deck".
- **No deck and no sessions yet**: say that cards are made as lessons lock in, and offer to start `teach`.

## Hard rules

- One card per turn. Stop after each question and wait.
- Free response only. No options, no answer bank, no hint before the attempt.
- A fresh question every time; never the old lock-in or recall prompt word for word.
- Update the deck row right after grading each card, before the next card.
- "Skip", "just tell me" and "not now" always win.
- Never teach or card a claim the Verifier marked `contradicted` or `unknown`; never touch assessed work.
- When the round ends, return to whatever the learner originally asked for.
