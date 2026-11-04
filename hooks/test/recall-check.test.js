// Run: node --test hooks/test/*.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const R = require('../recall-check.js');

const SCRIPT = path.join(__dirname, '..', 'recall-check.js');
const settings = R.parseSettings('');
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m); // November 2026, local time
const card = (id, due, topic = id, box = '1') => ({ id, topic, due, box });
const start = { name: 'SessionStart', source: 'startup', sessionId: 's1' };
const prompt = (sessionId = 's1') => ({ name: 'UserPromptSubmit', sessionId });

// Feed a sequence of events through decide(), carrying state forward.
function run(steps, cards, state = {}, s = settings) {
  const out = [];
  for (const [event, now] of steps) {
    const d = R.decide({ event, state, now, settings: s, cards });
    out.push(d);
    state = d.nextState;
  }
  return out;
}

test('dayKey uses the local calendar date', () => {
  assert.equal(R.dayKey(at(4, 0, 5)), '2026-11-04');
  assert.equal(R.dayKey(at(4, 23, 59)), '2026-11-04');
});

test('first ever session with due cards offers recall', () => {
  const [d] = run([[start, at(5, 9)]], [card('R1', '2026-11-05')]);
  assert.equal(d.offer, true);
  assert.equal(d.reason, 'new session');
  assert.equal(d.studyDay, '2026-11-05');
});

test('no due cards: silent', () => {
  const [d] = run([[start, at(5, 9)]], [card('R1', '2026-11-06')]);
  assert.equal(d.offer, false);
});

test('a new session later the same day offers again while cards are still due', () => {
  const cards = [card('R1', '2026-11-05')];
  const ds = run([
    [start, at(5, 9)],
    [{ ...start, sessionId: 's2' }, at(5, 14)],
  ], cards);
  assert.deepEqual(ds.map((d) => d.offer), [true, true]);
});

test('one offer per session per study day', () => {
  const cards = [card('R1', '2026-11-05')];
  const ds = run([
    [start, at(5, 9)],
    [prompt(), at(5, 9, 1)],
    [{ name: 'SessionStart', source: 'resume', sessionId: 's1' }, at(5, 9, 30)],
  ], cards);
  assert.deepEqual(ds.map((d) => d.offer), [true, false, false]);
});

test('prompts in an open session on the same day never offer', () => {
  const cards = [card('R1', '2026-11-05')];
  const ds = run([
    [start, at(5, 9)],
    [prompt(), at(5, 15)], // 6h idle, same calendar day
  ], cards);
  assert.equal(ds[1].offer, false);
});

test('crossing midnight after a break of 2h or more starts a new study day', () => {
  const cards = [card('R1', '2026-11-05')];
  const ds = run([
    [prompt(), at(4, 22)],
    [prompt(), at(5, 8)],
  ], cards, { study_day: '2026-11-04', last_activity: at(4, 21).toISOString() });
  assert.equal(ds[1].offer, true);
  assert.equal(ds[1].studyDay, '2026-11-05');
  assert.equal(ds[1].reason, 'back after a break on a new day');
});

test('exactly 2h across midnight counts as a break', () => {
  const ds = run([[prompt(), at(5, 1)]], [card('R1', '2026-11-05')],
    { study_day: '2026-11-04', last_activity: at(4, 23).toISOString() });
  assert.equal(ds[0].offer, true);
});

test('overnight session: working through midnight waits for a 4h idle gap', () => {
  const cards = [card('R1', '2026-11-05'), card('R0', '2026-11-04')];
  const ds = run([
    [prompt(), at(4, 23, 30)],
    [prompt(), at(5, 0, 30)], // crossed midnight after 1h: same study day
    [prompt(), at(5, 1, 0)], // still going
    [prompt(), at(5, 3, 30)], // 2.5h break after midnight: not enough
    [prompt(), at(5, 7, 45)], // 4.25h break: new study day
  ], cards, { study_day: '2026-11-04', last_activity: at(4, 23).toISOString(), last_offer: { session: 's1', day: '2026-11-04' } });
  assert.deepEqual(ds.map((d) => d.studyDay), ['2026-11-04', '2026-11-04', '2026-11-04', '2026-11-04', '2026-11-05']);
  assert.deepEqual(ds.map((d) => d.offer), [false, false, false, false, true]);
  assert.equal(ds[4].due.length, 2);
});

test('while still in yesterday\'s study day, cards due "today" are not yet due', () => {
  const ds = run([[{ ...start, sessionId: 's9' }, at(5, 0, 40)]], [card('R1', '2026-11-05')],
    { study_day: '2026-11-04', last_activity: at(5, 0, 20).toISOString() });
  assert.equal(ds[0].studyDay, '2026-11-04');
  assert.equal(ds[0].offer, false);
});

test('a new session just after midnight still offers yesterday\'s unfinished cards', () => {
  const ds = run([[{ ...start, sessionId: 's9' }, at(5, 0, 40)]], [card('R0', '2026-11-04')],
    { study_day: '2026-11-04', last_activity: at(5, 0, 20).toISOString() });
  assert.equal(ds[0].offer, true);
  assert.equal(ds[0].studyDay, '2026-11-04');
});

test('the 4h overnight wait can be crossed by a new session too', () => {
  const ds = run([[{ ...start, sessionId: 's3' }, at(5, 9)]], [card('R1', '2026-11-05')],
    { study_day: '2026-11-04', last_activity: at(5, 2).toISOString() });
  assert.equal(ds[0].studyDay, '2026-11-05');
  assert.equal(ds[0].offer, true);
});

test('skip today silences until the next study day', () => {
  const cards = [card('R1', '2026-11-05')];
  const state = { study_day: '2026-11-05', last_activity: at(5, 9).toISOString(), skip_day: '2026-11-05' };
  const [same] = run([[{ ...start, sessionId: 's2' }, at(5, 13)]], cards, state);
  assert.equal(same.offer, false);
  const [next] = run([[{ ...start, sessionId: 's3' }, at(6, 9)]], cards, state);
  assert.equal(next.offer, true);
});

test('recall: off disables offers but still records activity', () => {
  const s = R.parseSettings('recall: off');
  const [d] = run([[start, at(5, 9)]], [card('R1', '2026-11-01')], {}, s);
  assert.equal(d.offer, false);
  assert.ok(d.nextState.last_activity);
});

test('Stop only records activity', () => {
  const [d] = run([[{ name: 'Stop', sessionId: 's1' }, at(5, 9)]], [card('R1', '2026-11-01')]);
  assert.equal(d.offer, false);
  assert.equal(d.nextState.last_activity, at(5, 9).toISOString());
});

test('compaction never offers; resume offers only after a new-day break', () => {
  const cards = [card('R1', '2026-11-05')];
  const state = { study_day: '2026-11-04', last_activity: at(4, 20).toISOString() };
  const [c] = run([[{ name: 'SessionStart', source: 'compact', sessionId: 's1' }, at(5, 9)]], cards, state);
  assert.equal(c.offer, false);
  const [r] = run([[{ name: 'SessionStart', source: 'resume', sessionId: 's1' }, at(5, 9)]], cards, state);
  assert.equal(r.offer, true);
  assert.equal(r.reason, 'resumed after a break on a new day');
});

test('custom gaps from settings are honoured', () => {
  const s = R.parseSettings('recall_cross_gap: 1\nrecall_idle_gap: 6  # longer sleep');
  assert.equal(s.recall_cross_gap, 1);
  assert.equal(s.recall_idle_gap, 6);
  const [d] = run([[prompt(), at(5, 0, 30)]], [card('R1', '2026-11-05')],
    { study_day: '2026-11-04', last_activity: at(4, 23, 15).toISOString() }, s);
  assert.equal(d.offer, true); // 1.25h >= 1h
});

test('parseSettings ignores junk and keeps defaults', () => {
  const s = R.parseSettings('# Alvar settings\nverifier: lite\nrecall_max: abc\nrecall: maybe');
  assert.equal(s.recall, 'on');
  assert.equal(s.recall_max, 5);
});

test('parseDeck reads the table by header name, handles escaped pipes, skips retired and bad rows', () => {
  const text = [
    '# Recall deck',
    '',
    '| id | topic | idea | kind | source | box | last | due | history |',
    '|---|---|---|---|---|---|---|---|---|',
    '| R1 | Observer | Subject calls `update()` on each observer \\| push vs pull | concept | s.md | 2 | 2026-11-02 | 2026-11-05 | 11-02 + |',
    '| R2 | Strategy | Swap algorithms behind one interface | method | s.md | retired | 2026-10-01 | 2026-12-01 | |',
    '| R3 | Bad date | x | concept | s.md | 1 | | soon | |',
    '| R4 | Liskov | Subtypes must honour the contract | concept | s.md | 1 | 2026-11-04 | 2026-11-05 | |',
    '',
    'Some prose | with a pipe that is not a table row',
  ].join('\n');
  const cards = R.parseDeck(text);
  assert.deepEqual(cards.map((c) => c.id), ['R1', 'R4']);
  assert.equal(cards[0].topic, 'Observer');
  assert.equal(cards[0].box, '2');
});

test('dueCards orders the most overdue first', () => {
  const due = R.dueCards([card('a', '2026-11-05'), card('b', '2026-11-01'), card('c', '2026-11-09')], '2026-11-05');
  assert.deepEqual(due.map((c) => c.id), ['b', 'a']);
});

test('buildOutput gives a short banner and factual context', () => {
  const d = R.decide({ event: start, state: {}, now: at(5, 9), settings, cards: [card('R1', '2026-11-03', 'Observer'), card('R2', '2026-11-05', 'Liskov')] });
  const out = R.buildOutput('SessionStart', d, '/x/COMP2511', settings);
  assert.match(out.systemMessage, /^Active recall: 2 cards due in COMP2511 \(1 overdue\) — Observer, Liskov\./);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /Study day: 2026-11-05/);
  assert.match(out.hookSpecificOutput.additionalContext, /R1 Observer \(box 1, due 2026-11-03\)/);
});

// ---------- end to end through the real script ----------

function tmpLearner() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'alvar-home-'));
  const root = path.join(home, 'vault', 'COMP2511');
  fs.mkdirSync(path.join(root, '.alvar'), { recursive: true });
  fs.mkdirSync(path.join(root, 'week05'), { recursive: true });
  return { home, root };
}

function hook(home, input) {
  return execFileSync(process.execPath, [SCRIPT], { input: JSON.stringify(input), env: { ...process.env, HOME: home }, encoding: 'utf8' });
}

test('end to end: offers from a subfolder, writes state, then stays quiet in the same session', () => {
  const { home, root } = tmpLearner();
  const today = R.dayKey(new Date());
  fs.writeFileSync(path.join(root, '.alvar', 'recall.md'),
    `| id | topic | idea | kind | source | box | last | due | history |\n|---|---|---|---|---|---|---|---|---|\n| R1 | Observer | x | concept | s.md | 1 | ${today} | ${today} | |\n`);

  const first = hook(home, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'e2e', cwd: path.join(root, 'week05') });
  const out = JSON.parse(first);
  assert.match(out.systemMessage, /1 card due in COMP2511/);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');

  const state = JSON.parse(fs.readFileSync(path.join(root, '.alvar', 'recall-state.json'), 'utf8'));
  assert.equal(state.study_day, today);
  assert.equal(state.last_offer.session, 'e2e');

  assert.equal(hook(home, { hook_event_name: 'UserPromptSubmit', session_id: 'e2e', cwd: root, prompt: 'hi' }), '');
  assert.equal(hook(home, { hook_event_name: 'Stop', session_id: 'e2e', cwd: root }), '');
});

test('end to end: a skip_day written by the tutor survives the hook\'s own write', () => {
  const { home, root } = tmpLearner();
  const today = R.dayKey(new Date());
  const statePath = path.join(root, '.alvar', 'recall-state.json');
  fs.writeFileSync(statePath, JSON.stringify({ study_day: today, last_activity: new Date().toISOString(), skip_day: today }));
  hook(home, { hook_event_name: 'Stop', session_id: 'x', cwd: root });
  assert.equal(JSON.parse(fs.readFileSync(statePath, 'utf8')).skip_day, today);
});

test('end to end: silent outside a learner root and on garbage input', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'alvar-home-'));
  assert.equal(hook(home, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'z', cwd: home }), '');
  const out = execFileSync(process.execPath, [SCRIPT], { input: 'not json', env: { ...process.env, HOME: home }, encoding: 'utf8' });
  assert.equal(out, '');
});

test('end to end: the home folder\'s ~/.alvar (settings, roots) is not a learner root', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'alvar-home-'));
  fs.mkdirSync(path.join(home, '.alvar'));
  fs.writeFileSync(path.join(home, '.alvar', 'settings.md'), 'verifier: lite\n');
  fs.mkdirSync(path.join(home, 'Downloads'));
  for (const cwd of [home, path.join(home, 'Downloads')]) {
    assert.equal(hook(home, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'h', cwd }), '');
  }
  assert.equal(fs.existsSync(path.join(home, '.alvar', 'recall-state.json')), false);
  assert.equal(R.findRoot(path.join(home, 'Downloads'), home), null);
});

test('end to end: --status explains the decision', () => {
  const { home, root } = tmpLearner();
  const out = execFileSync(process.execPath, [SCRIPT, '--status', root], { env: { ...process.env, HOME: home }, encoding: 'utf8' });
  assert.match(out, /Learner root: +.*COMP2511/);
  assert.match(out, /0 in deck, 0 due/);
  assert.match(out, /would not offer recall/);
});
