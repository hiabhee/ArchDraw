import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Local link between a git checkout and an ArchDraw live project canvas.
 * Stored outside the repository (never committed) in
 * `~/.archdraw/projects.json`, mode 0600. The plugin hook script reads the
 * same file — keep the format stable (`version: 1`).
 */
export interface ProjectBinding {
  apiBase: string;
  canvasId: string;
  agenticProjectId: string;
  workspaceId: string;
  /** Project-scoped `adp_` agent credential. Never print or log it. */
  token: string;
  linkedAt: string;
}

interface BindingFile {
  version: 1;
  projects: Record<string, ProjectBinding>;
}

export function archdrawHome(): string {
  return process.env.ARCHDRAW_HOME || join(homedir(), '.archdraw');
}

export function bindingFilePath(): string {
  return join(archdrawHome(), 'projects.json');
}

/** Repository root for `cwd` (git top-level), falling back to cwd itself. */
export function resolveRepoRoot(cwd: string = process.cwd()): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return resolve(cwd);
  }
}

export function readBindings(): BindingFile {
  const path = bindingFilePath();
  if (!existsSync(path)) return { version: 1, projects: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<BindingFile>;
    return { version: 1, projects: parsed.projects && typeof parsed.projects === 'object' ? parsed.projects : {} };
  } catch {
    return { version: 1, projects: {} };
  }
}

function writeBindings(file: BindingFile) {
  const dir = archdrawHome();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = bindingFilePath();
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
  chmodSync(path, 0o600);
}

export function getBinding(repoRoot: string): ProjectBinding | undefined {
  return readBindings().projects[repoRoot];
}

export function saveBinding(repoRoot: string, binding: ProjectBinding) {
  const file = readBindings();
  file.projects[repoRoot] = binding;
  writeBindings(file);
}

export function removeBinding(repoRoot: string): boolean {
  const file = readBindings();
  if (!file.projects[repoRoot]) return false;
  delete file.projects[repoRoot];
  writeBindings(file);
  return true;
}
