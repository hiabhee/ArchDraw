import type { LiveAgentSession, SessionAction, TouchedMap } from '@/lib/diagram/projects/liveActivity';
import type { StructureChange } from '@/lib/diagram/projects/structureDiff';

/**
 * The landing hero's scripted sessions. It produces the same
 * `LiveAgentSession` records the live API returns, so the product's own
 * Agent Atlas, node activity and "Needs you" queue draw them unchanged.
 */

export const LOOP_SECONDS = 30;
/** When Lynx's new component is published (the map switches to the mapped graph). */
export const MAPPED_AT = 17;

interface Step {
  t: number;
  action: SessionAction;
  /** Component the session is on; null while it only aims somewhere. */
  at: string | null;
  aim?: string;
  /** Working on new code no component owns, beside this component. */
  siteBeside?: string;
  idle?: boolean;
}

interface Script { key: string; name: string; color: string; branch: string; intent: string; steps: Step[] }

// Product session colours (SESSION_COLORS), one per session.
export const SCRIPTS: Script[] = [
  {
    key: 'otter', name: 'Otter', color: '#3b82f6', branch: 'fix/refund-rounding', intent: 'Fix refund rounding',
    steps: [
      { t: 0, action: 'edit', at: 'payments' },
      { t: 6, action: 'waiting', at: 'payments' },
      { t: 15, action: 'edit', at: 'payments' },
      { t: 21, action: 'read', at: 'stripe' },
      { t: 27, action: 'edit', at: 'payments' },
    ],
  },
  {
    key: 'fox', name: 'Fox', color: '#ec4899', branch: 'feat/guest-checkout', intent: 'Guest checkout',
    steps: [
      { t: 0, action: 'read', at: 'web' },
      { t: 3, action: 'edit', at: 'orders' },
      { t: 12, action: 'done', at: 'orders' },
      { t: 24, action: 'read', at: 'web' },
    ],
  },
  {
    key: 'owl', name: 'Owl', color: '#10b981', branch: 'chore/session-ttl', intent: 'Shorter session TTL',
    steps: [
      { t: 0, action: 'read', at: 'auth' },
      { t: 8, action: 'read', at: 'redis' },
      { t: 14, action: 'edit', at: 'auth' },
    ],
  },
  {
    key: 'lynx', name: 'Lynx', color: '#f97316', branch: 'feat/refund-worker', intent: 'Refund worker',
    steps: [
      { t: 0, action: 'edit', at: 'email' },
      { t: 5, action: 'edit', at: null, siteBeside: 'payments' },
      { t: MAPPED_AT, action: 'edit', at: 'refunds' },
      { t: 25, action: 'edit', at: 'email' },
    ],
  },
  {
    key: 'heron', name: 'Heron', color: '#06b6d4', branch: 'feat/search-ranking', intent: 'Search ranking',
    steps: [
      { t: 0, action: 'start', at: null, aim: 'search' },
      { t: 3.5, action: 'edit', at: 'search' },
      { t: 11, action: 'edit', at: 'search', idle: true },
      { t: 18, action: 'read', at: 'postgres' },
      { t: 22, action: 'edit', at: 'search' },
    ],
  },
];

function currentStep(script: Script, t: number): { step: Step; index: number } {
  let index = 0;
  for (let i = 0; i < script.steps.length; i++) if (script.steps[i].t <= t) index = i;
  return { step: script.steps[index], index };
}

export function loopTime(nowMs: number, startMs: number): number {
  return (((nowMs - startMs) / 1000) % LOOP_SECONDS + LOOP_SECONDS) % LOOP_SECONDS;
}

/** A key that changes whenever any session moves to its next step. */
export function scriptSignature(t: number): string {
  return SCRIPTS.map((s) => currentStep(s, t).index).join('.') + (t >= MAPPED_AT ? 'm' : 'b');
}

/** The sessions as the live API would report them at loop time `t`. */
export function sessionsAt(t: number, nowMs: number, change: StructureChange): LiveAgentSession[] {
  const wall = (loopT: number) => nowMs - (t - loopT) * 1000;
  const loopStart = wall(0);
  return SCRIPTS.map((script) => {
    const { step, index } = currentStep(script, t);
    const touched: TouchedMap = {};
    for (const s of script.steps.slice(0, index + 1)) {
      if (s.at && s.action === 'edit') touched[s.at] = { count: (touched[s.at]?.count ?? 0) + 1, lastAt: wall(s.t) };
    }
    const lynxMapped = script.key === 'lynx' && t >= MAPPED_AT;
    return {
      id: script.key,
      sessionKey: script.key,
      name: script.name,
      label: script.name,
      branch: script.branch,
      status: step.idle ? 'idle' : 'active',
      intent: script.intent,
      currentComponentId: step.at,
      touched,
      unmappedPaths: [],
      startedAt: loopStart - SCRIPTS.indexOf(script) * 60_000,
      lastSeenAt: wall(step.t),
      color: script.color,
      lastChange: lynxMapped ? { ...change, at: wall(MAPPED_AT) } : null,
      lastAction: step.action,
      lastActionAt: wall(step.t),
      aimComponentId: step.aim ?? null,
      site: step.siteBeside ? { key: 'workers/refunds', label: 'workers/refunds/', anchorId: step.siteBeside } : null,
      // Edits outside the map lower its coverage until the new component is mapped.
      mappedHits: 12,
      unmappedHits: script.key === 'lynx' && t >= 5 && t < MAPPED_AT ? 3 : 0,
      detailComponentId: null,
    };
  });
}
