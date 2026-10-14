import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOOK_EVENTS, installClaudeHooks, uninstallClaudeHooks, withArchdrawHooks } from './claudeHooks.mjs';

function env(settings) {
  const claude = mkdtempSync(join(tmpdir(), 'claude-'));
  const home = mkdtempSync(join(tmpdir(), 'archdraw-'));
  if (settings !== undefined) writeFileSync(join(claude, 'settings.json'), typeof settings === 'string' ? settings : JSON.stringify(settings));
  return { CLAUDE_CONFIG_DIR: claude, ARCHDRAW_HOME: home };
}
const read = (e) => JSON.parse(readFileSync(join(e.CLAUDE_CONFIG_DIR, 'settings.json'), 'utf8'));

test('adds every hook once, keeps other settings and hooks, and is idempotent', () => {
  const e = env({ model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] } });
  assert.equal(installClaudeHooks(e).status, 'installed');
  assert.equal(installClaudeHooks(e).status, 'installed');
  const settings = read(e);
  assert.equal(settings.model, 'opus');
  for (const [event] of HOOK_EVENTS) {
    const ours = settings.hooks[event].flatMap((g) => g.hooks).filter((h) => h.command.includes('archdraw-project.mjs'));
    assert.equal(ours.length, 1, event);
  }
  assert.ok(settings.hooks.Stop.some((g) => g.hooks.some((h) => h.command === 'say done')));
  assert.equal(settings.hooks.PostToolUse.at(-1).matcher, 'Edit|Write|MultiEdit|NotebookEdit|Read|Grep|Glob');
  assert.ok(existsSync(join(e.ARCHDRAW_HOME, 'hooks', 'archdraw-project.mjs')));
  assert.ok(existsSync(join(e.CLAUDE_CONFIG_DIR, 'settings.json.archdraw-backup')));
});

test('uses the ArchDraw plugin instead when it is enabled', () => {
  const e = env({ enabledPlugins: { 'archdraw@archdraw': true } });
  assert.equal(installClaudeHooks(e).status, 'plugin');
  assert.equal(read(e).hooks, undefined);
});

test('leaves a settings file it cannot parse untouched', () => {
  const e = env('{ not json');
  assert.equal(installClaudeHooks(e).status, 'error');
  assert.equal(readFileSync(join(e.CLAUDE_CONFIG_DIR, 'settings.json'), 'utf8'), '{ not json');
});

test('uninstall removes only our hooks', () => {
  const e = env({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] } });
  installClaudeHooks(e);
  assert.equal(uninstallClaudeHooks(e), true);
  assert.deepEqual(read(e).hooks, { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] });
});

test('never touches plugin-provided hook commands', () => {
  const plugin = { type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/archdraw-project.mjs" hook' };
  const next = withArchdrawHooks({ hooks: { Stop: [{ hooks: [plugin] }] } }, 'node "/x/archdraw-project.mjs" hook');
  assert.ok(next.hooks.Stop.some((g) => g.hooks.includes(plugin)));
});
