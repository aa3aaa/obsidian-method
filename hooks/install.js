#!/usr/bin/env node
// Adds (or removes) the active-recall hook in your Claude Code user settings.
//
//   node hooks/install.js             install into ~/.claude/settings.json
//   node hooks/install.js --dry-run   print the result without writing
//   node hooks/install.js --uninstall remove the recall hook entries
//
// Safe to run more than once: earlier recall handlers are replaced, every other
// setting and hook (including other hooks in the same group) is left as it is,
// and the old file is backed up first. The hook runs with the same Node binary
// that runs this installer, so it works even when `node` is not on Claude
// Code's PATH (nvm, the native installer).

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MARK = 'recall-check.js';
const script = path.resolve(__dirname, 'recall-check.js');
const settingsPath = process.env.CLAUDE_SETTINGS_PATH || path.join(os.homedir(), '.claude', 'settings.json');
const dryRun = process.argv.includes('--dry-run');
const uninstall = process.argv.includes('--uninstall');

const handler = { type: 'command', command: `${JSON.stringify(process.execPath)} ${JSON.stringify(script)}`, timeout: 10 };
const wanted = {
  SessionStart: { matcher: 'startup|resume|clear|fork', hooks: [handler] },
  UserPromptSubmit: { hooks: [handler] },
  Stop: { hooks: [handler] },
};

const isOurHandler = (h) => h && typeof h.command === 'string' && h.command.includes(MARK);

function fail(msg) {
  console.error(`${msg}\nNothing was changed. Fix the file, or add the hooks by hand (see README).`);
  process.exit(1);
}

let settings = {};
if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    fail(`Could not parse ${settingsPath} (${err.message}).`);
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) fail(`${settingsPath} is not a JSON object.`);
}

if (settings.hooks !== undefined && (typeof settings.hooks !== 'object' || Array.isArray(settings.hooks) || settings.hooks === null)) {
  fail(`"hooks" in ${settingsPath} is not an object.`);
}
settings.hooks = settings.hooks || {};

for (const [event, group] of Object.entries(wanted)) {
  const groups = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
  // Remove only our handlers; keep each group's other hooks, drop groups left empty.
  const kept = groups
    .map((g) => (g && Array.isArray(g.hooks) && g.hooks.some(isOurHandler) ? { ...g, hooks: g.hooks.filter((h) => !isOurHandler(h)) } : g))
    .filter((g) => !(g && Array.isArray(g.hooks) && g.hooks.length === 0));
  if (!uninstall) kept.push(group);
  if (kept.length) settings.hooks[event] = kept;
  else delete settings.hooks[event];
}
if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

const text = JSON.stringify(settings, null, 2) + '\n';
if (dryRun) {
  process.stdout.write(text);
  process.exit(0);
}

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
if (fs.existsSync(settingsPath)) {
  const backup = `${settingsPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(settingsPath, backup);
  console.log(`Backed up the old settings to ${backup}`);
}
const tmp = `${settingsPath}.${process.pid}.tmp`;
fs.writeFileSync(tmp, text);
fs.renameSync(tmp, settingsPath);
console.log(uninstall
  ? `Removed the recall hook from ${settingsPath}.`
  : `Installed the recall hook in ${settingsPath} (SessionStart, UserPromptSubmit, Stop).\nIt runs ${script} with ${process.execPath}.\nStart a new Claude Code session for it to take effect.`);
