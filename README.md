# teach

My working copy of the **Alvar-method tutoring skills** for coding agents (Claude Code, Codex and others that read `SKILL.md` folders).

The method is **Eero Alvar's**, from his video [*How I Use AI to Learn Things*](https://youtu.be/kzcI5F4tGiU). The skill files started as [vasanthsreeram/Alvarmethod](https://github.com/vasanthsreeram/Alvarmethod) (MIT). See [Credits](#credits) for exactly what came from where. Local changes:

- free-response lock-ins after each teaching step (diagnostic probes stay multiple choice)
- a visible Markdown display log (Obsidian) mirrored from the canonical `.alvar/` state
- `~/.alvar/roots.md` index of learner roots, so sessions resume from any starting directory
- harness-neutral wording so the same files work in Claude Code and Codex

## Skills

| skill | job |
|---|---|
| `teach` | probe → mermaid plan → one reasoning step per turn with a lock-in |
| `probe` | graded diagnostic quiz that maps `known / edge / unknown / blocked` |
| `learn-profile` | interview that writes `.alvar/LEARNER.md` |
| `learn-verify` | fact-check a claim before it is taught |
| `learn-visual` | one SVG per idea, viewed and fixed before use |

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
git clone https://github.com/samueltlai/teach.git ~/src/teach
mkdir -p ~/.claude/skills ~/.agents/skills
for s in teach probe learn-profile learn-verify learn-visual; do
  ln -s ~/src/teach/$s ~/.claude/skills/$s   # Claude Code
  ln -s ~/src/teach/$s ~/.agents/skills/$s   # Codex and other agents that read ~/.agents/skills
done
```

Other agents: link into wherever they look for `SKILL.md` folders. Update later with `git -C ~/src/teach pull`.

**2. Install Poppler** so lecture PDFs can be read page by page (Prep depends on it): `brew install poppler` on macOS, `apt install poppler-utils` on Debian/Ubuntu.

**3. Set up a course folder.** Open your agent in (or point it at) the folder for one course, put the lecture slides there, and run `/learn-profile`. It writes `.alvar/LEARNER.md` and adds the folder to `~/.alvar/roots.md`, so later sessions find it from any directory. Tell the profile where the slides are; `teach` treats them as the source of truth.

**4. Obsidian (optional, recommended).** Open the course folder as an Obsidian vault. When `/learn-profile` asks where you read, say Obsidian: it creates `<Course> Learning Log.md` and sets it as the display log. Lessons, plans (mermaid) and checks (LaTeX) then appear there, rendered, while you answer in the agent chat. Diagrams are copied into a `visuals/` folder beside the log, because Obsidian ignores `.alvar/`.

**5. Settings (optional).** Create `~/.alvar/settings.md` to change the helper agents, for example:

```markdown
# Alvar settings
verifier: on    # full Verifier (default: lite); or off
visual: off
```

**6. Start.** Say `/teach <what you want to learn>`, or "continue" to resume the latest lesson.

## Credits

- **Eero Alvar** — the learning method this whole repo runs: one teacher for one mind, teaching at the edge of understanding, probe → plan → teach, a lock-in after every step, and trust engineered through verification. From his video [*How I Use AI to Learn Things*](https://youtu.be/kzcI5F4tGiU).
- **Eero Alvar's own system, [amosblomqvist/learn](https://github.com/amosblomqvist/learn)** — the source of two ideas here: the **discovery style** (unconditional truths first, then "how could I have discovered this?") and **handing research and diagrams to subagents**, which the helper agents follow. That repo has no licence, so nothing from it is copied: `discovery.md` and `agents.md` are fresh write-ups of the ideas.
- **Vasanth Sreeram, [vasanthsreeram/Alvarmethod](https://github.com/vasanthsreeram/Alvarmethod)** — the original portable `SKILL.md` implementation (`teach`, `probe`, `learn-profile`, `learn-verify`, `learn-visual`) that these files started from, used under the MIT licence; its notice is in [LICENSE](LICENSE).
- Changes in this repo (free-response lock-ins, Obsidian display log, roots index, helper agents, discovery style) are my own, made with Claude Code.

Thanks to all of them. If you like this, go watch the video and star their repos.
