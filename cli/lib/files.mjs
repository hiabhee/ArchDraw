// The repository's files, on this machine: the list the map check compares
// Claude's answer against (paths only; nothing is read or sent from here).

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.turbo', '.vercel', '.output',
  'coverage', 'vendor', 'target', '__pycache__', '.venv', 'venv', '.idea', '.vscode', '.cache', '.expo', 'Pods',
  'DerivedData', '.gradle', 'obj', '.dart_tool', '.pytest_cache', '.mypy_cache', 'generated', '__generated__', 'site-packages',
]);

const MAX_FILES = 30_000;

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024, timeout: 15_000 });
  } catch {
    return null;
  }
}

function skipped(path) {
  return path.split('/').some((segment) => SKIP_DIRS.has(segment));
}

/** Repository files (repo-relative, POSIX), honouring .gitignore when git is available. */
export function listFiles(root) {
  const fromGit = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], root);
  if (fromGit !== null) {
    return fromGit.split('\0').filter((p) => p && !skipped(p)).slice(0, MAX_FILES);
  }
  const files = [];
  const walk = (dir, rel) => {
    if (files.length >= MAX_FILES) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(join(dir, entry.name), path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  };
  walk(root, '');
  return files;
}
