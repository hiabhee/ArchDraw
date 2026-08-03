import { describe, it, expect } from 'vitest';
import { zipSync, type ZipOptions } from 'fflate';
import { fetchRepoArchive } from '../tarball-ingestion';

// Build an in-memory zip that mimics a GitHub zipball (single top-level owner-repo-sha dir).
function makeZipball(entries: Record<string, string>, prefix = 'owner-repo-abcdef/'): Uint8Array {
  const zipped: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(entries)) {
    zipped[prefix + path] = new TextEncoder().encode(content);
  }
  return zipSync(zipped, { level: 0 } as ZipOptions);
}

function mockArchiveResponse(zip: Uint8Array): Response {
  return new Response(zip as BodyInit, {
    status: 200,
    headers: { 'content-length': String(zip.byteLength), 'content-type': 'application/zip' },
  });
}

describe('fetchRepoArchive', () => {
  it('extracts files and strips the owner-repo-sha prefix', async () => {
    const zip = makeZipball({
      'package.json': '{"name":"demo","dependencies":{"express":"^4"}}',
      'src/index.js': "const x = require('./a');\n",
      'src/a.js': "module.exports = 1;\n",
    });
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => mockArchiveResponse(zip)) as typeof fetch;
    try {
      const res = await fetchRepoArchive('owner', 'repo', 'main', framework);
      expect(res).not.toBeNull();
      const files = res!.files;
      expect(files.get('package.json')).toContain('demo');
      expect(files.get('src/index.js')).toContain('require');
      expect(files.has('owner-repo-abcdef/package.json')).toBe(false);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('applies skip rules (node_modules, lockfiles, binaries, large files)', async () => {
    const big = 'x'.repeat(600 * 1024); // >500KB per-file cap
    const zip = makeZipball({
      'package.json': '{}',
      'node_modules/lame/index.js': "evil",
      'package-lock.json': '{}',
      'logo.png': 'pngbytes',
      'big.txt': big,
      'app/route.ts': 'export function GET() {}',
    });
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => mockArchiveResponse(zip)) as typeof fetch;
    try {
      const res = await fetchRepoArchive('owner', 'repo', 'main', framework);
      expect(res!.files.size).toBe(2);
      expect(res!.files.has('package.json')).toBe(true);
      expect(res!.files.has('app/route.ts')).toBe(true);
      expect(res!.files.has('node_modules/lame/index.js')).toBe(false);
      expect(res!.files.has('package-lock.json')).toBe(false);
      expect(res!.files.has('logo.png')).toBe(false);
      expect(res!.files.has('big.txt')).toBe(false);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('returns null on non-200', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    try {
      const res = await fetchRepoArchive('owner', 'repo', 'main', framework);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('returns null when Content-Length exceeds the size guard', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(null, {
      status: 200,
      headers: { 'content-length': String(200 * 1024 * 1024) },
    })) as typeof fetch;
    try {
      const res = await fetchRepoArchive('owner', 'repo', 'main', framework);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

const framework = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'ArbDraw' };