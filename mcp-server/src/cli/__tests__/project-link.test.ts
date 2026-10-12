import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runProjectCommand } from '../project-link.js';
import { getBinding, saveBinding } from '../../lib/project-binding.js';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('project link CLI', () => {
  let home: string;
  let repo: string;
  const logs: string[] = [];

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'archdraw-home-'));
    repo = mkdtempSync(join(tmpdir(), 'archdraw-repo-'));
    process.env.ARCHDRAW_HOME = home;
    logs.length = 0;
  });
  afterEach(() => {
    delete process.env.ARCHDRAW_HOME;
  });

  const io = (fetchImpl: typeof fetch) => ({
    log: (m: string) => logs.push(m),
    fetch: fetchImpl,
    sleep: async () => {},
    cwd: repo,
    env: {},
  });

  it('never overwrites an unreadable link file (it holds other repos)', () => {
    const file = join(home, 'projects.json');
    writeFileSync(file, '{ not json');
    const binding = { apiBase: 'http://localhost:3000', canvasId: 'c', agenticProjectId: 'p', workspaceId: 'w', token: 'adp_x', linkedAt: '' };
    expect(() => saveBinding(repo, binding)).toThrow(/not valid JSON/);
    expect(readFileSync(file, 'utf8')).toBe('{ not json');
  });

  it('requires an https (or localhost) API base', async () => {
    const fetchImpl = vi.fn();
    expect(await runProjectCommand('link', [], io(fetchImpl as never))).toBe(2);
    expect(await runProjectCommand('link', ['--api', 'http://evil.example'], io(fetchImpl as never))).toBe(2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('pairs, then stores the binding outside the repo with 0600 permissions', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(200, { pairingId: 'p', userCode: 'ABCDEFGHJKLM', pollToken: 'adp_secret', expiresAt }))
      .mockResolvedValueOnce(json(202, { status: 'pending' }))
      .mockResolvedValueOnce(json(200, { status: 'complete', projectId: 'proj', workspaceId: 'ws', canvasId: 'canvas-1' }));

    const code = await runProjectCommand('link', ['--api', 'http://localhost:3000/'], io(fetchImpl as never));
    expect(code).toBe(0);
    expect(logs.join('\n')).toContain('ABCD-EFGH-JKLM');
    expect(logs.join('\n')).not.toContain('adp_secret');

    const binding = getBinding(repo);
    expect(binding).toMatchObject({ apiBase: 'http://localhost:3000', canvasId: 'canvas-1', token: 'adp_secret' });
    const file = join(home, 'projects.json');
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1);
  });

  it('refuses projects that are not backed by a canvas', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(200, { pairingId: 'p', userCode: 'ABCDEFGHJKLM', pollToken: 'adp_x', expiresAt }))
      .mockResolvedValueOnce(json(200, { status: 'complete', projectId: 'proj', workspaceId: 'ws', canvasId: null }));
    expect(await runProjectCommand('link', ['--api', 'http://localhost:3000'], io(fetchImpl as never))).toBe(1);
    expect(getBinding(repo)).toBeUndefined();
  });

  it('reports expiry', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(200, { pairingId: 'p', userCode: 'ABCDEFGHJKLM', pollToken: 'adp_x', expiresAt }))
      .mockResolvedValueOnce(json(410, { status: 'expired' }));
    expect(await runProjectCommand('link', ['--api', 'http://localhost:3000'], io(fetchImpl as never))).toBe(1);
    expect(logs.at(-1)).toContain('expired');
  });

  it('status and unlink', async () => {
    const fetchImpl = vi.fn();
    expect(await runProjectCommand('status', [], io(fetchImpl as never))).toBe(1);
    expect(await runProjectCommand('unlink', [], io(fetchImpl as never))).toBe(0);
    expect(logs.at(-1)).toContain('not linked');
  });
});
