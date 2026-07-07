import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { inferRelationshipsHeuristic } from './repo-heuristic-extractor';
import { formatSourceFilesForPrompt, JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import type { RepoSnapshot, RepoProfile, DependencyMap, ExtractedNode } from '@/lib/types/repo-diagram';
import type { RichEdge } from '@/lib/types/repo-diagram';

export async function analyzeRelationships(
  snapshot: RepoSnapshot,
  nodes: ExtractedNode[],
  repoProfile?: RepoProfile,
  dependencyMap?: DependencyMap,
  summaries?: string[]
): Promise<{ edges: RichEdge[]; workflows: { name: string; description: string; steps: string[] }[] }> {
  const nodesText = JSON.stringify(nodes, null, 2);

  const selectedFileContentsText = formatSourceFilesForPrompt(snapshot.selectedFiles);
  const profileText = repoProfile ? JSON.stringify(repoProfile, null, 2) : '';
  const depMapText = dependencyMap ? JSON.stringify(dependencyMap, null, 2) : '';
  const summariesBlock = summaries && summaries.length > 0
    ? `SUBSYSTEM SUMMARIES:\n${summaries.join('\n\n')}`
    : `SOURCE FILES (reference only — do not repeat in your answer):\n${selectedFileContentsText}`;

  const prompt = `Map relationships between these nodes.

NODES:
${nodesText}

${summariesBlock}
${repoProfile ? `\nREPO PROFILE:\n${profileText}` : ''}
${dependencyMap ? `\nDEPENDENCY MAP:\n${depMapText}` : ''}

${JSON_OUTPUT_REMINDER}
Required shape: { "edges": [ ... ], "workflows": [ ... ] }`;

  console.log(`[RelationshipAnalyst] Calling LLM to analyze relationships...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert software architect. You analyze codebases to understand
not just what connects to what, but WHY and HOW components communicate —
the full request lifecycle and data flow.

You will receive:
1. A list of architectural nodes already identified
2. Selected source files
3. A DependencyMap showing how external services are used
4. A RepoProfile classifying the project type

Your job is to identify RELATIONSHIPS and reconstruct KEY WORKFLOWS.

RELATIONSHIP TYPES:
- http_call: synchronous HTTP request between components
- db_query: database read or write operation
- auth_check: authentication or authorization verification
- external_call: call to a third-party service
- guards: middleware protecting a route or component
- publishes: sends a message or event
- subscribes: listens for a message or event
- imports: module dependency (use sparingly — only for architecturally significant imports)
- sdk_call: uses a third-party SDK (Stripe, Supabase, etc.)
- websocket: realtime connection
- cron: scheduled/background job trigger

For each edge produce:
- from: node id
- to: node id  
- type: from the list above
- label: short human readable label (max 5 words)
- direction: "sync" | "async" | "event"
- protocol: "http" | "websocket" | "db" | "sdk" | "import" | "queue" | "cron"
- dataFlow: what data passes through this connection (e.g. "userId, sessionToken")
- triggeredBy: "user_action" | "server_event" | "scheduled" | "webhook" | "system"
- description: one full sentence explaining why this connection exists

WORKFLOW RECONSTRUCTION:
After identifying all edges, identify up to 3 KEY WORKFLOWS in this project.
A workflow is a sequence of connected edges that represents a meaningful
user or system action end-to-end.

Examples:
- "User Authentication Flow": LoginPage → AuthAPI → SupabaseAuth → Dashboard
- "Payment Flow": CheckoutPage → OrderAPI → StripePayments → OrderDB → EmailService
- "Data Sync Flow": WebhookHandler → QueueService → ProcessorService → Database

OUTPUT FORMAT — respond only with valid JSON, no markdown, no explanation:

{
  "edges": [
    {
      "from": "node_id",
      "to": "node_id",
      "type": "string",
      "label": "string",
      "direction": "sync | async | event",
      "protocol": "string",
      "dataFlow": "string",
      "triggeredBy": "string",
      "description": "string",
      "confidence": "high | medium | low"
    }
  ],
  "workflows": [
    {
      "name": "string",
      "description": "string",
      "steps": ["node_id_1", "node_id_2", "node_id_3"]
    }
  ]
}

RULES:
- Only use node ids from the provided list
- Only include edges with direct evidence in source files
- Mark edges as medium/low confidence if inferred rather than directly seen
- Maximum 40 edges
- Capture at least 1 workflow if the project has any user-facing functionality`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 6000,
      })
    );

    try {
      const parsed = parseLlmJson<{
        edges?: RichEdge[];
        workflows?: { name: string; description: string; steps: string[] }[];
      }>(result, 'RelationshipAnalyst');

      const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
      const workflows = Array.isArray(parsed.workflows) ? parsed.workflows : [];

      if (edges.length > 0 || nodes.length < 2) {
        return { edges, workflows };
      }
    } catch (parseErr) {
      console.warn(
        '[RelationshipAnalyst] JSON parse failed:',
        parseErr instanceof Error ? parseErr.message : parseErr
      );
    }

    console.warn('[RelationshipAnalyst] Using heuristic relationship fallback');
    return inferRelationshipsHeuristic(nodes);
  } catch (err) {
    console.error('[RelationshipAnalyst] LLM call failed:', err);
    if (nodes.length >= 2) {
      return inferRelationshipsHeuristic(nodes);
    }
    throw new Error(`Failed to analyze relationships: ${err instanceof Error ? err.message : String(err)}`);
  }
}
