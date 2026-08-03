/**
 * Mermaid layout — thin adapter over the canonical pipeline-shared layout engine.
 * Do not reintroduce a local Dagre implementation here.
 */
import { applyRfLayout } from '@/lib/pipeline-shared/layout/IntegratedLayout';
import type { RFObjects, Direction } from './types';

export function applyLayout(objects: RFObjects, direction: Direction): RFObjects {
  return applyRfLayout(
    objects as unknown as Parameters<typeof applyRfLayout>[0],
    direction
  ) as unknown as RFObjects;
}
