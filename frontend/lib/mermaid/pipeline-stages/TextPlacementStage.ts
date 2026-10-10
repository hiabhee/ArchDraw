import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { placeTextNodes } from '../textPlacement';
import type { RFObjects } from '../types';

/**
 * Runs after Dagre layout + subgraph sizing. Anchors free-text / annotation
 * nodes against the laid-out graph (`top` / `subgraph` / `node` / `none`).
 */
export class TextPlacementStage extends BaseStage<RFObjects, RFObjects> {
  constructor() {
    super('place-text', {
      description: 'Anchor free-text / annotation nodes after layout',
      weight: 1,
    });
  }

  async execute(input: RFObjects, _context: PipelineContext): Promise<StageResult<RFObjects>> {
    const placed = placeTextNodes(input.nodes);
    return successResult({ nodes: placed, edges: input.edges });
  }
}
