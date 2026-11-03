# Constructed-response lock-ins

Use this protocol after each teaching node. Diagnostic probes remain multiple choice under [quiz-ui.md](quiz-ui.md); teaching lock-ins do not use a picker.

## Present the check

1. Teach exactly one reasoning step.
2. Update the configured display log with one complete, unbiased prompt that tests only that step.
3. Give no options, answer bank, leading scaffold, or partially completed derivation.
4. In the conversation, say only that the lock-in is ready on the display surface and invite the learner to reply with their work or `I don't know`. Do not repeat the mathematical prompt in chat when the display log is configured.
5. Stop and wait for the learner's next normal chat message. Do not open the quiz picker.

Use the course's notation and require only the evidence the node needs:

- For a conceptual node, ask for a short explanation in the learner's own words and the governing condition or notation.
- For a computational node, ask for the decisive transformation or derivation, the result, and one short reason the step is valid.
- For method selection, give a fresh situation and ask the learner to name the method and justify the cue that selects it.

Keep the response small enough to fit one reasoning step. “Explain it as if teaching someone” is useful only when it exposes the mechanism; do not reward vague simplification over correct mathematics.

## Grade the response

Grade the method, result, conditions, and explanation—not writing polish.

| evidence | result | route |
|---|---|---|
| correct decisive step, result, and sound reason | `lock-in` | advance |
| correct result but missing or unsupported reasoning | `retry` / `edge` | ask for the decisive step |
| sound method with a local algebra or arithmetic slip | `retry` / `edge` | identify only the slip, then give a parallel check |
| misconception reveals a missing dependency | `insert-prereq` | add the smallest prerequisite node |
| `I don't know` or equivalent | `insert-prereq` / `unknown` | provide a ramp; do not count as a wrong guess |

Give the verdict first, identify the exact working step that succeeds or fails, and state the governing rule. Do not reveal a full solution before deciding whether a smaller hint or prerequisite would preserve useful struggle.

## Persist and continue

Record in `.alvar/sessions/<date>-<slug>.md`:

- lock-in prompt
- learner response (verbatim when short; otherwise a faithful concise record)
- grading evidence
- result: `lock-in` | `retry` | `insert-prereq`

Update the topic map with the resulting `known`, `edge`, `unknown`, or `blocked` evidence. Then update the display log with the concise verdict, correction if needed, and next route before teaching anything else.
