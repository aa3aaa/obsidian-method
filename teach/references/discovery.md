# Discovery style

Some ideas only stick once the learner sees why they have to be that way. Stated bare, they feel arbitrary, and an arbitrary-feeling fact is held loosely and forgotten. For those nodes, change **how the step is delivered**. The loop does not change: one node per turn, one constructed-response lock-in, advance only on lock-in.

The idea comes from the discovery method in Eero Alvar's video and its creator's own setup; this file is a fresh write-up of it.

## Three node tags

Every node in the plan gets one tag.

| tag | what it is | mermaid shape |
|---|---|---|
| **truth** | A fact the learner can accept exactly as stated, with no conditions or exceptions: a real definition, or a statement of the form "every X…" / "no X…". | `T1([...])` |
| **discover** | A result that feels arbitrary if just stated: a derivation, the choice of a formula, a design pattern, an algorithm's design. | `D1{{...}}` |
| **step** | Everything else: notation, syntax, terminology, applying a method already locked. The default. | `S1[...]` |

Show a one-line legend under the diagram in the display log.

## Tagging at plan time

Tag a node **discover** only when all three hold:

1. It answers a "why is it like this?" question.
2. Every node it depends on is already locked or comes earlier in the plan, so there is something to discover it *from*.
3. Stating it bare would feel arbitrary.

Tag **truth** for the few foundations the discover nodes stand on. If a candidate needs a caveat ("usually", "in most cases", "except when"), it is not a truth: go one level lower, or make it a step. A truth whose check the learner fails is not safe to build on; fix it before any node that depends on it.

The learner may retag any node while reviewing the plan.

## Switching mid-lesson

Switch the **current** node to discover when any of these happens:

1. **Confusion about this concept.** The learner signals they are lost on something already taught: "explain this further", "I don't understand this", "this makes no sense", "why though?", "where did that come from?", "huh", or "I don't know" to a check on a taught idea. Judge by meaning, not exact words. ("I don't know" to an untaught idea is not confusion; that is a ramp, per lock-in-response.md.)
2. **A rote retry.** A retry shows the learner matched surface features instead of the reason (for example classifying a parameter by its Java type rather than by what it does).
3. **A request.** The learner says "discover this" or asks how someone would have come up with it.

**Before switching on confusion, find its source** from what the learner said:

- **The step itself feels arbitrary** → discover now.
- **An earlier idea is missing** (the confusion points at a term or idea from before this node) → insert that idea as a small truth or step node first, lock it, then discover this node.

Do not make the learner diagnose their own confusion. Ask one short question only if you genuinely cannot tell which case it is.

**Switching off.** "Just tell me", "skip" or similar always wins: state the result plainly as a step, and record it as taught-not-discovered.

## Running a discover node

1. **Problem.** Open with a concrete problem the learner can feel, built only from locked nodes, with its own data in the prompt. Restate the locked ideas it uses; never just cite a node number.
2. **Attempt or narrate.**
   - *Socratic*: pose the problem and let the learner try the decisive move first. Use this when they can plausibly reason their way there.
   - *Narrated*: walk the path yourself, one motivated move at a time, and hand the learner only the last move. Use this when the move is beyond cold reasoning, when the learner asks for it, and **always when the switch was triggered by confusion**, in smaller pieces than the first explanation.
3. **Motivate every move.** For each move, say why it is the natural thing to try next. Nothing appears from nowhere.
4. **Connect.** Name the edges: which locked ideas this node rests on, restated in a phrase each.
5. **Lock in.** One constructed response per lock-in-response.md that tests the decisive move on a fresh case, or asks the learner to rebuild the path from the truths in a few lines.

A Socratic attempt is part of discovering, not the lock-in: a wrong attempt is not a `retry`. Grade only the lock-in that follows.

If confusion continues inside a discover node: Socratic → narrated in smaller pieces → insert a prerequisite.

### Running a truth node

State it plainly, once. The check asks the learner to put it in their own words and give one example and one non-example. If it does not read as obviously true to them, find out why before building on it.

## Records

In the session file, each node's log gets a style line:

```
- style: step | truth | discover (planned | confusion | retry | request)
```

The Verifier checks every truth node for hidden conditions (see agents.md). The Scribe carries the current node's style into the Resume block.
