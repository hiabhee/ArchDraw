// Install the ArchDraw activity hooks into Claude Code's user settings, so
// every session in a linked repository (and its worktrees) shows up live.
// The hook script does nothing in repositories that are not linked.

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archdrawHome } from './binding.mjs';

export const HOOK_EVENTS = [
  ['SessionStart', null],
  ['PostToolUse', 'Edit|Write|MultiEdit|NotebookEdit|Read|Grep|Glob'],
  ['UserPromptSubmit', null],
  ['Notification', null],
  ['Stop', null],
  ['SessionEnd', null],
];
const HOOK_SCRIPT = 'archdraw-project.mjs';
const PLUGIN_ID = 'archdraw@archdraw';

export function claudeSettingsPath(env = process.env) {
  return join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'settings.json');
}

const isOurs = (hook) => typeof hook?.command === 'string' && hook.command.includes(HOOK_SCRIPT) && !hook.command.includes('CLAUDE_PLUGIN_ROOT');

/**
 * Settings with our hooks added (replacing older copies of them). Other hooks
 * and settings are left exactly as they were.
 */
export function withArchdrawHooks(settings, command) {
  const next = { ...settings, hooks: { ...(settings.hooks ?? {}) } };
  for (const [event, matcher] of HOOK_EVENTS) {
    const groups = Array.isArray(next.hooks[event]) ? next.hooks[event] : [];
    const kept = groups
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((hook) => !isOurs(hook)) }))
      .filter((group) => group.hooks.length > 0);
    kept.push({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command, timeout: 10 }] });
    next.hooks[event] = kept;
  }
  return next;
}

export function withoutArchdrawHooks(settings) {
  if (!settings.hooks) return settings;
  const hooks = {};
  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) {
      hooks[event] = groups;
      continue;
    }
    const kept = groups
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((hook) => !isOurs(hook)) }))
      .filter((group) => group.hooks.length > 0);
    if (kept.length > 0) hooks[event] = kept;
  }
  return { ...settings, hooks };
}

function readSettings(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  if (!text.trim()) return {};
  return JSON.parse(text); // throws: the caller reports it and leaves the file alone
}

function writeSettings(path, settings) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) copyFileSync(path, `${path}.archdraw-backup`);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`);
  renameSync(tmp, path);
}

/** Copy the hook script to ~/.archdraw/hooks (npx caches are temporary). */
function installScript(env) {
  const source = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', HOOK_SCRIPT);
  const target = join(archdrawHome(env), 'hooks', HOOK_SCRIPT);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  copyFileSync(source, target);
  return target;
}

/**
 * Returns { status: 'installed' | 'plugin' | 'error', path, message? }.
 * 'plugin': the ArchDraw Claude Code plugin is enabled and already reports activity.
 */
export function installClaudeHooks(env = process.env) {
  const path = claudeSettingsPath(env);
  let settings;
  try {
    settings = readSettings(path);
  } catch {
    return { status: 'error', path, message: `${path} is not valid JSON, so the hooks were not added. Fix it and run this again.` };
  }
  if (settings.enabledPlugins?.[PLUGIN_ID] === true) {
    // Two sets of hooks would report every event twice.
    if (Object.values(settings.hooks ?? {}).flat().some((g) => (g?.hooks ?? []).some(isOurs))) {
      writeSettings(path, withoutArchdrawHooks(settings));
    }
    return { status: 'plugin', path };
  }
  const script = installScript(env);
  const command = `node "${script}" hook`;
  writeSettings(path, withArchdrawHooks(settings, command));
  return { status: 'installed', path };
}

export function uninstallClaudeHooks(env = process.env) {
  const path = claudeSettingsPath(env);
  let settings;
  try {
    settings = readSettings(path);
  } catch {
    return false;
  }
  const next = withoutArchdrawHooks(settings);
  if (JSON.stringify(next) === JSON.stringify(settings)) return false;
  writeSettings(path, next);
  return true;
}
