import logger from '@/lib/logger';
import { redis } from '@/lib/redis';

export type CapacityDetailLevel = 1 | 2 | 3;

export interface AiCapacityConfig {
  tpmLimit: number;
  rpmLimit: number;
  maxQueueDepth: number;
  maxActiveJobs: number;
  safetyFactor: number;
  plannerTokens: Record<CapacityDetailLevel, number>;
  repairTokens: number;
  jobTtlSeconds: number;
}

const numberEnv = (name: string, fallback: number, min = 1) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min ? value : fallback;
};

export const AI_CAPACITY: AiCapacityConfig = {
  tpmLimit: numberEnv('AI_GLOBAL_TPM_LIMIT', 12_000),
  rpmLimit: numberEnv('AI_GLOBAL_RPM_LIMIT', 30),
  maxQueueDepth: numberEnv('AI_QUEUE_MAX_DEPTH', 30),
  maxActiveJobs: numberEnv('AI_MAX_ACTIVE_JOBS', 2),
  safetyFactor: Math.min(1, Math.max(0.1, numberEnv('AI_ADMISSION_SAFETY_FACTOR', 0.85, 0.1))),
  plannerTokens: {
    1: numberEnv('AI_L1_MAX_TOKENS', 2_048),
    2: numberEnv('AI_L2_MAX_TOKENS', 3_072),
    3: numberEnv('AI_L3_MAX_TOKENS', 4_096),
  },
  repairTokens: numberEnv('AI_REPAIR_MAX_TOKENS', 2_048),
  jobTtlSeconds: numberEnv('AI_JOB_TTL_SECONDS', 900),
};

export interface GenerationBudget {
  estimatedTokens: number;
  maxPlannerTokens: number;
  repairReserved: boolean;
  detailLevel: CapacityDetailLevel;
}

export function getGenerationBudget(description: string, detailLevel: CapacityDetailLevel): GenerationBudget {
  // A conservative estimate: prompt characters are roughly four characters per
  // token, plus the configured completion ceiling. The safety factor is applied
  // at admission time so provider headroom remains available for retries.
  const promptTokens = Math.ceil(description.length / 4) + 512;
  const maxPlannerTokens = AI_CAPACITY.plannerTokens[detailLevel];
  return {
    estimatedTokens: promptTokens + maxPlannerTokens,
    maxPlannerTokens,
    repairReserved: false,
    detailLevel,
  };
}

type Waiter = { tokens: number; resolve: (release: () => void) => void; reject: (error: Error) => void };
let activeJobs = 0;
let reservedTokens = 0;
let windowStartedAt = Date.now();
const queued: Waiter[] = [];

function resetWindowIfNeeded() {
  if (Date.now() - windowStartedAt >= 60_000) {
    windowStartedAt = Date.now();
    reservedTokens = 0;
  }
}

function canStart(tokens: number) {
  resetWindowIfNeeded();
  return activeJobs < AI_CAPACITY.maxActiveJobs &&
    reservedTokens + tokens <= AI_CAPACITY.tpmLimit * AI_CAPACITY.safetyFactor;
}

function drain() {
  while (queued.length && canStart(queued[0].tokens)) {
    const waiter = queued.shift()!;
    activeJobs += 1;
    reservedTokens += waiter.tokens;
    let released = false;
    waiter.resolve(() => {
      if (released) return;
      released = true;
      activeJobs = Math.max(0, activeJobs - 1);
      drain();
    });
  }
}

// Atomically reserve tokens + one request in this minute's global window, or
// reserve nothing. Returns 1 when admitted, 0 when over budget.
const GLOBAL_RESERVE_SCRIPT = `
local tpm = redis.call('INCRBY', KEYS[1], ARGV[1])
local rpm = redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[1], 120)
redis.call('EXPIRE', KEYS[2], 120)
if tpm > tonumber(ARGV[2]) or rpm > tonumber(ARGV[3]) then
  redis.call('DECRBY', KEYS[1], ARGV[1])
  redis.call('DECR', KEYS[2])
  return 0
end
return 1
`;
const GLOBAL_RESERVE_TIMEOUT_MS = 1_000;

/**
 * Cross-instance TPM/RPM admission. The in-process counters below only see
 * one serverless instance, so on their own the "global" provider budget was
 * really per-instance. When Upstash is configured this reserves against a
 * shared per-minute window first; if Redis is absent or failing we fall back
 * to the local limiter alone (this protects provider capacity — guest quota
 * enforcement stays fail-closed in quotaCheck).
 */
async function reserveGlobalCapacity(tokens: number): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60_000);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      redis.eval(
        GLOBAL_RESERVE_SCRIPT,
        [`ai-capacity:tpm:${minute}`, `ai-capacity:rpm:${minute}`],
        [String(tokens), String(Math.floor(AI_CAPACITY.tpmLimit * AI_CAPACITY.safetyFactor)), String(AI_CAPACITY.rpmLimit)],
      ),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), GLOBAL_RESERVE_TIMEOUT_MS); }),
    ]);
    return Number(result) === 1;
  } catch (error) {
    logger.debug('[AI Capacity] Global admission unavailable, using local limiter only', error instanceof Error ? error.message : error);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

export async function acquireAiCapacity(budget: GenerationBudget): Promise<() => void> {
  const tokens = Math.max(1, budget.estimatedTokens);
  if (tokens > AI_CAPACITY.tpmLimit * AI_CAPACITY.safetyFactor) {
    throw new CapacityBusyError('This prompt is too large for the current AI capacity budget. Please shorten it and try again.');
  }
  if (queued.length >= AI_CAPACITY.maxQueueDepth && !canStart(tokens)) {
    throw new CapacityBusyError('AI generation capacity is temporarily full. Please try again shortly.');
  }
  if (!(await reserveGlobalCapacity(tokens))) {
    throw new CapacityBusyError('AI generation capacity is temporarily full. Please try again shortly.');
  }
  return new Promise<() => void>((resolve, reject) => {
    queued.push({ tokens, resolve, reject });
    drain();
    if (queued.length > AI_CAPACITY.maxQueueDepth) {
      const index = queued.findIndex((item) => item.resolve === resolve);
      if (index >= 0) queued.splice(index, 1);
      reject(new CapacityBusyError('AI generation queue is full. Please try again shortly.'));
    }
  });
}

export class CapacityBusyError extends Error {
  status = 503;
  code = 'AI_CAPACITY_BUSY' as const;
  constructor(message: string) {
    super(message);
    this.name = 'CapacityBusyError';
  }
}

export function getAiCapacitySnapshot() {
  resetWindowIfNeeded();
  return {
    activeJobs,
    queuedJobs: queued.length,
    maxActiveJobs: AI_CAPACITY.maxActiveJobs,
    maxQueueDepth: AI_CAPACITY.maxQueueDepth,
    reservedTokens,
    tokenLimit: AI_CAPACITY.tpmLimit,
  };
}

logger.debug('[AI Capacity] configured', {
  tpmLimit: AI_CAPACITY.tpmLimit,
  maxActiveJobs: AI_CAPACITY.maxActiveJobs,
  maxQueueDepth: AI_CAPACITY.maxQueueDepth,
});
