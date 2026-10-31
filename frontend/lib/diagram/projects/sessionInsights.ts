import type { LiveAgentSession } from './liveActivity';
import { addUsage, emptyUsage, estimateCostUsd, totalTokens, type TokenUsage } from './sessionUsage';

/**
 * What the live sessions say about money: one session spending far more than
 * the rest, and where on the diagram the tokens go. Pure, so the canvas, the panel and the watch page
 * agree.
 */

/** A session's estimated spend in USD, or null when it reported none or its model has no known price. */
export function sessionCostUsd(session: Pick<LiveAgentSession, 'usage' | 'model'>): number | null {
  return session.usage ? estimateCostUsd(session.usage, session.model) : null;
}

/** Spend above this is worth a look even for a lone session. */
export const HIGH_SPEND_MIN_USD = 5;
/** ...and, with other sessions to compare to, this many times their median. */
export const HIGH_SPEND_RATIO = 3;

/** Keys of sessions whose spend stands out: over the floor and well above their peers' median. */
export function highSpendSessions(sessions: readonly LiveAgentSession[]): Set<string> {
  const costs = sessions
    .filter((s) => s.status !== 'ended')
    .map((s) => ({ key: s.sessionKey, usd: sessionCostUsd(s) }))
    .filter((c): c is { key: string; usd: number } => c.usd != null);
  const flagged = new Set<string>();
  for (const { key, usd } of costs) {
    if (usd < HIGH_SPEND_MIN_USD) continue;
    const peers = costs.filter((c) => c.key !== key).map((c) => c.usd).sort((a, b) => a - b);
    if (peers.length === 0) {
      flagged.add(key);
      continue;
    }
    const mid = Math.floor(peers.length / 2);
    const median = peers.length % 2 ? peers[mid] : (peers[mid - 1] + peers[mid]) / 2;
    if (usd >= median * HIGH_SPEND_RATIO) flagged.add(key);
  }
  return flagged;
}

export interface ComponentSpend {
  tokens: number;
  /** Null when no session on a priced model contributed. */
  usd: number | null;
}

/** Tokens and estimated USD per component, across all sessions. `UNPLACED` holds spend before a session reached a component. */
export function componentSpend(sessions: readonly LiveAgentSession[]): Record<string, ComponentSpend> {
  const total: Record<string, { usage: TokenUsage; usd: number | null }> = {};
  for (const session of sessions) {
    for (const [id, usage] of Object.entries(session.usageByComponent ?? {})) {
      const entry = (total[id] ??= { usage: emptyUsage(), usd: null });
      entry.usage = addUsage(entry.usage, usage);
      const usd = estimateCostUsd(usage, session.model);
      if (usd != null) entry.usd = (entry.usd ?? 0) + usd;
    }
  }
  const out: Record<string, ComponentSpend> = {};
  for (const [id, { usage, usd }] of Object.entries(total)) out[id] = { tokens: totalTokens(usage), usd };
  return out;
}
