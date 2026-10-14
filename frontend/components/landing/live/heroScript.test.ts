import { describe, expect, it } from 'vitest';
import { attentionQueue, mapCoverage } from '@/lib/diagram/projects/liveActivity';
import { LOOP_SECONDS, MAPPED_AT, SCRIPTS, scriptSignature, sessionsAt } from './heroScript';

const change = { added: [{ id: 'refunds', label: 'Refund worker' }], removed: [], renamed: [], at: 0 };
const NOW = 1_800_000_000_000;

describe('landing hero script', () => {
  it('ends every script where it starts, so the loop is seamless', () => {
    for (const s of SCRIPTS) expect(s.steps.at(-1)!.at).toBe(s.steps[0].at ?? s.steps[0].aim);
  });

  it('reports a permission request before a finished turn', () => {
    const queue = attentionQueue(sessionsAt(13, NOW, change), NOW);
    expect(queue.map((q) => [q.session.name, q.reason])).toEqual([['Otter', 'waiting'], ['Fox', 'done']]);
  });

  it('builds new code on a construction site, then on the mapped component', () => {
    const before = sessionsAt(8, NOW, change).find((s) => s.name === 'Lynx')!;
    expect(before.site?.anchorId).toBe('payments');
    expect(mapCoverage(sessionsAt(8, NOW, change))!.percent).toBeLessThan(100);
    const after = sessionsAt(MAPPED_AT + 1, NOW, change).find((s) => s.name === 'Lynx')!;
    expect(after.site).toBeNull();
    expect(after.currentComponentId).toBe('refunds');
    expect(after.lastChange?.added[0].id).toBe('refunds');
  });

  it('changes its signature only when a step changes', () => {
    expect(scriptSignature(1)).toBe(scriptSignature(1.2));
    expect(scriptSignature(6.1)).not.toBe(scriptSignature(5.9));
    expect(scriptSignature(LOOP_SECONDS - 0.01)).toBeTruthy();
  });
});
