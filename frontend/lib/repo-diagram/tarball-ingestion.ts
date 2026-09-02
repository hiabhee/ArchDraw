import { Unzip, UnzipInflate } from 'fflate';
import { isSkipped, MAX_ARCHIVE_CONTENT_LENGTH_BYTES, MAX_TOTAL_EXTRACTED_BYTES, MAX_PER_FILE_BYTES } from './skip-rules';
import logger from '@/lib/logger';
import type { FileEntry } from '@/lib/types/repo-diagram';

export type ArchiveResult = {
  /** path (prefix-stripped) → content (utf-8 string) for files that passed skip rules. */
  files: Map<string, string>;
  /** archivedAt marker (Date.now) for caching. */
  fetchedAt: number;
};

/**
 * Fetch a GitHub repository zipball and extract small text files into memory.
 *
 * Uses 1 GitHub API request (the archive) + the existing tree/ref calls.
 * Returns null when the archive is unavailable (private/size guard/non-200/rate limit)
 * so the caller falls back to the Contents-API path.
 *
 * @param ref branch or sha to archive (default head ref).
 */
export async function fetchRepoArchive(
  owner: string,
  repo: string,
  ref: string,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<ArchiveResult | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/zipball/${ref}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers,
      signal,
      redirect: 'follow',
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    logger.warn(`[Tarball] network error fetching ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }

  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset');
    if (res.status === 404) {
      logger.warn(`[Tarball] archive 404 for ${owner}/${repo} — likely private, not found, or rate-limited (remaining=${remaining ?? '?'}, reset=${reset ?? '?'})`);
    } else if (res.status === 401 || res.status === 403) {
      logger.warn(`[Tarball] archive ${res.status} for ${owner}/${repo} (remaining=${remaining ?? '?'}, reset=${reset ?? '?'}) — falling back to Contents-API`);
    } else {
      logger.warn(`[Tarball] archive fetch returned status ${res.status} for ${owner}/${repo} (remaining=${remaining ?? '?'})`);
    }
    return null;
  }

  // Size guard via Content-Length (codeload usually sets it).
  const clHeader = res.headers.get('content-length');
  let contentLength = 0;
  if (clHeader) {
    contentLength = Number(clHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_ARCHIVE_CONTENT_LENGTH_BYTES) {
      logger.warn(`[Tarball] archive too large (${(contentLength / 1024 / 1024).toFixed(1)}MB) — skipping`);
      return null;
    }
  }

  if (!res.body) {
    logger.warn('[Tarball] no response body for archive');
    return null;
  }

  const files = new Map<string, string>();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let totalBytes = 0;
  let prefix: string | null = null;
  let aborted = false;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);

  unzip.onfile = (file) => {
    if (aborted) return;

    let path = file.name;
    // Directory entries in zipballs carry a trailing '/' (and zero content).
    if (path.endsWith('/')) return;
    // Strip the leading "<owner>-<repo>-<sha>/" prefix (determined from first entry).
    if (prefix === null) {
      const slash = path.indexOf('/');
      prefix = slash >= 0 ? path.slice(0, slash + 1) : '';
    }
    if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length);
    if (!path) return;

    const sz = file.originalSize ?? file.size ?? 0;

    // Per-file cap + skip rules (decided BEFORE decompressing — streaming win).
    // isSkipped already covers binary extensions via BINARY_RE in skip-rules.ts (GH2R-007 unified)
    if (sz > MAX_PER_FILE_BYTES) return;
    if (isSkipped(path, sz)) return;
    if (totalBytes + sz > MAX_TOTAL_EXTRACTED_BYTES) {
      aborted = true;
      return;
    }
    totalBytes += sz;

    const chunks: Uint8Array[] = [];
    file.ondata = (_err, data, final) => {
      if (data) chunks.push(data);
      if (final) {
        if (aborted) return;
        const full = concatU8(chunks);
        if (full.byteLength > MAX_PER_FILE_BYTES) return; // safety: actual decompressed size
        files.set(path, decoder.decode(full));
      }
    };
    file.start();
  };

  // Stream the response body into the unzip decoder.
  const reader = res.body.getReader();
  try {
    for (;;) {
      if (aborted) {
        try { await reader.cancel(); } catch { /* ignore */ }
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      unzip.push(value, false);
    }
    // Flush any pending state.
    unzip.push(new Uint8Array(0), true);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    logger.warn('[Tarball] error while streaming archive:', err instanceof Error ? err.message : err);
    return null;
  }

  if (files.size === 0) {
    logger.warn('[Tarball] extracted 0 usable files (aborted or binary-only)');
    return null;
  }

  logger.info(`[Tarball] archive hit: ${files.size} files, ${(totalBytes / 1024).toFixed(0)}KB${aborted ? ' (truncated at cap)' : ''}`);
  return { files, fetchedAt: Date.now() };
}

/** Convenience: convert the archive map into a FileEntry[] (preserving insertion order). */
export function archiveFilesToList(archive: ArchiveResult): FileEntry[] {
  const entries: FileEntry[] = [];
  for (const [path, content] of archive.files) {
    entries.push({ path, content });
  }
  return entries;
}

function concatU8(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) return new Uint8Array(0);
  if (chunks.length === 1) return chunks[0];
  let len = 0;
  for (const c of chunks) len += c.byteLength;
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}