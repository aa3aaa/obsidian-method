---
name: learn-verify
description: >
  Fact-check a teaching claim against sources so the learner can trust the
  single interface. Use when the user runs /learn-verify or /skill:learn-verify,
  or says fact-check, verify this, is this true, source this, don't hallucinate,
  or when a teach/plan step needs a claim checked before it is taught as fact.
license: MIT
metadata:
  author: vasanthsreeram
  version: "1.0"
  source: "Eero Alvar — How I Use AI to Learn Things https://youtu.be/kzcI5F4tGiU"
---

# Learn verify

Trust is engineered. Check the claim before it is taught as fact.

## When to run

- Empirical, historical, bibliographic, or API/tool claims
- Named theorems, identities, or "standard facts" you cannot reconstruct
- Anything you were about to present with unearned certainty

Skip a full search only when you can derive the statement in-session and the learner does not need an external citation. Still say that it was derived, not sourced.

## Method

1. Write the claim in one falsifiable sentence.
2. Fetch or search primary-ish sources (paper, textbook, official docs, standard reference). Do not cite a URL you did not open.
3. Quote or paraphrase the supporting line. Note edition / year if it matters.
4. Mark disagreements. Prefer the source the field actually uses.
5. Return a verdict.

## Verdict

```markdown
## Claim
…

## Verdict
confirmed | qualified | contradicted | unknown

## Sources
- <title> — <url or citation> — <what it says>

## Teach as
<one sentence the teacher may now say, with any hedge>
```

`qualified` = true under stated assumptions (dimension, characteristic, gauge, version).

`unknown` = do not teach it as fact. Say you could not verify.

## Rules

- No invented papers, quotes, or page numbers.
- One claim per run. Batch only if they are the same fact in different words.
- Write the verdict into the session file if a teach session is open.

## As the Verifier agent

When `teach` starts you as its Verifier (see [../teach/references/agents.md](../teach/references/agents.md)), the brief holds several claims, each with an id and the page it should come from.

- Judge each claim separately with the method above. The one-claim rule does not apply to this batch.
- Check course claims against the cited page of the deck (or the prep notes, then the deck if the notes are unclear). Use outside sources only for claims marked beyond the source, or when the deck itself looks wrong.
- You know only the claims, not the lesson. Do not guess what the tutor meant; judge the sentence as written.
- Write no files. Return only the table: `| id | claim | verdict | source (page or URL actually opened) | teach as |`.
- If the brief repeats an assessed-work rule, follow it: never open or quote a lab or assignment deliverable.
