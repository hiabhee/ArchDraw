// The local link between a checkout and its ArchDraw live project, shared with
// the hook script and `archdraw-mcp-server link`: ~/.archdraw/projects.json
// (mode 0600, `version: 1`, keyed by repository root). Never committed.

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function archdrawHome(env = process.env) {
  return env.ARCHDRAW_HOME || join(homedir(), '.archdraw');
}

export function bindingFilePath(env = process.env) {
  return join(archdrawHome(env), 'projects.json');
}

function read(env) {
  const path = bindingFilePath(env);
  if (!existsSync(path)) return { version: 1, projects: {} };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    // It holds other repositories' links: never overwrite it blindly.
    throw new Error(`${path} is not valid JSON. Fix or delete it, then run this again.`);
  }
  return { version: 1, projects: parsed?.projects && typeof parsed.projects === 'object' ? parsed.projects : {} };
}

export function getBinding(repoRoot, env = process.env) {
  return read(env).projects[repoRoot] ?? null;
}

function write(file, env) {
  const dir = archdrawHome(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = bindingFilePath(env);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
  chmodSync(path, 0o600);
}

export function saveBinding(repoRoot, binding, env = process.env) {
  const file = read(env);
  file.projects[repoRoot] = binding;
  write(file, env);
}

export function removeBinding(repoRoot, env = process.env) {
  const file = read(env);
  if (!file.projects[repoRoot]) return false;
  delete file.projects[repoRoot];
  write(file, env);
  return true;
}
