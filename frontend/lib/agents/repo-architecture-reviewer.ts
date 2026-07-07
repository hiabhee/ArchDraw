import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import type {
  ExtractedNode,
  RichEdge,
  RepoProfile,
  DependencyIntelligence,
  ReviewResult,
} from '@/lib/types/repo-diagram';

export async function reviewArchitecture(
  nodes: ExtractedNode[],
  edges: RichEdge[],
  workflows: { name: string; description: string; steps: string[] }[],
  repoProfile: RepoProfile,
  dependencyMap: DependencyIntelligence[]
): Promise<ReviewResult> {
  const nodesText = JSON.stringify(nodes, null, 2);
  const edgesText = JSON.stringify(edges, null, 2);
  const workflowsText = JSON.stringify(workflows, null, 2);
  const profileText = JSON.stringify(repoProfile, null, 2);
  const depMapText = JSON.stringify(dependencyMap, null, 2);

  const prompt = `Review this extracted architecture.

NODES:
${nodesText}

EDGES:
${edgesText}

WORKFLOWS:
${workflowsText}

REPO PROFILE:
${profileText}

DEPENDENCY MAP:
${depMapText}

${JSON_OUTPUT_REMINDER}`;

  console.log(`[ArchitectureReviewer] Calling LLM to review extracted architecture...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a senior software architect doing a quality review of an 
automatically extracted architecture diagram.

You will receive:
1. A list of nodes
2. A list of edges  
3. The original RepoProfile and DependencyMap
4. Key workflows identified

Your job is to find errors and produce a correction diff.

CHECK FOR:

MISSING NODES:
- Are there dependencies in the DependencyMap that should be nodes but aren't?
- Are there edges pointing to node ids that don't exist?
- Are there services implied by .env variables that aren't represented?

DUPLICATE NODES:
- Are there two nodes that represent the same thing?
- Should any nodes be merged?

WRONG NODE TYPES:
- Are any nodes misclassified?

MISSING EDGES:
- Are there nodes that are clearly related but have no connection?
- Does every external service node have at least one incoming edge?
- Does every database node have at least one incoming edge?
- Are there orphan nodes (no edges at all) that should be connected?

WRONG EDGE TYPES:
- Are any relationships misclassified? 
  (e.g. marked http_call but should be sdk_call)

WORKFLOW GAPS:
- Do the identified workflows make sense end-to-end?
- Are there steps missing in the middle of a workflow?

OUTPUT FORMAT — respond only with valid JSON, no markdown, no explanation:

{
  "approved": true | false,
  "corrections": {
    "addNodes": [...node objects to add],
    "removeNodeIds": ["ids to remove"],
    "mergeNodes": [{ "keepId": "string", "removeId": "string", "newLabel": "string" }],
    "addEdges": [...edge objects to add],
    "removeEdgeIndexes": [0, 2],
    "updateEdges": [{ "index": 0, "changes": { "type": "corrected_type" } }],
    "workflowCorrections": ["string descriptions of workflow issues found"]
  },
  "reviewNotes": "two to three sentences summarizing what was found and corrected"
}

If everything looks correct, set approved: true and corrections with empty arrays.
Be conservative — only flag clear errors, not stylistic preferences.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 8000,
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
    console.error('[ArchitectureReviewer] Failed to review architecture:', err);
    // If review fails, default to approved to avoid blocking
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
      reviewNotes: 'Review agent failed — automatically approved.',
    };
  }
}
