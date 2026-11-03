# Probe → Plan → Teach

Source: Eero Alvar, *How I Use AI to Learn Things*
https://youtu.be/kzcI5F4tGiU

Load this after `philosophy.md`. Do not skip phases unless the learner already has a fresh map for this exact goal.

## Phase 1 — Probe

Measure the edge of understanding before teaching.

- Start broad, then binary-search every strand the lesson will depend on.
- Use graded multiple-choice (include "I don't know") through the **harness quiz UI** — see [quiz-ui.md](quiz-ui.md). Never dump A/B/C/D in chat.
- Ask 1–3 questions at a time. Wait for the tool. Do not dump a long exam.
- Let the learner talk through reasoning in a note or in chat. Treat that as signal.
- If they already stated solid ground, skip those strands.
- Write the map to `.alvar/maps/<topic>.md`.
- A long probe is a feature when context is thin. It is also a warm-up.

Stop when each dependency strand is labeled `known`, `edge`, `unknown`, or `blocked`.

## Phase 2 — Plan

Reason how to teach **this mind** **this goal**. Do not wing it.

- Build a dependency DAG. Each node is one reasoning step, not a chapter.
- Start from `known`. Path through `edge`. Do not start in `unknown` with no ramp.
- Build from the prep notes when the goal follows a source deck (`.alvar/prep/<deck-slug>.md`; run **Prep** first if they are missing or stale, see [agents.md](agents.md)).
- Verify the claims the plan will treat as fact with the **Verifier** agent ([agents.md](agents.md)): definitions, rules, formulas, named results, and anything beyond the source. It runs while the learner reads the plan; check its verdicts before teaching each node.
- Show the plan as a mermaid graph **before** teaching. Two jobs: the learner sees what is coming; the graph forces you to finish the reasoning.
- Write the plan into `.alvar/sessions/<date>-<topic>.md`.
- Ask if they want the graph changed. Then freeze it until a quiz failure forces a new node.

## Phase 3 — Teach

Walk the DAG. One node per turn.

- One reasoning step. Stop. Do not rush the whole graph (that is the ChatGPT failure mode).
- If a picture would lock the idea, hand it to the **Visual** agent (`learn-visual`; inline if no subagents) and keep teaching in words while it draws.
- If an inserted node or a side-question answer adds a claim beyond the source, send it to the **Verifier** and mark it "(being checked)" until the verdict is back.
- After the step, ask one constructed-response lock-in from [lock-in-response.md](lock-in-response.md). Require the learner to generate the decisive move rather than recognize it from choices. Three reasons: they cannot gaslight themselves; you stay calibrated; applying and explaining the idea is how it locks in.
- Advance only on lock-in. Fail → stay, or insert a prerequisite node.
- Accept questions mid-step. Do not "finish the lesson" over them.
- Give them things they can accept at face value only after the step they rest on is locked.
- Persist what happened in the session file.

## Feedback rules

- Lock in after every node, not "at the end."
- Prefer a short derivation, application, or explanation over a recap prompt.
- If they give only a final answer or answer from vibe, ask for the decisive step before advancing.

## What the system absorbs

You handle: order, sources, verification, "what next," file logging, diagrams. Prep, Verifier, Visual and Scribe agents do the source reading, fact-checking, drawing and summarising; you stay with the learner.

They handle: thinking about the material.
