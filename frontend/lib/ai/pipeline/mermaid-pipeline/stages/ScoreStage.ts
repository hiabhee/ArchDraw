import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { scoreDiagram } from '../../scoreDiagram';
import type { RFNode, RFEdge } from '@/lib/mermaid/types';
import type { Node as RFNodeType, Edge as RFEdgeType } from 'reactflow';
import type { ArchitectureStyle } from '../../types';
import type { DiagramScore } from '../../types';

export interface ScoreInput {
  nodes: RFNode[];
  edges: RFEdge[];
  diagramSize: 'small' | 'medium' | 'large';
  detailLevel: 1 | 2 | 3;
  styleTheme: string;
  prompt: string;
  stylePlan: {
    style: ArchitectureStyle;
    strictness: 'explicit' | 'inferred';
    productionDepth: 'conceptual' | 'application' | 'production';
  };
}

export interface ScoreOutput {
  diagramScore: DiagramScore;
  score: number;
}

export class ScoreStage extends BaseStage<ScoreInput, ScoreOutput> {
  constructor() {
    super('scoring', { description: 'Score the generated diagram', weight: 1 });
  }

  async execute(input: ScoreInput, _context: PipelineContext): Promise<StageResult<ScoreOutput>> {
    const diagramScore = scoreDiagram(
      input.nodes as unknown as RFNodeType[],
      input.edges as unknown as RFEdgeType[],
      {
        nodesRemoved: 0,
        edgesRemoved: 0,
        diagramSize: input.diagramSize,
        detailLevel: input.detailLevel,
        stylePlan: input.stylePlan,
        prompt: input.prompt,
      }
    );

    return successResult({
      diagramScore: diagramScore as unknown as DiagramScore,
      score: diagramScore.score,
    });
  }
}
