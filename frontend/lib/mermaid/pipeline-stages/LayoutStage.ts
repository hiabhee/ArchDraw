import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { measureLayoutQuality } from '@/lib/pipeline-shared/layout/layoutQuality';
import { applyRfLayout } from '@/lib/pipeline-shared/layout/IntegratedLayout';
import { applySubgraphBoundsToRf } from '../recomputeSubgraphBounds';
import type { RFObjects, Direction } from '../types';

export interface LayoutStageInput {
  objects: RFObjects;
  direction: Direction;
}

export class LayoutStage extends BaseStage<LayoutStageInput, RFObjects> {
  constructor() {
    super('layout', { description: 'Apply optimized layout to nodes', weight: 2 });
  }

  async execute(input: LayoutStageInput, _context: PipelineContext): Promise<StageResult<RFObjects>> {
    const candidates = [input.objects.nodes, [...input.objects.nodes].reverse()];
    let layouted: RFObjects | undefined;
    let best: ReturnType<typeof measureLayoutQuality> | undefined;
    // Compare two deterministic Dagre orderings in the requested direction.
    // Keep topology, dimensions and groups intact; never delete edges for aesthetics.
    for (const nodes of candidates) {
      const candidate = applyRfLayout(
        { ...input.objects, nodes } as unknown as Parameters<typeof applyRfLayout>[0],
        input.direction,
      ) as unknown as RFObjects;
      // Dagre emits absolute child coordinates. Normalize them through the
      // canonical sizing pass before measuring, otherwise parent offsets are
      // counted twice and grouped candidates receive incorrect scores.
      const normalized = applySubgraphBoundsToRf(candidate.nodes);
      const quality = measureLayoutQuality(normalized, candidate.edges);
      if (!best || quality.penalty < best.penalty || (quality.penalty === best.penalty && quality.area < best.area)) {
        best = quality;
        // Keep Dagre's absolute coordinates for the next sizing stage; the
        // normalized copy is only the coordinate-space-correct scoring view.
        layouted = candidate;
      }
      if (quality.penalty === 0) break;
    }
    // Preserve the original parent-before-child order expected by React Flow.
    const positions = new Map(layouted!.nodes.map(n => [n.id, n]));
    layouted = { nodes: input.objects.nodes.map(n => positions.get(n.id)!), edges: input.objects.edges };

    return successResult(layouted);
  }
}
