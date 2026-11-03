# Diagnostic quiz UI — use the harness tool, never markdown MCQs

This reference governs the broad diagnostic probe. Do **not** print A/B/C/D in the chat transcript. Every diagnostic multiple-choice question must go through the interactive question tool this agent already has. Wait for the tool result before scoring.

Teaching lock-ins are not multiple choice. After teaching begins, use [lock-in-response.md](lock-in-response.md) instead of this tool.

If more than one of these tools exists, pick the first match in the table.

| If you have this tool | Harness | Call it |
|-----------------------|---------|---------|
| `mcp__alvar_quiz__ask_user_question` (or the `ask_user_question` tool from server `alvar_quiz`) | **Codex desktop** with its configured picker (native or Obsidian) | that MCP tool |
| `ask_user_question` | **Grok Build** or **Codex** | `ask_user_question` |
| `AskUserQuestion` | **Claude Code** | `AskUserQuestion` |
| `question` | **OpenCode** | `question` |
| `quiz` | **Pi** (quiz extension) | `quiz` |
| `ask_user` / `askUserQuestion` / `ask_user_question` | **Pi** (ask-user extension) | that tool |

No match → say which tool is missing and stop. Do not fall back to pasted multiple choice.

## Shared quiz shape

- 1–3 questions per call. Wait.
- One right answer. `multi_select` / `multiSelect` / `multiple` = false.
- Options: 3 content choices + **I don't know**.
- Do **not** mark the correct option `(Recommended)` or put it first on purpose. That leaks the answer. Shuffle or keep a fixed A/B/C order that is not “right answer first.”
- Free-text / Other is for talk-through. Treat a typed reason as signal when scoring.
- Header / strand tag: short (≤12 chars if the tool requires it), e.g. `synbio`, `promoter`, `dogma`.

## Grok — `ask_user_question`

```
ask_user_question
  questions:
    - question: "<stem>"
      options:
        - label: "<choice>"
          description: "<what this choice means, not whether it is right>"
        - label: "I don't know"
          description: "Skip this strand; do not guess."
      multi_select: false
```

Grok always adds Other. That is the talk-through slot.

## Claude Code — `AskUserQuestion`

```
AskUserQuestion
  questions:
    - question: "<stem>"
      header: "<strand>"
      options:
        - label: "<choice>"
          description: "<what this choice means>"
        - label: "I don't know"
          description: "Skip this strand; do not guess."
      multiSelect: false
```

Tool constraints that shape the quiz:

- `header` is at most 12 characters. `description` is required on every option; describe the choice, never its correctness.
- 2–4 options per question, so 3 content choices + **I don't know** fills it exactly. The tool adds **Other** itself; that is the talk-through slot.
- Never append `(Recommended)` to a label. The tool's convention puts a recommended option first, so do not put the right answer first.
- Option text renders as plain text. `preview` renders monospace Markdown, not LaTeX; use it only when the choices themselves are code snippets to compare.
- A dismissed or cancelled picker is not a wrong answer. Grade nothing, say so, and ask in chat whether to retry.

Where the stem and choices go:

- **Plain-language question, no display log:** put the full stem in `question` and the full choices in `label` / `description`.
- **Stem needs a code block or is long:** print the stem (code included) in chat immediately before the call, or write it to the display log. Choices still go only in the picker.
- **Mathematics that needs typesetting, or `.alvar/LEARNER.md` names a display log:** use the display-log split below.

### Markdown-log diagnostic display with answers in Claude Code

Same split as the Codex version further down, with `AskUserQuestion` as the picker:

1. Write the complete question and all choices labelled `A`–`D` to the display log first, with `$...$` / `$$...$$` LaTeX. `D` is always **I don't know**. No answer key or correctness cues.
2. Call `AskUserQuestion` with the question `Choose the letter shown in the Learning Log (<question number>).` and four options labelled `A`, `B`, `C`, `D`. Because descriptions are required, use the neutral `Option A in the Learning Log`, and for `D` `I don't know`. Do not repeat the stem or choice text.
3. Wait for the result, grade it, update canonical `.alvar` state, then update the display log with the result and route.

To bring the display log to the front in Obsidian, run `open "obsidian://open?path=<url-encoded absolute path to the log>"`. This selects the right vault as well as the note. If it fails, give the learner the file path; do not claim the note is visibly open.

## Codex — `ask_user_question`

Same job as Grok: tabbed questionnaire, constrained answers. One right option + I don't know. Do not use `request_user_input` for graded quizzes.

## Codex desktop — Alvar MCP picker

Use `mcp__alvar_quiz__ask_user_question` when available. Depending on tool-name rendering, it may appear as `ask_user_question` under the `alvar_quiz` MCP server.

```
questions:
  - header: "<strand, short>"
    question: "<stem>"
    options:
      - label: "<choice>"
        description: "<what this choice means, not whether it is right>"
      - label: "I don't know"
        description: "Skip this strand; do not guess."
```

The server opens whichever structured picker its local configuration selects. In `obsidian` mode, it writes an answer-key-free request to the configured vault and waits for the **Alvar Quiz Picker** plugin; that plugin renders Markdown and LaTeX in an Obsidian modal and returns the learner's selection. In native mode, the server uses Codex form elicitation. Both modes return structured `answers` containing `label`, `optionIndex`, and optional `reason`. The server never knows or marks the correct answer. Grade only after the tool returns. A declined or cancelled picker is not a wrong answer.

If Obsidian mode reports that the picker did not respond, tell the learner to open the configured vault, enable **Alvar Quiz Picker**, and retry. Do not expose the pending choices in chat and do not silently switch picker modes.

### Markdown-log diagnostic display with answers in Codex

If `.alvar/LEARNER.md` says the learner reads a visible Markdown display log but answers diagnostic questions in Codex, use the Codex-native MCP picker and follow this split deliberately:

1. Write the complete question and all choices labelled `A`–`D` to the configured display log before calling the tool. Render every mathematical expression with `$...$` or `$$...$$` and proper LaTeX commands. `D` is always **I don't know**.
2. Keep the display unbiased: no answer key, recommendation, correctness styling, or right-answer-first ordering.
3. Call the Codex picker with the exact question `Choose the letter shown in the Obsidian Learning Log.` and exactly four options whose labels are `A`, `B`, `C`, and `D`. Omit every option description. Do not repeat the stem, formulas, or choice text in the picker.
4. Wait for the native picker result, grade it, update canonical `.alvar` state, and then update the display log with the result and route.

Do not open the Obsidian quiz bridge in this mode. Obsidian is the rendered lesson surface; Codex is the interaction surface.

If the server is configured but the tool is absent, tell the learner to start a new Codex task or restart Codex so MCP discovery runs again. Do not substitute `request_user_input`: its recommendation semantics can leak or bias a graded answer.

## OpenCode — `question`

```
question
  questions:
    - header: "<strand>"
      text: "<stem>"
      options:
        - label: "<choice>"
          description: "<what this choice means>"
        - label: "I don't know"
          description: "Skip this strand; do not guess."
```

## Pi

1. If `quiz` exists (graded quiz extension, as in Eero Alvar’s demo), use it.
2. Else `ask_user` / `askUserQuestion` / `ask_user_question`.
3. Else tell the user to install a quiz or ask-user extension (`pi install npm:pi-ask-user` or their preferred quiz package). Still do not paste MCQs.

## Scoring after the tool returns

Map the selected label to A/B/C/D only in the **map file**, not in the next chat turn as a new quiz. Then update `.alvar/maps/<slug>.md` and continue.
