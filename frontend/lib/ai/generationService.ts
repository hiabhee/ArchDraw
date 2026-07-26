import type { Node, Edge } from 'reactflow';
import type { GenerationProgress } from '@/lib/ai/types';
import { parseAndValidateRepoDiagram } from '@/lib/utils/importRepoDiagram';
import { parseGitHubUrl } from '@/lib/utils/githubUrl';

export interface AIGenerationOptions {
  description: string;
  detailLevel: 1 | 2 | 3;
  model?: string;
  signal?: AbortSignal;
}

export interface AIGenerationResult {
  data: {
    nodes?: unknown[];
    edges?: unknown[];
    type?: string;
    metadata?: Record<string, unknown>;
  };
  progress?: GenerationProgress[];
}

export type GenerationErrorCode = 'generation_failed' | 'repo_ingest_failed' | 'validation_failed' | 'aborted';

export class GenerationServiceError extends Error {
  constructor(
    message: string,
    public readonly code: GenerationErrorCode = 'generation_failed',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'GenerationServiceError';
  }
}

/**
 * Generate a diagram from a natural-language prompt by calling the backend API.
 *
 * Extracted from views/Editor.tsx:298-460 so the component only handles UI side
 * effects (progress display, toast, analytics) while the network/data logic
 * lives here.
 */
export async function generateDiagramFromPrompt(
  options: AIGenerationOptions,
  onProgress?: (progress: GenerationProgress) => void,
): Promise<AIGenerationResult> {
  const { description, detailLevel, model } = options;
  const diagramSize = detailLevel === 1 ? 'small' : detailLevel === 2 ? 'medium' : 'large';

  const payload: {
    description: string;
    diagramSize?: 'small' | 'medium' | 'large';
    detailLevel?: 1 | 2 | 3;
    model?: string;
    stream: boolean;
  } = { description, diagramSize, detailLevel, model, stream: true };

  const response = await fetch('/api/generate-diagram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok) {
    let errorData: { details?: string; error?: string };
    try {
      errorData = await response.json();
    } catch {
      errorData = {};
    }
    throw new GenerationServiceError(
      errorData.details || errorData.error || 'Generation failed',
      'generation_failed',
      { status: response.status },
    );
  }

  const responseData = await response.json();

  if (responseData.progress?.length > 0) {
    const lastProgress = responseData.progress[responseData.progress.length - 1];
    onProgress?.(lastProgress);
  }

  return responseData;
}

/**
 * Ingest a GitHub repository and produce a diagram.
 *
 * This was previously inlined in Editor.tsx alongside the standard AI generation
 * path, despite being an entirely different pipeline. Kept as a separate
 * function here to clarify the boundary.
 */
export async function generateDiagramFromRepo(
  repoUrl: string,
  detailLevel: 1 | 2 | 3,
  onProgress?: (progress: GenerationProgress) => void,
): Promise<{ nodes: Node[]; edges: Edge[]; nodeCount: number; edgeCount: number }> {
  onProgress?.({
    phase: 'generating',
    iteration: 0,
    currentAgent: 'repo-ingest',
    score: 0,
    message: 'Analyzing GitHub repository...',
    progress: 10,
  });

  const response = await fetch('/api/repo-diagram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl: repoUrl.trim(), detailLevel }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new GenerationServiceError(
      data.error || 'Repo ingest failed',
      'repo_ingest_failed',
    );
  }

  const parsed = parseAndValidateRepoDiagram(data.ndjson);
  if (!parsed) {
    throw new GenerationServiceError(
      'No architectural components could be detected in this repository.',
      'validation_failed',
    );
  }

  return {
    nodes: parsed.nodes as Node[],
    edges: parsed.edges as Edge[],
    nodeCount: parsed.nodeCount,
    edgeCount: parsed.edgeCount,
  };
}

/**
 * Merge a freshly generated diagram into an existing canvas.
 *
 * When the user already has a diagram and requests a new one, this offsets the
 * new diagram to the right so both remain visible. Extracted from the Editor's
 * handleGenerationComplete so the merging logic is unit-testable and shared.
 *
 * Returns the final set of nodes + edges and the *separate* offset nodes array
 * (or null if there was no existing canvas) — callers may need both.
 */
export function mergeGeneratedNodes(
  existingNodes: Node[],
  existingEdges: Edge[],
  generatedNodes: Node[],
  generatedEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  if (existingNodes.length === 0) {
    return { nodes: generatedNodes, edges: generatedEdges };
  }

  const maxX = Math.max(
    ...existingNodes.map((n) => n.position.x + (n.width ?? 200)),
    0,
  );
  const offsetX = maxX + 250;

  const offsetNodes = generatedNodes.map((n) => ({
    ...n,
    position: { x: n.position.x + offsetX, y: n.position.y },
  }));

  return {
    nodes: [...existingNodes, ...offsetNodes],
    edges: [...existingEdges, ...generatedEdges],
  };
}

export function inferDiagramDirection(result: AIGenerationResult['data']): 'layered-lr' | 'layered-tb' | null {
  const diagramType = result.metadata?.diagramType as string | undefined;
  if (diagramType === 'graph LR') return 'layered-lr';
  if (diagramType === 'graph TD') return 'layered-tb';
  return null;
}

export function extractRepoName(repoUrl: string): string {
  const parsed = parseGitHubUrl(repoUrl);
  if (parsed) return parsed.repo;
  const cleanUrl = repoUrl.trim().replace(/\/+$/, '');
  const parts = cleanUrl.split('/');
  return parts[parts.length - 1] || 'Repository';
}
