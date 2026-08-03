import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { deduplicateNodes, pruneNoisyEdges } from '@/lib/repo-diagram/graph-quality';
import { verifyGraph } from '@/lib/agents/repo-verifier';
import { inferRelationshipsHeuristic } from '@/lib/agents/repo-heuristic-extractor';
import { normalizeId } from './internal-helpers';
import type { RepoEnrichmentState } from './enrichment-types';
import type { RichEdge } from '@/lib/types/repo-diagram';

export class VerifyStage extends BaseStage<RepoEnrichmentState, RepoEnrichmentState> {
  constructor() {
    super('verifying', {
      description: 'Verify graph against evidence and prune noise',
      weight: 1,
    });
  }

  async execute(input: RepoEnrichmentState, _context: PipelineContext): Promise<StageResult<RepoEnrichmentState>> {
    if (!input.useLlm) {
      return successResult(input);
    }

    let workingNodes = input.workingNodes;
    let currentEdges = [...input.edges];
    let currentWorkflows = input.workflows;

    const preVerifierHighEdgeCount = currentEdges.filter(e => e.confidence === 'high').length;
    const verified = verifyGraph({
      nodes: workingNodes,
      edges: currentEdges,
      signals: input.signals,
      fileTree: input.snapshot.fileTree,
      importGraph: input.importGraph,
    });
    workingNodes = verified.nodes;
    currentEdges = [...verified.edges];

    const heuristic = inferRelationshipsHeuristic(workingNodes);
    if (heuristic.edges.length > 0) {
      const edgeKey = (e: RichEdge) => `${normalizeId(e.from)}->${normalizeId(e.to)}->${e.type}`;
      const existingKeys = new Set(currentEdges.map(edgeKey));
      for (const he of heuristic.edges) {
        if (!existingKeys.has(edgeKey(he))) {
          currentEdges = [...currentEdges, { ...he, confidence: 'low' as const }];
        }
      }
      if (heuristic.workflows.length > 0) currentWorkflows = heuristic.workflows;
    }

    const deduped = deduplicateNodes(workingNodes, currentEdges);
    workingNodes = deduped.nodes;
    currentEdges = pruneNoisyEdges(deduped.nodes, deduped.edges);

    return successResult({
      ...input,
      workingNodes,
      edges: currentEdges,
      workflows: currentWorkflows,
      preVerifierHighEdgeCount,
    });
  }
}
