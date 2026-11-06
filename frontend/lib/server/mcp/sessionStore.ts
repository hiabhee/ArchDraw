import type { WorkingSessionSnapshot, WorkingSessionStore } from '@hiabhee/archdraw-mcp-server/server';
import logger from '@/lib/logger';
import { redis } from '@/lib/server/redis';
import { validateRedisConfig } from '@/lib/server/env-validation';

/**
 * Working-session persistence for the hosted MCP endpoint.
 *
 * Serverless instances don't share memory, so a diagram generated on one
 * request must be readable by the next `update_diagram` on another instance.
 * Snapshots live in Upstash Redis for a day; without Redis (local dev) or on a
 * Redis error they fall back to this instance's memory, which still works
 * while requests land on the same warm instance.
 */

const TTL_SECONDS = 24 * 60 * 60;
const MAX_CHECKPOINTS = 10;
const MAX_SNAPSHOT_BYTES = 900_000; // Upstash request-size headroom
const key = (id: string) => `mcp:working-session:${id}`;

// The Upstash client retries a failed call for seconds; every tool call does a
// load and a save, so a dead Redis would add that wait twice per call. Cap each
// call and skip Redis for a while after a failure (same as the rate limiter).
const REDIS_TIMEOUT_MS = 1_500;
const REDIS_RETRY_AFTER_MS = 30_000;
let redisDownUntil = 0;

async function withRedis<T>(operation: () => Promise<T>): Promise<T> {
  if (Date.now() < redisDownUntil) throw new Error('Redis recently unreachable');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Redis operation timeout')), REDIS_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    redisDownUntil = Date.now() + REDIS_RETRY_AFTER_MS;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const memory = new Map<string, { snapshot: WorkingSessionSnapshot; expiresAt: number }>();

function fitSnapshot(snapshot: WorkingSessionSnapshot): WorkingSessionSnapshot | null {
  const checkpoints = [...snapshot.checkpoints]
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt))
    .slice(-MAX_CHECKPOINTS);
  let fitted: WorkingSessionSnapshot = { ...snapshot, checkpoints };
  // Drop oldest checkpoints first; the live diagram is what matters most.
  while (Buffer.byteLength(JSON.stringify(fitted)) > MAX_SNAPSHOT_BYTES) {
    if (fitted.checkpoints.length === 0) return null;
    fitted = { ...fitted, checkpoints: fitted.checkpoints.slice(1) };
  }
  return fitted;
}

function saveToMemory(id: string, snapshot: WorkingSessionSnapshot): void {
  const now = Date.now();
  for (const [k, v] of memory) if (v.expiresAt <= now) memory.delete(k);
  memory.set(id, { snapshot, expiresAt: now + TTL_SECONDS * 1000 });
}

function loadFromMemory(id: string): WorkingSessionSnapshot | null {
  const entry = memory.get(id);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return structuredClone(entry.snapshot);
}

export const mcpWorkingSessionStore: WorkingSessionStore = {
  async load(id) {
    if (validateRedisConfig()) {
      try {
        const stored = await withRedis(() => redis.get<WorkingSessionSnapshot>(key(id)));
        if (stored) return stored;
      } catch (error) {
        logger.warn('[MCP] Working-session load failed, using memory:', error instanceof Error ? error.message : error);
      }
    }
    return loadFromMemory(id);
  },

  async save(id, snapshot) {
    const fitted = fitSnapshot(snapshot);
    if (!fitted) {
      logger.warn(`[MCP] Working session ${id} exceeds ${MAX_SNAPSHOT_BYTES} bytes; not persisted`);
      return;
    }
    saveToMemory(id, fitted);
    if (!validateRedisConfig()) return;
    try {
      await withRedis(() => redis.set(key(id), fitted, { ex: TTL_SECONDS }));
    } catch (error) {
      logger.warn('[MCP] Working-session save failed, kept in memory:', error instanceof Error ? error.message : error);
    }
  },
};
