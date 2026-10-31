// Keep `npx archdraw-live` on the newest release. npx reuses a cached copy of a
// package it has already fetched, so the CLI asks the npm registry for the
// latest version itself and re-launches on it when it is newer. Only that one
// public registry request is made; nothing about the user or repository is sent.

import { spawnSync } from 'node:child_process';

export const PACKAGE = 'archdraw-live';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE}/latest`;

const parts = (version) => String(version).split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0);

/** True when `candidate` is a higher x.y.z than `current`. */
export function isNewer(candidate, current) {
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

/** The newest published version, or null when the registry can't be reached quickly. */
export async function latestVersion({ fetchImpl = fetch, timeoutMs = 2000 } = {}) {
  try {
    const res = await fetchImpl(REGISTRY_URL, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const { version } = await res.json();
    return typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version) ? version : null;
  } catch {
    return null;
  }
}

export function updateCheckDisabled(env = process.env) {
  return Boolean(env.ARCHDRAW_NO_UPDATE_CHECK || env.ARCHDRAW_LIVE_UPDATED || env.CI);
}

/** Run this CLI at an exact version through npx (which fetches and caches it). Returns the exit status, or null if it could not start. */
export function runVersion(version, args, { stdio = 'inherit', env = process.env } = {}) {
  const win = process.platform === 'win32';
  const result = spawnSync(win ? 'npx.cmd' : 'npx', ['-y', `${PACKAGE}@${version}`, ...args], {
    stdio,
    env: { ...env, ARCHDRAW_LIVE_UPDATED: '1' },
    shell: win,
  });
  return result.error ? null : result.status;
}
