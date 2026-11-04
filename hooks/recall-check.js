#!/usr/bin/env node
// Active-recall trigger for the Alvar tutoring skills (Claude Code hook).
//
// Register this one script for three events (see hooks/install.js):
//   SessionStart      — a new session in a course folder offers recall when cards are due
//   UserPromptSubmit  — the first prompt after a long break on a new day offers recall
//   Stop              — records activity so idle gaps can be measured
//
// It never blocks anything: every path exits 0, and any error is swallowed.
// When recall should be offered it prints one JSON object with a
// `systemMessage` (shown to the learner) and `additionalContext` (seen by Claude).
//
// Debug from a course folder:  node /path/to/hooks/recall-check.js --status
//
// Rules (teach/references/recall.md has the full spec):
//   * The learner root is the nearest ancestor of `cwd` that contains `.alvar/`.
//   * Cards live in <root>/.alvar/recall.md; a card is due when due <= study day.
//   * A "study day" starts on a new calendar day once the learner has had a break:
//       - crossing midnight with an idle gap >= crossGapHours (default 2) starts it;
//       - crossing midnight mid-session (gap < crossGapHours) keeps yesterday's study
//         day until an idle gap >= idleGapHours (default 4).
//   * New session (startup / clear / fork) + due cards -> offer.
//   * Resume or a prompt in an open session -> offer only when a new study day starts.
//   * Never when recall is off, nothing is due, or the learner chose "skip today".
//   * At most one offer per session per study day.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const HOUR = 3600 * 1000;
const STATE_FILE = 'recall-state.json';
const DECK_FILE = 'recall.md';

// ---------- dates (local time) ----------

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------- settings ----------

const DEFAULT_SETTINGS = { recall: 'on', recall_max: 5, recall_cross_gap: 2, recall_idle_gap: 4 };

function parseSettings(text) {
  const s = { ...DEFAULT_SETTINGS };
  for (const raw of (text || '').split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([a-z_]+)\s*:\s*(\S+)/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].toLowerCase();
    if (key === 'recall') s.recall = val === 'off' ? 'off' : 'on';
    else if (key === 'recall_max' || key === 'recall_cross_gap' || key === 'recall_idle_gap') {
      const n = parseFloat(val);
      if (Number.isFinite(n) && n > 0) s[key] = n;
    }
  }
  return s;
}

function readSettings(home) {
  try {
    return parseSettings(fs.readFileSync(path.join(home, '.alvar', 'settings.md'), 'utf8'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// ---------- deck ----------

function splitRow(line) {
  // "| a | b \| c | d |" -> ["a", "b | c", "d"]
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '\\' && inner[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function parseDeck(text) {
  const cards = [];
  let header = null;
  for (const line of (text || '').split('\n')) {
    if (!line.trim().startsWith('|')) { header = null; continue; }
    const cells = splitRow(line);
    if (!header) { header = cells.map((c) => c.toLowerCase()); continue; }
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue; // separator row
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i] || ''; });
    if (!row.id || !/^\d{4}-\d{2}-\d{2}$/.test(row.due || '')) continue;
    if (/^(retired|paused)$/i.test(row.box || '')) continue;
    cards.push({ id: row.id, topic: row.topic || row.idea || row.id, due: row.due, box: row.box || '' });
  }
  return cards;
}

function dueCards(cards, studyDay) {
  return cards
    .filter((c) => c.due <= studyDay)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}

// ---------- study day ----------

// Returns { studyDay, started } where `started` is true when a new study day
// begins at `now`. `state` may be empty (first run).
function advanceStudyDay(state, now, settings) {
  const today = dayKey(now);
  if (!state.study_day || !state.last_activity) return { studyDay: today, started: true };
  if (state.study_day >= today) return { studyDay: state.study_day, started: false };

  const last = new Date(state.last_activity);
  if (Number.isNaN(last.getTime())) return { studyDay: today, started: true };
  const gap = now - last;

  // Crossing midnight now (last activity was on an earlier calendar day).
  if (dayKey(last) < today) {
    if (gap >= settings.recall_cross_gap * HOUR) return { studyDay: today, started: true };
    return { studyDay: state.study_day, started: false };
  }
  // Already active after midnight, still in yesterday's study day: wait for a long break.
  if (gap >= settings.recall_idle_gap * HOUR) return { studyDay: today, started: true };
  return { studyDay: state.study_day, started: false };
}

// ---------- the decision (pure) ----------

// event: { name: 'SessionStart'|'UserPromptSubmit'|'Stop', source?, sessionId }
// Returns { offer: bool, reason, studyDay, due: [cards], nextState }
function decide({ event, state, now, settings, cards }) {
  state = state || {};
  const { studyDay, started } = advanceStudyDay(state, now, settings);
  const nextState = { ...state, study_day: studyDay, last_activity: now.toISOString() };
  const result = (offer, reason, due = []) => ({ offer, reason, studyDay, due, nextState });

  if (event.name === 'Stop') return result(false, 'activity recorded');
  if (settings.recall === 'off') return result(false, 'recall is off in ~/.alvar/settings.md');
  if (state.skip_day && state.skip_day === studyDay) return result(false, `skipped for study day ${studyDay}`);

  const due = dueCards(cards, studyDay);
  if (due.length === 0) return result(false, `no cards due on study day ${studyDay}`);

  const offered = state.last_offer || {};
  if (offered.session === event.sessionId && offered.day === studyDay) {
    return result(false, 'already offered in this session today', due);
  }

  let trigger = null;
  if (event.name === 'SessionStart') {
    const src = event.source || 'startup';
    if (src === 'compact') return result(false, 'compaction is not a new session', due);
    if (src === 'resume') trigger = started ? 'resumed after a break on a new day' : null;
    else trigger = 'new session';
  } else if (event.name === 'UserPromptSubmit') {
    trigger = started ? 'back after a break on a new day' : null;
  }
  if (!trigger) return result(false, 'same study day and no break', due);

  nextState.last_offer = { session: event.sessionId || null, day: studyDay };
  return { ...result(true, trigger, due), nextState };
}

// ---------- output ----------

function buildOutput(eventName, decision, root, settings) {
  const due = decision.due;
  const n = due.length;
  const course = path.basename(root);
  const topics = [...new Set(due.map((c) => c.topic))];
  const shown = topics.slice(0, 4).join(', ') + (topics.length > 4 ? `, +${topics.length - 4} more` : '');
  const overdue = due.filter((c) => c.due < decision.studyDay).length;
  const minutes = Math.max(2, Math.round(Math.min(n, settings.recall_max) * 1.5));

  const systemMessage =
    `Active recall: ${n} card${n === 1 ? '' : 's'} due in ${course}` +
    (overdue ? ` (${overdue} overdue)` : '') +
    ` — ${shown}. About ${minutes} min.`;

  const lines = [
    `Active recall status for the learner root ${root} (${decision.reason}).`,
    `Study day: ${decision.studyDay}. Due cards: ${n}${overdue ? `, ${overdue} overdue` : ''}. Round size setting: ${settings.recall_max}.`,
    `Due: ${due.slice(0, 12).map((c) => `${c.id} ${c.topic} (box ${c.box || '?'}, due ${c.due})`).join('; ')}${n > 12 ? '; …' : ''}.`,
    'The learner set up the Alvar recall feature to be offered a recall round when cards are due, before other work.',
    'The round procedure, picker options and state updates are in teach/references/recall.md ("Offering a round"), used by the recall skill.',
  ];

  return {
    systemMessage,
    hookSpecificOutput: { hookEventName: eventName, additionalContext: lines.join('\n') },
  };
}

// ---------- io ----------

// The nearest ancestor of `start` holding `.alvar/`. The home folder is never a
// learner root: ~/.alvar/ holds the machine-wide settings.md and roots.md.
function findRoot(start, home = os.homedir()) {
  let dir = path.resolve(start || process.cwd());
  const homeDir = path.resolve(home);
  for (;;) {
    try {
      if (dir !== homeDir && fs.statSync(path.join(dir, '.alvar')).isDirectory()) return dir;
    } catch { /* keep walking */ }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function writeJsonAtomic(file, obj) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function loadContext(cwd, home) {
  const root = findRoot(cwd, home);
  if (!root) return null;
  const alvar = path.join(root, '.alvar');
  let deckText = '';
  try { deckText = fs.readFileSync(path.join(alvar, DECK_FILE), 'utf8'); } catch { /* no deck yet */ }
  return {
    root,
    statePath: path.join(alvar, STATE_FILE),
    state: readJson(path.join(alvar, STATE_FILE)),
    cards: parseDeck(deckText),
    settings: readSettings(home),
  };
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function runHook() {
  let input = {};
  try { input = JSON.parse(readStdin() || '{}'); } catch { input = {}; }
  const ctx = loadContext(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(), os.homedir());
  if (!ctx) return;
  const event = { name: input.hook_event_name, source: input.source, sessionId: input.session_id };
  if (!['SessionStart', 'UserPromptSubmit', 'Stop'].includes(event.name)) return;

  // Re-read just before writing so a skip_day the tutor wrote mid-turn is kept.
  const decision = decide({ event, state: ctx.state, now: new Date(), settings: ctx.settings, cards: ctx.cards });
  const latest = readJson(ctx.statePath);
  const merged = { ...latest, ...pick(decision.nextState, ['study_day', 'last_activity', 'last_offer']) };
  try { writeJsonAtomic(ctx.statePath, merged); } catch { /* read-only folder: still answer */ }

  if (decision.offer) process.stdout.write(JSON.stringify(buildOutput(event.name, decision, ctx.root, ctx.settings)));
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function runStatus(cwd) {
  const ctx = loadContext(cwd, os.homedir());
  if (!ctx) { console.log(`No .alvar/ folder found at or above ${path.resolve(cwd)}.`); return; }
  const now = new Date();
  const { studyDay, started } = advanceStudyDay(ctx.state, now, ctx.settings);
  const due = dueCards(ctx.cards, studyDay);
  console.log(`Learner root:  ${ctx.root}`);
  console.log(`Settings:      recall ${ctx.settings.recall}, max ${ctx.settings.recall_max}, cross-midnight gap ${ctx.settings.recall_cross_gap}h, overnight idle gap ${ctx.settings.recall_idle_gap}h`);
  console.log(`Last activity: ${ctx.state.last_activity || 'none recorded'}`);
  console.log(`Study day:     ${studyDay}${started ? ' (a new study day would start now)' : ''}`);
  console.log(`Skip day:      ${ctx.state.skip_day || 'none'}`);
  console.log(`Cards:         ${ctx.cards.length} in deck, ${due.length} due`);
  for (const c of due) console.log(`  - ${c.id} ${c.topic} (box ${c.box || '?'}, due ${c.due})`);
  const asNew = decide({ event: { name: 'SessionStart', source: 'startup', sessionId: '--status' }, state: ctx.state, now, settings: ctx.settings, cards: ctx.cards });
  console.log(`A new session now would ${asNew.offer ? 'OFFER recall' : `not offer recall (${asNew.reason})`}.`);
}

if (require.main === module) {
  try {
    const i = process.argv.indexOf('--status');
    if (i !== -1) runStatus(process.argv[i + 1] || process.cwd());
    else runHook();
  } catch {
    // Never break the learner's session.
  }
  process.exitCode = 0;
}

module.exports = { dayKey, parseSettings, parseDeck, dueCards, advanceStudyDay, decide, buildOutput, findRoot };
