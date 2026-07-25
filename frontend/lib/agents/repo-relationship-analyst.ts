import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { inferRelationshipsHeuristic } from './repo-heuristic-extractor';
import { JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import type { RepoSnapshot, RepoProfile, DependencyMap, ExtractedNode } from '@/lib/types/repo-diagram';
import type { RichEdge } from '@/lib/types/repo-diagram';

function compactNodesForRel(nodes: ExtractedNode[]): string {
  return JSON.stringify(nodes.map(n => ({
    id: n.id,
    label: n.label,
    type: n.type,
    desc: n.description?.slice(0, 120) || '',
  })));
}

function compactSummaries(summaries: string[]): string {
  return summaries.map(s => s.split('\n').slice(0, 2).join('\n')).join('\n');
}

function trimDetectionReport(report: string, maxLines = 25): string {
  return report
    .split('\n')
    .filter(l => l.trim() && !l.match(/^[-=]{3,}$/))
    .slice(0, maxLines)
    .join('\n');
}

function buildWorkflowExamples(profile: RepoProfile | undefined, detectionReport: string): string {
  if (!profile || !profile.applicationDomain) return '';

  const domain = profile.applicationDomain.toLowerCase();
  const capabilities = (profile.coreCapabilities || []).map((c) => c.toLowerCase());

  const suggestions: string[] = [];

  if (domain.includes('expense') || domain.includes('reimburs') || domain.includes('finance') || capabilities.some((c) => c.includes('expense') || c.includes('reimburs') || c.includes('payment') || c.includes('invoice'))) {
    suggestions.push('Expense Submission: Employee submits expense via form → API validates → service processes → database persists → notification sent');
    suggestions.push('Approval Workflow: Manager reviews pending expenses → approves/rejects → system updates record → notifies employee');
  }

  if (domain.includes('ecommerce') || domain.includes('shop') || domain.includes('store') || domain.includes('payment') || capabilities.some((c) => c.includes('product') || c.includes('cart') || c.includes('checkout') || c.includes('order'))) {
    suggestions.push('Product Browsing: User browses catalog → views product details → adds to cart');
    suggestions.push('Checkout: User checks out → order service processes → payment gateway charges → inventory updated → confirmation sent');
  }

  if (domain.includes('chat') || domain.includes('message') || domain.includes('communi') || capabilities.some((c) => c.includes('message') || c.includes('chat'))) {
    suggestions.push('Send Message: User sends message → API validates → service delivers → database stores → recipient notified');
  }

  if (domain.includes('auth') || domain.includes('login') || domain.includes('signup') || capabilities.some((c) => c.includes('auth') || c.includes('login') || c.includes('regist'))) {
    suggestions.push('User Registration: User signs up → auth service validates → profile created → welcome email sent');
    suggestions.push('Authentication: User logs in → credentials validated → session/token issued → protected resources accessible');
  }

  if (domain.includes('dashboard') || domain.includes('analytics') || domain.includes('report') || capabilities.some((c) => c.includes('dashboard') || c.includes('report') || c.includes('analytics'))) {
    suggestions.push('View Dashboard: User opens dashboard → API fetches data → service aggregates → database queried → rendered');
  }

  if (domain.includes('blog') || domain.includes('content') || domain.includes('cms') || capabilities.some((c) => c.includes('content') || c.includes('blog') || c.includes('post'))) {
    suggestions.push('Publish Content: Author creates post → saves draft → editor reviews → published → cache invalidated → visitors see update');
  }

  if (suggestions.length === 0) {
    suggestions.push('Primary action: User interacts with UI → API handles request → service processes → data persisted → response returned');
    if (capabilities.length > 0) {
      suggestions.push(`Domain-specific: ${capabilities.slice(0, 3).join(' → services → ')} → database`);
    }
  }

  return suggestions.slice(0, 3).join('\n');
}

export async function analyzeRelationships(
  snapshot: RepoSnapshot,
  nodes: ExtractedNode[],
  repoProfile?: RepoProfile,
  dependencyMap?: DependencyMap,
  summaries?: string[],
  staticDetectionReport?: string
): Promise<{ edges: RichEdge[]; workflows: { name: string; description: string; steps: string[] }[] }> {
  const nodesCompact = compactNodesForRel(nodes);
  const summariesCompact = summaries && summaries.length > 0 ? compactSummaries(summaries) : '';
  const profileCompact = repoProfile ? JSON.stringify({
    repoType: repoProfile.repoType,
    pattern: repoProfile.architecturePattern,
    domain: repoProfile.applicationDomain || undefined,
    capabilities: repoProfile.coreCapabilities.length > 0 ? repoProfile.coreCapabilities : undefined,
    flows: repoProfile.primaryUserFlows.length > 0 ? repoProfile.primaryUserFlows : undefined,
  }) : '';

  const workflowExamples = buildWorkflowExamples(repoProfile, staticDetectionReport || '');

  const prompt = `You are tracing user journeys through this application. Your goal is to produce a diagram that tells the story of how the system works — not just a component listing.

COMPONENTS (use exactly these IDs):
${nodesCompact}

APPLICATION PROFILE:
${profileCompact || 'Not classified'}

${summariesCompact ? `STRUCTURAL OVERVIEW:\n${summariesCompact}\n` : ''}
${staticDetectionReport ? `STATIC DETECTION:\n${trimDetectionReport(staticDetectionReport)}\n` : ''}
${dependencyMap?.dependencies?.length ? `EXTERNAL DEPS:\n${JSON.stringify(dependencyMap.dependencies.map(d => ({ name: d.name, category: d.category })))}\n` : ''}

TASK 1 — IDENTIFY 3 PRIMARY USER JOURNEYS:
Think about what this application does. What are the 3 most important end-to-end flows a developer should understand first?
For each workflow provide:
- name: short human-readable name (e.g. "Expense Submission")
- description: what happens end-to-end (1-2 sentences)
- steps: ordered array of node IDs (or role labels like "Employee", "Manager" for actors not in the component list)
- Each step should tell the story: the path a user action traces through the system

Example workflows for this domain (use as inspiration, not literal):
${workflowExamples || 'Identify 3 realistic user journeys based on the application domain and components above.'}

TASK 2 — MAP SEMANTIC EDGES:
For each workflow, create edges that tell the story. Use labels that describe WHAT action is happening:
- "submits expense" not "calls"
- "validates credentials" not "auth"  
- "stores record" not "queries"
- "notifies manager" not "external_call"
- "processes payment" not "sdk_call"

Each edge must connect two components from the COMPONENTS list (not actor labels).

${JSON_OUTPUT_REMINDER}
Required output shape:
{
  "workflows": [
    {
      "name": "Expense Submission",
      "description": "Employee submits an expense report which is validated, stored, and triggers a manager notification.",
      "steps": ["Employee", "next_js_app", "expense_api", "middleware", "next_auth", "expense_service", "prisma", "database", "notification_service"]
    }
  ],
  "edges": [
    {
      "from": "component_id",
      "to": "component_id",
      "type": "http_call|db_query|auth_check|external_call|guards|publishes|subscribes",
      "label": "submits expense report",
      "direction": "sync|async|event",
      "protocol": "http|websocket|db|sdk|import|queue",
      "dataFlow": "expense data with receipt attachments",
      "triggeredBy": "user_action|server_event|scheduled|webhook",
      "description": "User-submitted expense data flows through the API to the validation service.",
      "confidence": "high|medium|low"
    }
  ]
}`;

  console.log(`[RelationshipAnalyst] Calling LLM (${nodes.length} nodes, ~${Math.ceil(prompt.length / 4)} est tokens)...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert software architect who excels at explaining how applications work through workflow-first diagrams.

Your job is NOT to list components — the component detection is already done. Your job is to tell the story of how the application works by:

1. Identifying the 3 most important end-to-end user journeys (workflows)
2. Mapping semantic edges between components that trace those journeys
3. Using descriptive edge labels that explain WHAT is happening (not just technical protocol)

Edge types: http_call, db_query, auth_check, external_call, guards, publishes, subscribes.
Edge labels should be SHORT (2-5 words) and DESCRIPTIVE of the action: "submits form", "validates auth", "stores data", "notifies user" — NOT generic like "calls" or "depends on".

Up to 3 workflows. Each workflow should have 3-10 steps. Steps can include actor names (e.g. "Employee", "Manager", "Admin") that aren't in the component list to show who initiates the flow.

RULES:
- Only use node IDs from the provided component list for edge connections
- Workflow steps can include actor labels not in the component list
- Max 30 edges total across all workflows
- At least 1 workflow if the project has user-facing functionality
- Make edge labels tell the story — prefer "submits reimbursement" over "calls api"`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 5000,
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
