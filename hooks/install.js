#!/usr/bin/env node
// Adds (or removes) the active-recall hook in your Claude Code user settings.
//
//   node hooks/install.js             install into ~/.claude/settings.json
//   node hooks/install.js --dry-run   print the result without writing
//   node hooks/install.js --uninstall remove the recall hook entries
//
// Safe to run more than once: existing recall entries are replaced, every other
// setting and hook is left as it is, and the old file is backed up first.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MARK = 'recall-check.js';
const script = path.resolve(__dirname, 'recall-check.js');
const settingsPath = process.env.CLAUDE_SETTINGS_PATH || path.join(os.homedir(), '.claude', 'settings.json');
const dryRun = process.argv.includes('--dry-run');
const uninstall = process.argv.includes('--uninstall');

const handler = { type: 'command', command: `node ${JSON.stringify(script)}`, timeout: 10 };
const wanted = {
  SessionStart: { matcher: 'startup|resume|clear|fork', hooks: [handler] },
  UserPromptSubmit: { hooks: [handler] },
  Stop: { hooks: [handler] },
};

function isOurs(group) {
  return Array.isArray(group && group.hooks) && group.hooks.some((h) => typeof h.command === 'string' && h.command.includes(MARK));
}

let settings = {};
if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    console.error(`Could not parse ${settingsPath} (${err.message}). Fix it or add the hooks by hand; nothing was changed.`);
    process.exit(1);
  }
}

settings.hooks = settings.hooks || {};
for (const [event, group] of Object.entries(wanted)) {
  const kept = (settings.hooks[event] || []).filter((g) => !isOurs(g));
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
fs.writeFileSync(settingsPath, text);
console.log(uninstall
  ? `Removed the recall hook from ${settingsPath}.`
  : `Installed the recall hook in ${settingsPath} (SessionStart, UserPromptSubmit, Stop).\nIt runs ${script}. Start a new Claude Code session for it to take effect.`);
