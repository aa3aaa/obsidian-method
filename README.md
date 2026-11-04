# obsidian-method

My version of the **Alvar-method tutoring skills** for coding agents (Claude Code, Codex and others that read `SKILL.md` folders), with **active recall** added.

The method is **Eero Alvar's**, from his video [*How I Use AI to Learn Things*](https://youtu.be/kzcI5F4tGiU). This repo is copied from [samueltlai/teach](https://github.com/samueltlai/teach), whose skill files started as [vasanthsreeram/Alvarmethod](https://github.com/vasanthsreeram/Alvarmethod) (MIT). See [Credits](#credits) for exactly what came from where. Changes over the original:

- free-response lock-ins after each teaching step (diagnostic probes stay multiple choice)
- a visible Markdown display log (Obsidian) mirrored from the canonical `.alvar/` state
- `~/.alvar/roots.md` index of learner roots, so sessions resume from any starting directory
- harness-neutral wording so the same files work in Claude Code and Codex
- **active recall**: every locked step becomes a spaced-repetition card, and returning to a course folder offers a short recall round when cards are due (new in this repo)

## Skills

| skill | job |
|---|---|
| `teach` | probe → mermaid plan → one reasoning step per turn with a lock-in |
| `probe` | graded diagnostic quiz that maps `known / edge / unknown / blocked` |
| `learn-profile` | interview that writes `.alvar/LEARNER.md` |
| `learn-verify` | fact-check a claim before it is taught |
| `learn-visual` | one SVG per idea, viewed and fixed before use |
| `recall` | spaced-repetition round: fresh free-response questions on the cards that are due |

## Active recall

Every node you lock in during `teach` becomes a **card** in your course folder's `.alvar/recall.md`. Cards come back on a Leitner schedule (1 → 3 → 7 → 14 → 30 → 60 days): a correct answer moves a card up a box, a partial answer keeps it where it is, and a wrong one sends it back to tomorrow and marks that topic `edge` again. Every review is a **fresh** free-response question on the card's idea, never the old prompt word for word, so you can't learn the question instead of the idea.

When cards are due, you get offered a round (picker: **Do 5 / Quick 2 / Not now / Skip today**):

- **New session** in a course folder (or any folder under it): offered whenever cards are due.
- **Same session the next day**: offered on your first prompt after a break, once a new study day has started.
- **Working through midnight**: crossing midnight after at least 2 hours idle starts the new study day straight away. If you were still working when midnight passed, it waits until you've been idle for 4 hours (or until noon, if you never stop), so a late-night session isn't interrupted.
- **Never** when nothing is due, after **Skip today**, or twice in one session on the same study day.

The automatic offer comes from a small Claude Code hook ([`hooks/recall-check.js`](hooks/recall-check.js)). Without it (Codex, other harnesses), `teach` checks for due cards at the start of each lesson, and `/recall` works anywhere. Full rules: [`teach/references/recall.md`](teach/references/recall.md).

Already have lesson logs from before recall existed? Say "build my recall deck" and it cards every node you locked in earlier, spread out so no day gets more than a full round.

## Discovery style

`teach` tags each plan node `truth` (a fact accepted as stated, no conditions), `discover` (a result that feels arbitrary unless you see how it could have been found) or `step` (everything else). Discover nodes open with a concrete problem and walk a motivated path to the result. A node also switches to discovery mid-lesson when the learner is confused ("explain this further", "I don't understand this"), when a retry shows rote matching, or on request; "just tell me" always wins. See [`teach/references/discovery.md`](teach/references/discovery.md).

## Helper agents

`teach` hands four jobs to separate agents (subagents where the harness supports them, inline otherwise), defined in [`teach/references/agents.md`](teach/references/agents.md):

| agent | runs | job |
|---|---|---|
| Prep | once per lecture deck (or on "prep week N") | reads the deck, writes claim-by-claim notes with page numbers to `.alvar/prep/` |
| Verifier | after each plan, for inserted nodes, for claims beyond the slides | independently checks the plan's load-bearing claims; sees the claims and sources, never the lesson |
| Visual | when a step needs a picture | draws, views and fixes one SVG |
| Scribe | at the end of a session, or on resume | writes a short `## Resume here` block so the next session starts fast |

Prep, Visual and Scribe are on by default. The Verifier runs in **lite** mode by default: it checks slide claims by lookup against Prep's saved quotes (no extra agent) and sends only claims beyond the slides, plus the no-conditions check on truths, to one cheap-model agent per session. See "Switches" in `agents.md` to change any of this.

Learner state (maps, sessions, logs) lives in each course folder's `.alvar/`, never in this repo.

## Setup

**1. Install the skills.** Clone this repo and link each skill into your agent's skills folder:

```bash
git clone https://github.com/aa3aaa/obsidian-method.git ~/src/obsidian-method
mkdir -p ~/.claude/skills ~/.agents/skills
for s in teach probe learn-profile learn-verify learn-visual recall; do
  ln -s ~/src/obsidian-method/$s ~/.claude/skills/$s   # Claude Code
  ln -s ~/src/obsidian-method/$s ~/.agents/skills/$s   # Codex and other agents that read ~/.agents/skills
done
```

Other agents: link into wherever they look for `SKILL.md` folders. Update later with `git -C ~/src/obsidian-method pull`.

**1b. Install the recall hook (Claude Code).** This adds the automatic recall offer to `~/.claude/settings.json`, keeping everything else in it and backing up the old file first:

```bash
node ~/src/obsidian-method/hooks/install.js            # --dry-run to preview, --uninstall to remove
```

Start a new Claude Code session afterwards. To see what it would do in a course folder: `node ~/src/obsidian-method/hooks/recall-check.js --status`. Tests: `node --test ~/src/obsidian-method/hooks/test/*.test.js`.

**2. Install Poppler** so lecture PDFs can be read page by page (Prep depends on it): `brew install poppler` on macOS, `apt install poppler-utils` on Debian/Ubuntu.

**3. Set up a course folder.** Open your agent in (or point it at) the folder for one course, put the lecture slides there, and run `/learn-profile`. It writes `.alvar/LEARNER.md` and adds the folder to `~/.alvar/roots.md`, so later sessions find it from any directory. Tell the profile where the slides are; `teach` treats them as the source of truth.

**4. Obsidian (optional, recommended).** Open the course folder as an Obsidian vault. When `/learn-profile` asks where you read, say Obsidian: it creates `<Course> Learning Log.md` and sets it as the display log. Lessons, plans (mermaid) and checks (LaTeX) then appear there, rendered, while you answer in the agent chat. Diagrams are copied into a `visuals/` folder beside the log, because Obsidian ignores `.alvar/`.

**5. Settings (optional).** Create `~/.alvar/settings.md` to change the helper agents or recall, for example:

```markdown
# Alvar settings
verifier: on        # full Verifier (default: lite); or off
visual: off
recall: on          # off disables recall offers
recall_max: 5       # cards in a full round
recall_cross_gap: 2 # hours idle at midnight that start a new study day
recall_idle_gap: 4  # hours idle needed after working through midnight
recall_day_ceiling: 12 # ...or the new study day starts at this hour anyway
```

**6. Start.** Start Claude Code inside the course folder (so the recall hook can see it), then say `/teach <what you want to learn>`, "continue" to resume the latest lesson, or `/recall` to review.

## Credits

- **Eero Alvar** — the learning method this whole repo runs: one teacher for one mind, teaching at the edge of understanding, probe → plan → teach, a lock-in after every step, and trust engineered through verification. From his video [*How I Use AI to Learn Things*](https://youtu.be/kzcI5F4tGiU).
- **Eero Alvar's own system, [amosblomqvist/learn](https://github.com/amosblomqvist/learn)** — the source of two ideas here: the **discovery style** (unconditional truths first, then "how could I have discovered this?") and **handing research and diagrams to subagents**, which the helper agents follow. That repo has no licence, so nothing from it is copied: `discovery.md` and `agents.md` are fresh write-ups of the ideas.
- **Vasanth Sreeram, [vasanthsreeram/Alvarmethod](https://github.com/vasanthsreeram/Alvarmethod)** — the original portable `SKILL.md` implementation (`teach`, `probe`, `learn-profile`, `learn-verify`, `learn-visual`) that these files started from, used under the MIT licence; its notice is in [LICENSE](LICENSE).
- **Samuel Lai, [samueltlai/teach](https://github.com/samueltlai/teach)** — the version this repo is copied from, with its history: free-response lock-ins, the Obsidian display log, the roots index, the helper agents and the discovery style.
- **Active recall** (the `recall` skill, `teach/references/recall.md` and `hooks/`) is new in this repo.

Thanks to all of them. If you like this, go watch the video and star their repos.
