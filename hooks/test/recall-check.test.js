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
const INSTALL = path.join(__dirname, '..', 'install.js');
const settings = R.parseSettings('');
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m); // November 2026, local time
const iso = (d, h, m = 0) => at(d, h, m).toISOString();
const card = (id, due, topic = id, box = '1') => ({ id, topic, due, box });
const start = (sessionId = 's1') => ({ name: 'SessionStart', source: 'startup', sessionId });
const resume = (sessionId = 's1') => ({ name: 'SessionStart', source: 'resume', sessionId });
const prompt = (sessionId = 's1') => ({ name: 'UserPromptSubmit', sessionId });
const stop = (sessionId = 's1') => ({ name: 'Stop', sessionId });

// Feed a sequence of events through decide(), carrying state forward the way the hook does.
function run(steps, cards, state = {}, s = settings) {
  const out = [];
  for (const [event, now] of steps) {
    const d = R.decide({ event, state, now, settings: s, cards });
    out.push(d);
    state = R.mergeState(state, d.nextState);
  }
  return out;
}

// ---------- dates and settings ----------

test('dayKey and addDays use the local calendar', () => {
  assert.equal(R.dayKey(at(4, 0, 5)), '2026-11-04');
  assert.equal(R.dayKey(at(4, 23, 59)), '2026-11-04');
  assert.equal(R.addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(R.addDays('2026-03-01', -1), '2026-02-28');
});

test('parseSettings reads recall keys, ignores junk and keeps defaults', () => {
  const s = R.parseSettings('# Alvar settings\nverifier: lite\nrecall_max: abc\nrecall: maybe\nrecall_cross_gap: 1\nrecall_idle_gap: 6  # longer sleep\nrecall_day_ceiling: 30');
  assert.equal(s.recall, 'on');
  assert.equal(s.recall_max, 5);
  assert.equal(s.recall_cross_gap, 1);
  assert.equal(s.recall_idle_gap, 6);
  assert.equal(s.recall_day_ceiling, 12); // 30 is not an hour
  assert.equal(R.parseSettings('recall: off').recall, 'off');
});

// ---------- new sessions ----------

test('first ever session with due cards offers recall', () => {
  const [d] = run([[start(), at(5, 9)]], [card('R1', '2026-11-05')]);
  assert.equal(d.offer, true);
  assert.equal(d.reason, 'new session');
  assert.equal(d.studyDay, '2026-11-05');
});

test('no due cards: silent', () => {
  const [d] = run([[start(), at(5, 9)]], [card('R1', '2026-11-06')]);
  assert.equal(d.offer, false);
});

test('every new session the same day offers while cards are still due', () => {
  const ds = run([[start('s1'), at(5, 9)], [start('s2'), at(5, 14)], [start('s3'), at(5, 20)]], [card('R1', '2026-11-05')]);
  assert.deepEqual(ds.map((d) => d.offer), [true, true, true]);
});

test('one offer per session per study day', () => {
  const ds = run([
    [start(), at(5, 9)],
    [prompt(), at(5, 9, 1)],
    [prompt(), at(5, 15)], // 6h idle, same calendar day
    [resume(), at(5, 18)],
  ], [card('R1', '2026-11-05')]);
  assert.deepEqual(ds.map((d) => d.offer), [true, false, false, false]);
});

test('a session the hook never saw start offers on its first prompt', () => {
  const [d] = run([[prompt('late'), at(5, 10)]], [card('R1', '2026-11-05')]);
  assert.equal(d.offer, true);
  assert.equal(d.reason, 'first prompt in this session');
});

// ---------- new study days ----------

test('crossing midnight after a break of 2h or more starts a new study day', () => {
  const ds = run([[prompt(), at(4, 22)], [prompt(), at(5, 8)]], [card('R1', '2026-11-05')],
    { study_day: '2026-11-04', last_activity: iso(4, 21), sessions: { s1: '2026-11-04' } });
  assert.equal(ds[0].offer, false);
  assert.equal(ds[1].offer, true);
  assert.equal(ds[1].studyDay, '2026-11-05');
  assert.equal(ds[1].reason, 'first prompt of a new study day');
});

test('exactly 2h across midnight counts as a break', () => {
  const [d] = run([[prompt(), at(5, 1)]], [card('R1', '2026-11-05')],
    { study_day: '2026-11-04', last_activity: iso(4, 23), sessions: { s1: '2026-11-04' } });
  assert.equal(d.offer, true);
});

test('overnight session: working through midnight waits for a 4h idle gap', () => {
  const ds = run([
    [prompt(), at(4, 23, 30)],
    [prompt(), at(5, 0, 30)], // crossed midnight after 1h: same study day
    [prompt(), at(5, 1, 0)], // still going
    [prompt(), at(5, 3, 30)], // 2.5h break after midnight: not enough
    [prompt(), at(5, 7, 45)], // 4.25h break: new study day
  ], [card('R1', '2026-11-05'), card('R0', '2026-11-04')],
  { study_day: '2026-11-04', last_activity: iso(4, 23), sessions: { s1: '2026-11-04' } });
  assert.deepEqual(ds.map((d) => d.studyDay), ['2026-11-04', '2026-11-04', '2026-11-04', '2026-11-04', '2026-11-05']);
  assert.deepEqual(ds.map((d) => d.offer), [false, false, false, false, true]);
  assert.equal(ds[4].due.length, 2);
});

test('a turn that finishes (Stop) on the new day does not use up the offer', () => {
  // Review finding: a permission prompt left overnight, approved at 08:00.
  const ds = run([
    [prompt(), at(4, 23)],
    [stop(), at(5, 8)],
    [prompt(), at(5, 8, 5)],
  ], [card('R1', '2026-11-05')], { study_day: '2026-11-04', last_activity: iso(4, 22, 50), sessions: { s1: '2026-11-04' } });
  assert.equal(ds[1].studyDay, '2026-11-05');
  assert.equal(ds[2].offer, true);
});

test('another session starting the new day does not use up this session\'s offer', () => {
  const ds = run([
    [start('other'), at(5, 8)],
    [prompt('s1'), at(5, 8, 30)],
  ], [card('R1', '2026-11-05')], { study_day: '2026-11-04', last_activity: iso(4, 23), sessions: { s1: '2026-11-04' } });
  assert.deepEqual(ds.map((d) => d.offer), [true, true]);
});

test('while still in yesterday\'s study day, cards due "today" are not yet due; they come up later', () => {
  const ds = run([
    [start('s9'), at(5, 0, 40)],
    [prompt('s9'), at(5, 7, 0)], // 6h20m idle: new study day
  ], [card('R1', '2026-11-05')], { study_day: '2026-11-04', last_activity: iso(5, 0, 20) });
  assert.equal(ds[0].studyDay, '2026-11-04');
  assert.equal(ds[0].offer, false);
  assert.equal(ds[1].offer, true);
});

test('a new session just after midnight still offers yesterday\'s unfinished cards', () => {
  const [d] = run([[start('s9'), at(5, 0, 40)]], [card('R0', '2026-11-04')],
    { study_day: '2026-11-04', last_activity: iso(5, 0, 20) });
  assert.equal(d.offer, true);
  assert.equal(d.studyDay, '2026-11-04');
});

test('the day ceiling (noon) moves a never-idle overnight study day on', () => {
  // Review finding: activity in any session kept the folder in yesterday's study day.
  const steps = [];
  for (let h = 0; h <= 13; h++) steps.push([prompt(), at(5, h, 30)]);
  const ds = run(steps, [card('R1', '2026-11-05')], { study_day: '2026-11-04', last_activity: iso(4, 23, 50), sessions: { s1: '2026-11-04' } });
  const firstNew = ds.findIndex((d) => d.studyDay === '2026-11-05');
  assert.equal(firstNew, 12); // the 12:30 prompt
  assert.equal(ds[12].offer, true);
});

test('a study day more than a day old always moves on', () => {
  assert.equal(R.studyDayAt({ study_day: '2026-11-02', last_activity: iso(5, 9) }, at(5, 9, 30), settings), '2026-11-05');
});

test('compaction never offers; resume offers only on a new study day', () => {
  const cards = [card('R1', '2026-11-05')];
  const state = { study_day: '2026-11-04', last_activity: iso(4, 20), sessions: { s1: '2026-11-04' } };
  const [c] = run([[{ name: 'SessionStart', source: 'compact', sessionId: 's1' }, at(5, 9)]], cards, state);
  assert.equal(c.offer, false);
  const [r] = run([[resume(), at(5, 9)]], cards, state);
  assert.equal(r.offer, true);
  assert.equal(r.reason, 'resumed on a new study day');
});

test('custom gaps from settings are honoured', () => {
  const s = R.parseSettings('recall_cross_gap: 1');
  const [d] = run([[prompt(), at(5, 0, 30)]], [card('R1', '2026-11-05')],
    { study_day: '2026-11-04', last_activity: iso(4, 23, 15), sessions: { s1: '2026-11-04' } }, s);
  assert.equal(d.offer, true); // 1.25h >= 1h
});

// ---------- robustness of state ----------

test('a future or corrupt study day resets to today', () => {
  // Review finding: string comparison let "garbage" or a future date stick.
  assert.equal(R.studyDayAt({ study_day: '2026-11-09', last_activity: iso(5, 8) }, at(5, 9), settings), '2026-11-05');
  assert.equal(R.studyDayAt({ study_day: 'garbage', last_activity: iso(5, 8) }, at(5, 9), settings), '2026-11-05');
  assert.equal(R.studyDayAt({ study_day: 7, last_activity: 'nope' }, at(5, 9), settings), '2026-11-05');
  assert.equal(R.studyDayAt({ study_day: '2026-11-04', last_activity: iso(6, 9) }, at(5, 9), settings), '2026-11-05'); // activity in the future
  const [d] = run([[start(), at(5, 9)]], [card('R8', '2026-11-08')], { study_day: '2026-11-09', last_activity: iso(5, 8) });
  assert.equal(d.offer, false); // a card due 11-08 is not due on 11-05
});

test('non-object state and sessions are tolerated', () => {
  for (const state of [null, [], 'x', { sessions: [] }, { sessions: 'x' }]) {
    const d = R.decide({ event: start(), state, now: at(5, 9), settings, cards: [card('R1', '2026-11-05')] });
    assert.equal(d.offer, true);
  }
});

test('skip today silences until the next study day', () => {
  const cards = [card('R1', '2026-11-05')];
  const state = { study_day: '2026-11-05', last_activity: iso(5, 9), skip_day: '2026-11-05' };
  const [same] = run([[start('s2'), at(5, 13)]], cards, state);
  assert.equal(same.offer, false);
  const [next] = run([[start('s3'), at(6, 9)]], cards, state);
  assert.equal(next.offer, true);
});

test('recall: off disables offers but still records activity', () => {
  const [d] = run([[start(), at(5, 9)]], [card('R1', '2026-11-01')], {}, R.parseSettings('recall: off'));
  assert.equal(d.offer, false);
  assert.ok(d.nextState.last_activity);
});

test('Stop only records activity, and coalesces writes within 5 minutes', () => {
  const state = { study_day: '2026-11-05', last_activity: iso(5, 9) };
  const soon = R.decide({ event: stop(), state, now: at(5, 9, 3), settings, cards: [] });
  assert.equal(soon.offer, false);
  assert.equal(soon.changed, false);
  const later = R.decide({ event: stop(), state, now: at(5, 9, 6), settings, cards: [] });
  assert.equal(later.changed, true);
  assert.equal(later.nextState.last_activity, iso(5, 9, 6));
});

test('mergeState keeps the tutor\'s skip_day and drops the old last_offer key', () => {
  const merged = R.mergeState({ skip_day: '2026-11-05', last_offer: { session: 'x' }, study_day: '2026-11-04' },
    { study_day: '2026-11-05', last_activity: 'L', sessions: { s1: '2026-11-05' }, skip_day: undefined });
  assert.deepEqual(merged, { skip_day: '2026-11-05', study_day: '2026-11-05', last_activity: 'L', sessions: { s1: '2026-11-05' } });
});

test('the sessions map stays small', () => {
  let state = {};
  for (let i = 0; i < 50; i++) {
    const d = R.decide({ event: start(`s${i}`), state, now: at(5, 9, i), settings, cards: [] });
    state = R.mergeState(state, d.nextState);
  }
  assert.equal(Object.keys(state.sessions).length, 30);
});

// ---------- deck ----------

const HEAD = '| id | topic | idea | kind | source | box | last | due | history |\n|---|---|---|---|---|---|---|---|---|\n';

test('parseDeck reads the table by header name, handles escaped pipes, skips retired rows', () => {
  const text = '# Recall deck\n\n' + HEAD + [
    '| R1 | Observer | Subject calls `update()` on each observer \\| push vs pull | concept | s.md | 2 | 2026-11-02 | 2026-11-05 | 11-02 + |',
    '| R2 | Strategy | Swap algorithms behind one interface | method | s.md | retired | 2026-10-01 | 2026-12-01 | |',
    '| R4 | Liskov | Subtypes must honour the contract | concept | s.md | 1 | 2026-11-04 | 2026-11-05 | |',
  ].join('\n') + '\n\nSome prose | with a pipe that is not a table row\n';
  const cards = R.parseDeck(text);
  assert.deepEqual(cards.map((c) => c.id), ['R1', 'R4']);
  assert.equal(cards[0].topic, 'Observer');
  assert.equal(cards[0].box, '2');
});

test('unescaped pipes inside code keep box, last and due correct', () => {
  // Review finding: `a || b` dropped the row; a single `|` shifted `due` to the `last` date.
  const text = HEAD + [
    '| R5 | Short-circuit | `a || b` skips b when a is true | concept | s.md | 3 | 2026-11-01 | 2026-11-08 | |',
    '| R6 | Pipes | `ls | wc -l` counts entries | compute | s.md | 2 | 2026-11-02 | 2026-11-05 | |',
  ].join('\n');
  const { cards, problems } = R.parseDeckDetailed(text);
  assert.deepEqual(problems, []);
  assert.deepEqual(cards.map((c) => [c.id, c.topic, c.box, c.due]), [
    ['R5', 'Short-circuit', '3', '2026-11-08'],
    ['R6', 'Pipes', '2', '2026-11-05'],
  ]);
});

test('rows that cannot be read are reported, not guessed', () => {
  const text = HEAD + [
    '| R3 | Bad date | x | concept | s.md | 1 | | soon | |',
    '| R7 | Bad box | x | concept | s.md | s.md | 2026-11-01 | 2026-11-05 | |',
    '| R8 | Too short | x |',
  ].join('\n');
  const { cards, problems } = R.parseDeckDetailed(text);
  assert.equal(cards.length, 0);
  assert.deepEqual(problems.map((p) => p.id), ['R3', 'R7', 'R8']);
});

test('dueCards orders the most overdue first', () => {
  const due = R.dueCards([card('a', '2026-11-05'), card('b', '2026-11-01'), card('c', '2026-11-09')], '2026-11-05');
  assert.deepEqual(due.map((c) => c.id), ['b', 'a']);
});

test('buildOutput gives a short banner and factual context', () => {
  const d = R.decide({ event: start(), state: {}, now: at(5, 9), settings, cards: [card('R1', '2026-11-03', 'Observer'), card('R2', '2026-11-05', 'Liskov')] });
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
  fs.writeFileSync(path.join(root, '.alvar', 'recall.md'), HEAD + `| R1 | Observer | x | concept | s.md | 1 | ${today} | ${today} | |\n`);

  const out = JSON.parse(hook(home, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'e2e', cwd: path.join(root, 'week05') }));
  assert.match(out.systemMessage, /1 card due in COMP2511/);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');

  const state = JSON.parse(fs.readFileSync(path.join(root, '.alvar', 'recall-state.json'), 'utf8'));
  assert.equal(state.study_day, today);
  assert.equal(state.sessions.e2e, today);

  assert.equal(hook(home, { hook_event_name: 'UserPromptSubmit', session_id: 'e2e', cwd: root, prompt: 'hi' }), '');
  assert.equal(hook(home, { hook_event_name: 'Stop', session_id: 'e2e', cwd: root }), '');
});

test('end to end: a skip_day the tutor wrote survives the hook\'s write', () => {
  const { home, root } = tmpLearner();
  const today = R.dayKey(new Date());
  const statePath = path.join(root, '.alvar', 'recall-state.json');
  fs.writeFileSync(statePath, JSON.stringify({ study_day: today, skip_day: today })); // no last_activity: forces a write
  hook(home, { hook_event_name: 'UserPromptSubmit', session_id: 'x', cwd: root });
  const after = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(after.skip_day, today);
  assert.ok(after.last_activity);
});

test('end to end: silent outside a learner root, on garbage input and on bad state files', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'alvar-home-'));
  assert.equal(hook(home, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'z', cwd: home }), '');
  for (const input of ['not json', '', 'null', '[1]']) {
    assert.equal(execFileSync(process.execPath, [SCRIPT], { input, env: { ...process.env, HOME: home }, encoding: 'utf8' }), '');
  }
  const { root } = tmpLearner();
  for (const bad of ['null', '[]', '"x"', '{oops']) {
    fs.writeFileSync(path.join(root, '.alvar', 'recall-state.json'), bad);
    assert.equal(hook(home, { hook_event_name: 'UserPromptSubmit', session_id: 'b', cwd: root }), '');
  }
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

test('end to end: --status explains the decision and lists unreadable rows', () => {
  const { home, root } = tmpLearner();
  fs.writeFileSync(path.join(root, '.alvar', 'recall.md'), HEAD + '| R3 | Bad date | x | concept | s.md | 1 | | soon | |\n');
  const out = execFileSync(process.execPath, [SCRIPT, '--status', root], { env: { ...process.env, HOME: home }, encoding: 'utf8' });
  assert.match(out, /Learner root: +.*COMP2511/);
  assert.match(out, /0 active in deck, 0 due/);
  assert.match(out, /line 3 \(R3\): due "soon"/);
  assert.match(out, /would not offer recall/);
});

// ---------- installer ----------

function install(settingsPath, ...args) {
  return execFileSync(process.execPath, [INSTALL, ...args], { env: { ...process.env, CLAUDE_SETTINGS_PATH: settingsPath }, encoding: 'utf8' });
}

test('installer: idempotent, uses this node, and never removes the learner\'s own hooks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alvar-settings-'));
  const p = path.join(dir, 'settings.json');
  // Review finding: a group holding both a user hook and ours lost the user hook.
  fs.writeFileSync(p, JSON.stringify({
    model: 'sonnet',
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }, { type: 'command', command: 'node /old/recall-check.js' }] }] },
  }));
  install(p);
  install(p);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(s.model, 'sonnet');
  const all = (ev) => s.hooks[ev].flatMap((g) => g.hooks.map((h) => h.command));
  assert.deepEqual(all('Stop').filter((c) => c.includes('recall-check.js')).length, 1);
  assert.ok(all('Stop').includes('say done'));
  assert.ok(all('SessionStart')[0].startsWith(JSON.stringify(process.execPath)));
  assert.equal(s.hooks.SessionStart[0].matcher, 'startup|resume|clear|fork');

  install(p, '--uninstall');
  const u = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.deepEqual(u.hooks, { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] });
});

test('installer: refuses unreadable or non-object settings without writing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alvar-settings-'));
  const p = path.join(dir, 'settings.json');
  for (const bad of ['{bad', 'null', '[]']) {
    fs.writeFileSync(p, bad);
    assert.throws(() => install(p, '--quiet'));
    assert.equal(fs.readFileSync(p, 'utf8'), bad);
  }
});
