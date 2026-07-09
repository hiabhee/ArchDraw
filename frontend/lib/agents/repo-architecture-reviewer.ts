import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { buildArchitectureReviewPrompt } from './repo-prompt-utils';
import type {
  ExtractedNode,
  RichEdge,
  RepoProfile,
  DependencyIntelligence,
  ReviewResult,
} from '@/lib/types/repo-diagram';

const REVIEW_SYSTEM_PROMPT = `You are a senior software architect reviewing an auto-generated architecture diagram.

Find clear errors only (not style preferences):
- Missing nodes for critical dependencies or dangling edge endpoints
- Duplicate nodes that should merge
- Misclassified node/edge types
- Orphan nodes that should be connected
- Broken workflows

Also evaluate whether the diagram represents the application's architecture, not just its technology list:
- If external service nodes outnumber internal component nodes, flag this — the diagram should be dominated by application components
- If there is no workflow that traces a complete user journey through the system, flag this as a missing workflow
- If a critical application component (e.g., the main API, the primary data store, the auth system) is missing, flag it

Return ONLY JSON:
{
  "approved": true|false,
  "corrections": {
    "addNodes": [],
    "removeNodeIds": [],
    "mergeNodes": [{ "keepId": "", "removeId": "", "newLabel": "" }],
    "addEdges": [],
    "removeEdgeIndexes": [],
    "updateEdges": [{ "index": 0, "changes": {} }],
    "workflowCorrections": []
  },
  "reviewNotes": "brief summary"
}

If the diagram is acceptable, set approved:true with empty correction arrays.`;

export async function reviewArchitecture(
  nodes: ExtractedNode[],
  edges: RichEdge[],
  workflows: { name: string; description: string; steps: string[] }[],
  repoProfile: RepoProfile,
  dependencyMap: DependencyIntelligence[]
): Promise<ReviewResult> {
  const prompt = buildArchitectureReviewPrompt(nodes, edges, workflows, repoProfile, dependencyMap);

  console.log(`[ArchitectureReviewer] Calling LLM (${nodes.length} nodes, ${edges.length} edges, ~${Math.ceil(prompt.length / 4)} est. tokens)...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      })
    );

    const parsed = parseLlmJson<{
      approved?: boolean;
      reviewNotes?: string;
      corrections?: ReviewResult['corrections'];
    }>(result, 'ArchitectureReviewer');

    const corrections = parsed.corrections;

    return {
      approved: parsed.approved ?? true,
      corrections: {
        addNodes: Array.isArray(corrections?.addNodes) ? corrections.addNodes : [],
        removeNodeIds: Array.isArray(corrections?.removeNodeIds) ? corrections.removeNodeIds : [],
        mergeNodes: Array.isArray(corrections?.mergeNodes) ? corrections.mergeNodes : [],
        addEdges: Array.isArray(corrections?.addEdges) ? corrections.addEdges : [],
        removeEdgeIndexes: Array.isArray(corrections?.removeEdgeIndexes) ? corrections.removeEdgeIndexes : [],
        updateEdges: Array.isArray(corrections?.updateEdges) ? corrections.updateEdges : [],
        workflowCorrections: Array.isArray(corrections?.workflowCorrections) ? corrections.workflowCorrections : [],
      },
      reviewNotes: parsed.reviewNotes || 'Review completed.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTokenLimit = message.includes('413') || message.includes('too large') || message.includes('rate_limit');
    console.error('[ArchitectureReviewer] Failed to review architecture:', err);
    return {
      approved: true,
      corrections: {
        addNodes: [],
        removeNodeIds: [],
        mergeNodes: [],
        addEdges: [],
        removeEdgeIndexes: [],
        updateEdges: [],
        workflowCorrections: [],
      },
      reviewNotes: isTokenLimit
        ? 'Architecture review skipped — diagram too large for the review model token limit.'
        : 'Review agent failed — automatically approved.',
    };
  }
}
