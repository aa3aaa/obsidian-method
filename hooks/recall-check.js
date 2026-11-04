#!/usr/bin/env node
// Active-recall trigger for the Alvar tutoring skills (Claude Code hook).
//
// Register this one script for three events (see hooks/install.js):
//   SessionStart      — a new session in a course folder offers recall when cards are due
//   UserPromptSubmit  — the first prompt of a new study day offers recall
//   Stop              — records activity so idle gaps can be measured
//
// It never blocks anything: every path exits 0, and any error is swallowed.
// When recall should be offered it prints one JSON object with a
// `systemMessage` (shown to the learner) and `additionalContext` (seen by Claude).
//
// Debug from a course folder:  node /path/to/hooks/recall-check.js --status
//
// Rules (teach/references/recall.md has the full spec):
//   * The learner root is the nearest ancestor of `cwd` that contains `.alvar/`
//     (never the home folder, whose ~/.alvar/ holds settings and the roots index).
//   * Cards live in <root>/.alvar/recall.md; a card is due when due <= study day.
//   * A "study day" starts on a new calendar day once the learner has had a break:
//       - crossing midnight with an idle gap >= recall_cross_gap hours (default 2) starts it;
//       - crossing midnight mid-session keeps yesterday's study day until an idle gap
//         >= recall_idle_gap hours (default 4), or until recall_day_ceiling o'clock
//         (default 12), whichever comes first.
//   * Each session remembers the last study day it saw. Recall is offered on a
//     SessionStart or prompt when that session has not yet seen the current study
//     day and cards are due. So: a new session offers; an open or resumed session
//     offers on its first prompt of a new study day; nothing repeats within a day.
//   * Never when recall is off, nothing is due, or the learner chose "skip today".

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const HOUR = 3600 * 1000;
const STATE_FILE = 'recall-state.json';
const DECK_FILE = 'recall.md';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const BOX_RE = /^([1-6]|retired|paused)$/i;
const MAX_SESSIONS = 30;
const ACTIVITY_WRITE_MS = 5 * 60 * 1000; // coalesce activity-only writes (eases cloud sync)

// ---------- dates (local time) ----------

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

// ---------- settings ----------

const DEFAULT_SETTINGS = { recall: 'on', recall_max: 5, recall_cross_gap: 2, recall_idle_gap: 4, recall_day_ceiling: 12 };
const NUMERIC = ['recall_max', 'recall_cross_gap', 'recall_idle_gap', 'recall_day_ceiling'];

function parseSettings(text) {
  const s = { ...DEFAULT_SETTINGS };
  for (const raw of (text || '').split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([a-z_]+)\s*:\s*(\S+)/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].toLowerCase();
    if (key === 'recall') s.recall = val === 'off' ? 'off' : 'on';
    else if (NUMERIC.includes(key)) {
      const n = parseFloat(val);
      if (Number.isFinite(n) && n > 0 && !(key === 'recall_day_ceiling' && n > 24)) s[key] = n;
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

// Map cells to header names. Free-text columns (idea, source…) may hold an
// unescaped pipe, e.g. `a || b` in code, so a row can have extra cells. Columns
// before the first free-text column are read from the left, columns from `box`
// onwards from the right, which keeps id, topic, box, last and due correct.
function mapRow(header, cells) {
  if (cells.length === header.length) {
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  }
  const boxAt = header.indexOf('box');
  if (boxAt === -1 || cells.length < header.length) return null;
  const row = {};
  const left = Math.min(header.indexOf('topic') + 1 || 1, boxAt);
  for (let i = 0; i < left; i++) row[header[i]] = cells[i];
  const tail = header.length - boxAt;
  for (let i = 0; i < tail; i++) row[header[boxAt + i]] = cells[cells.length - tail + i];
  return row;
}

// Returns { cards, problems } — problems are rows that look like cards but could not be read.
function parseDeckDetailed(text) {
  const cards = [];
  const problems = [];
  let header = null;
  (text || '').split('\n').forEach((line, n) => {
    if (!line.trim().startsWith('|')) { header = null; return; }
    const cells = splitRow(line);
    if (!header) { header = cells.map((c) => c.toLowerCase()); return; }
    if (cells.every((c) => /^:?-+:?$/.test(c))) return; // separator row
    if (!header.includes('due')) return; // some other table
    const row = mapRow(header, cells);
    const id = row ? row.id : cells[0];
    if (!row || !row.id) { problems.push({ line: n + 1, id: id || '?', why: 'cell count does not match the header' }); return; }
    if (!BOX_RE.test(row.box || '')) { problems.push({ line: n + 1, id, why: `box "${row.box}" is not 1–6, retired or paused` }); return; }
    if (/^(retired|paused)$/i.test(row.box)) return;
    if (!DAY_RE.test(row.due || '')) { problems.push({ line: n + 1, id, why: `due "${row.due}" is not a YYYY-MM-DD date` }); return; }
    cards.push({ id: row.id, topic: row.topic || row.id, due: row.due, box: row.box });
  });
  return { cards, problems };
}

function parseDeck(text) {
  return parseDeckDetailed(text).cards;
}

function dueCards(cards, studyDay) {
  return cards
    .filter((c) => c.due <= studyDay)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}

// ---------- study day ----------

// The study day at `now`, given the stored state. Pure.
function studyDayAt(state, now, settings) {
  const today = dayKey(now);
  const sd = state && state.study_day;
  const last = state && state.last_activity ? new Date(state.last_activity) : null;

  // First run, corrupt state, or a study day in the future (clock or timezone moved back).
  if (typeof sd !== 'string' || !DAY_RE.test(sd) || sd > today) return today;
  if (sd === today) return sd;
  if (!last || Number.isNaN(last.getTime()) || last > now) return today;

  const gap = now - last;
  // Never hang on to a study day more than one calendar day old.
  if (sd < addDays(today, -1)) return today;
  // Crossing midnight now (the last activity was on an earlier calendar day).
  if (dayKey(last) < today) return gap >= settings.recall_cross_gap * HOUR ? today : sd;
  // Worked through midnight: wait for a long break, or the ceiling hour.
  if (gap >= settings.recall_idle_gap * HOUR) return today;
  if (now.getHours() >= settings.recall_day_ceiling) return today;
  return sd;
}

// ---------- the decision (pure) ----------

// event: { name: 'SessionStart'|'UserPromptSubmit'|'Stop', source?, sessionId }
// Returns { offer, reason, studyDay, due, nextState, changed }
function decide({ event, state, now, settings, cards }) {
  state = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  const studyDay = studyDayAt(state, now, settings);
  const sessions = state.sessions && typeof state.sessions === 'object' && !Array.isArray(state.sessions) ? state.sessions : {};
  const sid = event.sessionId || 'unknown';
  const seen = sessions[sid];

  const nextState = { ...state, study_day: studyDay, last_activity: now.toISOString() };
  const evaluates = event.name === 'SessionStart' || event.name === 'UserPromptSubmit';
  if (evaluates && seen !== studyDay) nextState.sessions = pruneSessions({ ...sessions, [sid]: studyDay });

  const changed = studyDay !== state.study_day || nextState.sessions !== state.sessions ||
    !state.last_activity || now - new Date(state.last_activity) >= ACTIVITY_WRITE_MS || !(now >= new Date(state.last_activity));
  const result = (offer, reason, due = []) => ({ offer, reason, studyDay, due, nextState, changed });

  if (!evaluates) return result(false, 'activity recorded');
  if (event.name === 'SessionStart' && event.source === 'compact') return result(false, 'compaction is not a new session');
  if (settings.recall === 'off') return result(false, 'recall is off in ~/.alvar/settings.md');
  if (state.skip_day && state.skip_day === studyDay) return result(false, `skipped for study day ${studyDay}`);

  const due = dueCards(cards, studyDay);
  if (due.length === 0) return result(false, `no cards due on study day ${studyDay}`);
  if (seen === studyDay) return result(false, 'this session already had its chance today', due);

  let reason;
  if (event.name === 'UserPromptSubmit') reason = seen ? 'first prompt of a new study day' : 'first prompt in this session';
  else if (event.source === 'resume') reason = 'resumed on a new study day';
  else reason = 'new session';
  return result(true, reason, due);
}

function pruneSessions(sessions) {
  const entries = Object.entries(sessions).filter(([, d]) => typeof d === 'string' && DAY_RE.test(d));
  entries.sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0));
  return Object.fromEntries(entries.slice(0, MAX_SESSIONS));
}

// The hook's own keys win; everything else (skip_day from the tutor) comes from the file as it is now.
function mergeState(latest, next) {
  const base = latest && typeof latest === 'object' && !Array.isArray(latest) ? latest : {};
  const out = { ...base };
  for (const k of ['study_day', 'last_activity', 'sessions']) if (next[k] !== undefined) out[k] = next[k];
  delete out.last_offer; // replaced by `sessions`
  return out;
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
    `Due: ${due.slice(0, 12).map((c) => `${c.id} ${c.topic} (box ${c.box}, due ${c.due})`).join('; ')}${n > 12 ? '; …' : ''}.`,
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
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
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
  const deck = parseDeckDetailed(deckText);
  return {
    root,
    statePath: path.join(alvar, STATE_FILE),
    state: readJson(path.join(alvar, STATE_FILE)),
    cards: deck.cards,
    problems: deck.problems,
    settings: readSettings(home),
  };
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function runHook() {
  let input = {};
  try { input = JSON.parse(readStdin() || '{}'); } catch { input = {}; }
  if (!input || typeof input !== 'object') return;
  const ctx = loadContext(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(), os.homedir());
  if (!ctx) return;
  const event = { name: input.hook_event_name, source: input.source, sessionId: input.session_id };
  if (!['SessionStart', 'UserPromptSubmit', 'Stop'].includes(event.name)) return;

  const decision = decide({ event, state: ctx.state, now: new Date(), settings: ctx.settings, cards: ctx.cards });
  if (decision.changed) {
    // Re-read just before writing so a skip_day the tutor wrote meanwhile is kept.
    try { writeJsonAtomic(ctx.statePath, mergeState(readJson(ctx.statePath), decision.nextState)); } catch { /* read-only: still answer */ }
  }
  if (decision.offer) process.stdout.write(JSON.stringify(buildOutput(event.name, decision, ctx.root, ctx.settings)));
}

function runStatus(cwd) {
  const ctx = loadContext(cwd, os.homedir());
  if (!ctx) { console.log(`No .alvar/ folder found at or above ${path.resolve(cwd)} (the home folder does not count).`); return; }
  const now = new Date();
  const studyDay = studyDayAt(ctx.state, now, ctx.settings);
  const due = dueCards(ctx.cards, studyDay);
  const s = ctx.settings;
  console.log(`Learner root:  ${ctx.root}`);
  console.log(`Settings:      recall ${s.recall}, max ${s.recall_max}, cross-midnight gap ${s.recall_cross_gap}h, overnight idle gap ${s.recall_idle_gap}h, day ceiling ${s.recall_day_ceiling}:00`);
  console.log(`Last activity: ${ctx.state.last_activity || 'none recorded'}`);
  console.log(`Study day:     ${studyDay}${studyDay !== ctx.state.study_day ? ` (stored: ${ctx.state.study_day || 'none'}; moves on at the next event)` : ''}`);
  console.log(`Skip day:      ${ctx.state.skip_day || 'none'}`);
  console.log(`Cards:         ${ctx.cards.length} active in deck, ${due.length} due`);
  for (const c of due) console.log(`  - ${c.id} ${c.topic} (box ${c.box}, due ${c.due})`);
  if (ctx.problems.length) {
    console.log(`Unreadable rows in .alvar/${DECK_FILE} (skipped until fixed):`);
    for (const p of ctx.problems) console.log(`  - line ${p.line} (${p.id}): ${p.why}`);
  }
  const asNew = decide({ event: { name: 'SessionStart', source: 'startup', sessionId: '--status' }, state: ctx.state, now, settings: s, cards: ctx.cards });
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

module.exports = {
  dayKey, addDays, parseSettings, parseDeck, parseDeckDetailed, dueCards,
  studyDayAt, decide, mergeState, buildOutput, findRoot,
};
