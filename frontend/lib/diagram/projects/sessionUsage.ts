/**
 * Token usage of agent sessions. Hooks read the numbers from the session's own
 * transcript on the user's machine and send only the counts (never content);
 * the server keeps a running total per session and per component.
 */

export interface TokenUsage {
  input: number;
  output: number;
  /** Prompt-cache writes with the 5-minute and the 1-hour lifetime. */
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
}

export type UsageByComponent = Record<string, TokenUsage>;

const FIELDS = ['input', 'output', 'cacheWrite5m', 'cacheWrite1h', 'cacheRead'] as const;
/** Sanity cap on any one counter (a transcript of this size does not exist). */
const MAX_COUNT = 1e13;
/** Key for tokens spent before the session was placed on a component. */
export const UNPLACED = '_unplaced';

export function emptyUsage(): TokenUsage {
  return { input: 0, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 };
}

/** Counts from untrusted JSON (a hook payload or a stored row); null when it is not usage. */
export function parseUsage(value: unknown): TokenUsage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const out = emptyUsage();
  let any = false;
  for (const field of FIELDS) {
    const n = source[field];
    if (n === undefined) continue;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > MAX_COUNT) return null;
    out[field] = Math.round(n);
    any = true;
  }
  return any ? out : null;
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheWrite5m: a.cacheWrite5m + b.cacheWrite5m,
    cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h,
    cacheRead: a.cacheRead + b.cacheRead,
  };
}

/** What `next` adds over `prev`; a counter that went backwards (a restarted transcript) adds nothing. */
export function diffUsage(next: TokenUsage, prev: TokenUsage): TokenUsage {
  const out = emptyUsage();
  for (const field of FIELDS) out[field] = Math.max(0, next[field] - prev[field]);
  return out;
}

export function totalTokens(u: TokenUsage): number {
  return u.input + u.output + u.cacheWrite5m + u.cacheWrite1h + u.cacheRead;
}

export function isEmptyUsage(u: TokenUsage): boolean {
  return totalTokens(u) === 0;
}

export function parseUsageByComponent(value: unknown): UsageByComponent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: UsageByComponent = {};
  for (const [id, usage] of Object.entries(value as Record<string, unknown>)) {
    const parsed = parseUsage(usage);
    if (parsed) out[id] = parsed;
  }
  return out;
}

/** Adds `delta` to one component's running usage. */
export function addToComponent(byComponent: UsageByComponent, componentId: string | null, delta: TokenUsage): UsageByComponent {
  if (isEmptyUsage(delta)) return byComponent;
  const key = componentId ?? UNPLACED;
  return { ...byComponent, [key]: addUsage(byComponent[key] ?? emptyUsage(), delta) };
}

// ── Cost estimate ─────────────────────────────────────────────────────────

interface Price {
  /** USD per million tokens. */
  input: number;
  output: number;
  cacheRead: number;
}

/**
 * List prices, USD per million tokens, matched on the model id's family. Cache
 * writes are priced at 1.25x (5 minutes) and 2x (1 hour) the input price. An
 * estimate for orientation: plans, discounts and long-prompt tiers differ.
 */
const PRICES: Array<[RegExp, Price]> = [
  [/fable|mythos/, { input: 10, output: 50, cacheRead: 0.25 }],
  [/opus-5-5/, { input: 4, output: 20, cacheRead: 0.2 }],
  [/opus/, { input: 5, output: 25, cacheRead: 0.5 }],
  [/sonnet-5/, { input: 2, output: 10, cacheRead: 0.2 }],
  [/sonnet/, { input: 3, output: 15, cacheRead: 0.3 }],
  [/haiku-5/, { input: 0.1, output: 0.5, cacheRead: 0.01 }],
  [/haiku/, { input: 1, output: 5, cacheRead: 0.1 }],
];

function priceFor(model: string | null | undefined): Price | null {
  if (!model) return null;
  const id = model.toLowerCase();
  return PRICES.find(([pattern]) => pattern.test(id))?.[1] ?? null;
}

/** Estimated USD for these tokens on this model; null when the model's price is not known. */
export function estimateCostUsd(u: TokenUsage, model: string | null | undefined): number | null {
  const price = priceFor(model);
  if (!price) return null;
  return (
    (u.input * price.input +
      u.output * price.output +
      u.cacheWrite5m * price.input * 1.25 +
      u.cacheWrite1h * price.input * 2 +
      u.cacheRead * price.cacheRead) /
    1e6
  );
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) return `${(n / 1000).toFixed(n < 1e4 ? 1 : 0)}k`;
  return `${(n / 1e6).toFixed(n < 1e7 ? 2 : 1)}M`;
}

export function formatUsd(usd: number): string {
  if (usd < 0.01) return '<$0.01';
  return usd < 10 ? `$${usd.toFixed(2)}` : `$${Math.round(usd)}`;
}
