import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { scoreDiagram } from '../../scoreDiagram';
import type { RFNode, RFEdge } from '@/lib/mermaid/types';
import type { Node as RFNodeType, Edge as RFEdgeType } from 'reactflow';
import type { ArchitectureStyle } from '../../types';
import type { DiagramScore } from '../../types';
import type { GeometrySummary } from '@/lib/mermaid/pipeline';

export interface ScoreInput {
  nodes: RFNode[];
  edges: RFEdge[];
  diagramSize: 'small' | 'medium' | 'large';
  detailLevel: 1 | 2 | 3;
  styleTheme: string;
  prompt: string;
  parseWarnings?: string[];
  geometrySummary?: GeometrySummary;
  nodesRemoved?: number;
  edgesRemoved?: number;
  groupsRemoved?: number;
  stylePlan: {
    style: ArchitectureStyle;
    strictness: 'explicit' | 'inferred';
    productionDepth: 'conceptual' | 'application' | 'production';
  };
}

export interface ScoreOutput {
  diagramScore: DiagramScore;
  score: number;
  geometryStatus: 'ok' | 'degraded' | 'invalid' | 'failed' | 'unverified';
  geometrySummary?: GeometrySummary;
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
        nodesRemoved: input.nodesRemoved ?? 0,
        edgesRemoved: input.edgesRemoved ?? 0,
        groupsRemoved: input.groupsRemoved ?? 0,
        diagramSize: input.diagramSize,
        detailLevel: input.detailLevel,
        stylePlan: input.stylePlan,
        prompt: input.prompt,
      }
    );

    const geometryWarning = (input.parseWarnings ?? []).find(warning => /^\[GEOMETRY_(INVALID|FAILED|DEGRADED)\]/.test(warning));
    const geometryStatus = input.geometrySummary?.status === 'failed' || geometryWarning?.startsWith('[GEOMETRY_FAILED]') ? 'failed'
      : input.geometrySummary?.status === 'invalid' || geometryWarning?.startsWith('[GEOMETRY_INVALID]') ? 'invalid'
        : input.geometrySummary?.status === 'degraded' || geometryWarning?.startsWith('[GEOMETRY_DEGRADED]') ? 'degraded'
          : input.geometrySummary?.status === 'ok' ? 'ok' : 'unverified';
    return successResult({
      diagramScore: diagramScore as unknown as DiagramScore,
      score: diagramScore.score,
      geometryStatus,
      geometrySummary: input.geometrySummary,
    });
  }
}
