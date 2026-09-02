import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { inferRelationshipsHeuristic } from './repo-heuristic-extractor';
import { JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import { REPO_LLM_MODEL, RELATIONSHIP_MAX_TOKENS } from '@/lib/ai/utils/repoModels';
import logger from '@/lib/logger';
import type { RepoSnapshot, RepoProfile, DependencyMap, ExtractedNode } from '@/lib/types/repo-diagram';
import type { RichEdge, StaticSignal } from '@/lib/types/repo-diagram';
import { topAdjacencies } from '@/lib/repo-diagram/evidence-from-graph';
import type { ImportGraph } from '@/lib/repo-diagram/import-graph';

const MAX_EDGES_BY_LEVEL: Record<number, number> = { 1: 30, 2: 60, 3: 100 };

function compactNodesForRel(nodes: ExtractedNode[]): string {
  return JSON.stringify(nodes.map(n => ({
    id: n.id,
    label: n.label,
    type: n.type,
    desc: n.description?.slice(0, 200) || '',
    sourceFiles: n.sourceFiles.slice(0, 5),
  })));
}

function compactSummaries(summaries: string[]): string {
  return summaries.map(s => s.split('\n').slice(0, 4).join('\n')).join('\n');
}

function trimDetectionReport(report: string, maxLines = 25): string {
  return report
    .split('\n')
    .filter(l => l.trim() && !l.match(/^[-=]{3,}$/))
    .slice(0, maxLines)
    .join('\n');
}

/**
 * Phase 6.2 — Build a compact evidence pack for the relationship analyst.
 *
 * - Top 120 import-graph adjacencies between node file-sets.
 * - Detected route signals (path → source file), capped at 100.
 * - docker-compose depends_on edges, queue topics, prisma models.
 * - Hard-capped at ~50k chars; truncated deterministically (by weight).
 */
function buildEvidencePack(
  nodes: ExtractedNode[],
  importGraph?: ImportGraph,
  signals: StaticSignal[] = [],
): string {
  const lines: string[] = [];

  // Top import-graph adjacencies.
  if (importGraph) {
    const adj = topAdjacencies(nodes, importGraph, 120);
    if (adj.length > 0) {
      lines.push('IMPORT GRAPH EVIDENCE (highest-weight file-level links):');
      for (const a of adj) {
        lines.push(`  ${a.fromLabel} → ${a.toLabel} (${a.weight} import${a.weight === 1 ? '' : 's'})`);
      }
    }
  }

  // Route signals.
  const routeSigs = signals.filter((s) => s.type === 'route').slice(0, 100);
  if (routeSigs.length > 0) {
    lines.push('\nDETECTED ROUTES:');
    for (const r of routeSigs) lines.push(`  ${r.label}  ←  ${r.source}`);
  }

  // Compose_dependency edges.
  const composeDeps = signals.filter((s) => s.type === 'compose_dependency');
  if (composeDeps.length > 0) {
    lines.push('\nDOCKER-COMPOSE DEPENDENCIES:');
    for (const d of composeDeps) {
      const det = d.details as { from?: string; to?: string };
      lines.push(`  ${det.from || '?'} → ${d.label}`);
    }
  }

  // Queue topics + prisma models — quick architecture hints.
  const queues = signals.filter((s) => s.type === 'queue_topic').slice(0, 20);
  if (queues.length > 0) {
    lines.push('\nQUEUES/TOPICS:');
    for (const q of queues) lines.push(`  ${q.label}`);
  }
  const schemas = signals.filter((s) => s.type === 'schema' && (s.details as { orm?: string }).orm === 'prisma').slice(0, 20);
  if (schemas.length > 0) {
    lines.push('\nPRISMA MODELS:');
    for (const s of schemas) lines.push(`  ${s.label}`);
  }

  const out = lines.join('\n');
  // Hard cap ~12k tokens (~50k chars) — sized for gpt-oss-120b's context window
  // (the old 20k-char cap was sized for the retired llama-3.3-70b 12K TPM
  // ceiling). Deterministic — we already rank by weight upstream.
  return out.length > 50_000 ? out.slice(0, 50_000) + '\n…[truncated]' : out;
}

export async function analyzeRelationships(
  snapshot: RepoSnapshot,
  nodes: ExtractedNode[],
  repoProfile?: RepoProfile,
  dependencyMap?: DependencyMap,
  summaries?: string[],
  staticDetectionReport?: string,
  evidence?: { importGraph?: ImportGraph; signals?: StaticSignal[] },
  opts?: { detailLevel?: 1 | 2 | 3 }
): Promise<{ edges: RichEdge[]; workflows: { name: string; description: string; steps: string[] }[] }> {
  const detail = opts?.detailLevel ?? 2;
  const maxEdges = MAX_EDGES_BY_LEVEL[detail] ?? 60;
  const nodesCompact = compactNodesForRel(nodes);
  const summariesCompact = summaries && summaries.length > 0 ? compactSummaries(summaries) : '';
  const profileCompact = repoProfile ? JSON.stringify({
    repoType: repoProfile.repoType,
    pattern: repoProfile.architecturePattern,
    domain: repoProfile.applicationDomain || undefined,
    capabilities: repoProfile.coreCapabilities.length > 0 ? repoProfile.coreCapabilities : undefined,
    flows: repoProfile.primaryUserFlows.length > 0 ? repoProfile.primaryUserFlows : undefined,
  }) : '';
  const readmeFiles = snapshot.selectedFiles.filter((f) => /README\.md$/i.test(f.path));
  const readmeSlice = readmeFiles.length
    ? readmeFiles.map((f) => f.content.slice(0, 8000)).join('\n\n').slice(0, 10000)
    : '';

  // Phase 6.2 — evidence pack replaces injected workflow examples.
  const evidencePack = buildEvidencePack(nodes, evidence?.importGraph, evidence?.signals ?? []);

  const prompt = `You are tracing user journeys through this application. Your goal is to produce a diagram that tells the story of how the system works — not just a component listing.

COMPONENTS (use exactly these IDs):
${nodesCompact}

APPLICATION PROFILE:
${profileCompact || 'Not classified'}

 ${readmeSlice ? `README CONTEXT (primary — derive workflows from features described here, not generic e-commerce):\n${readmeSlice}\n` : ''}
${summariesCompact ? `STRUCTURAL OVERVIEW:\n${summariesCompact}\n` : ''}
${staticDetectionReport ? `STATIC DETECTION:\n${trimDetectionReport(staticDetectionReport)}\n` : ''}
${dependencyMap?.dependencies?.length ? `EXTERNAL DEPS:\n${JSON.stringify(dependencyMap.dependencies.map(d => ({ name: d.name, category: d.category })))}\n` : ''}
${evidencePack ? `EVIDENCE:\n${evidencePack}\n` : '(no direct evidence — derive edges from component names only)'}

TASK 1 — IDENTIFY 3 PRIMARY USER JOURNEYS (README-driven):
Think about what this application does per README + APPLICATION PROFILE. What are the 3 most important end-to-end flows a developer should understand first? Each workflow MUST trace a feature named in README (or a detected route group) — not a generic e-commerce/chat/auth template.
For each workflow provide:
- name: short human-readable name derived from README feature (e.g. "Expense Submission" if README says expense tracker, not "User Login" if README is about expense)
- description: what happens end-to-end (1-2 sentences) referencing actual components and README domain
- steps: ordered array of node IDs (or role labels like "Employee", "Manager" for actors not in the component list)
- Each step should tell the story: the path a user action traces through the system

Derive workflows from README + detected routes + EVIDENCE above — do NOT invent generic e-commerce/chat/auth journeys when the evidence/README doesn't support them. If README lists features, each workflow should map to one feature.

TASK 2 — MAP SEMANTIC EDGES:
For each workflow, create edges that tell the story. Use labels that describe WHAT action is happening:
- "submits expense" not "calls"
- "validates credentials" not "auth"  
- "stores record" not "queries"
- "notifies manager" not "external_call"
- "processes payment" not "sdk_call"

Each edge must connect two components from the COMPONENTS list (not actor labels).

Prefer edges listed in EVIDENCE. You may add edges not in evidence, but mark them confidence 'low'.

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

  logger.log(`[RelationshipAnalyst] Calling LLM (${nodes.length} nodes, ~${Math.ceil(prompt.length / 4)} est tokens)...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: REPO_LLM_MODEL,
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
- Max ${maxEdges} edges total across all workflows
- At least 1 workflow if the project has user-facing functionality
- Prefer edges corroborated by the EVIDENCE block — these have ground-truth source-file or docker-compose support.
- Mark edges NOT in evidence as confidence 'low'.
- Make edge labels tell the story — prefer "submits reimbursement" over "calls api"`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: RELATIONSHIP_MAX_TOKENS,
      })
    );

    try {
      const parsed = parseLlmJson<{
        edges?: RichEdge[];
        workflows?: { name: string; description: string; steps: string[] }[];
      }>(result, 'RelationshipAnalyst');

      let edges = Array.isArray(parsed.edges) ? parsed.edges : [];
      let workflows = Array.isArray(parsed.workflows) ? parsed.workflows : [];
      // Deduplicate workflows by case-insensitive name and steps (LLM sometimes repeats same journey with slight rewording)
      {
        const seen = new Set<string>();
        const uniq: typeof workflows = [];
        for (const w of workflows) {
          const key = (w.name || '').trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          uniq.push(w);
        }
        workflows = uniq.slice(0, 3);
      }
      // Deduplicate edges by from->to->type->label lower
      {
        const seen = new Set<string>();
        const uniq: typeof edges = [];
        for (const e of edges) {
          const key = `${e.from}->${e.to}->${e.type}->${(e.label || '').trim().toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          uniq.push(e);
        }
        edges = uniq;
      }

      if (edges.length > 0 || nodes.length < 2) {
        return { edges, workflows };
      }
    } catch (parseErr) {
      logger.warn(
        '[RelationshipAnalyst] JSON parse failed — retrying with explicit JSON reminder:',
        parseErr instanceof Error ? parseErr.message : parseErr
      );
      // Phase 6.5 — one retry with explicit JSON-only reminder appended and larger max_tokens.
      try {
        const retryResult = await apiKeyManager.executeWithRetry(async (client) =>
          groqJsonCompletion(client, {
            model: REPO_LLM_MODEL,
            messages: [
              { role: 'system', content: `Return ONLY a single JSON object. No markdown fences. No prose. The schema is the same as before:\n{ "workflows": [{ "name": "...", "description": "...", "steps": ["...", "..."] }], "edges": [{ "from": "...", "to": "...", "type": "...", "label": "...", "direction": "...", "protocol": "...", "dataFlow": "...", "triggeredBy": "...", "description": "...", "confidence": "..." }] }` },
              { role: 'user', content: prompt + '\n\nReturn ONLY the JSON object. No prose, no fences.' },
            ],
            temperature: 0.1,
            max_tokens: Math.round(RELATIONSHIP_MAX_TOKENS * 1.5),
          })
        );
        const parsed2 = parseLlmJson<{ edges?: RichEdge[]; workflows?: { name: string; description: string; steps: string[] }[] }>(retryResult, 'RelationshipAnalyst[retry]');
        let edges2 = Array.isArray(parsed2.edges) ? parsed2.edges : [];
        let workflows2 = Array.isArray(parsed2.workflows) ? parsed2.workflows : [];
        {
          const seen = new Set<string>();
          const uniq: typeof workflows2 = [];
          for (const w of workflows2) {
            const k = (w.name || '').trim().toLowerCase();
            if (!k || seen.has(k)) continue;
            seen.add(k);
            uniq.push(w);
          }
          workflows2 = uniq.slice(0, 3);
        }
        {
          const seen = new Set<string>();
          const uniq: typeof edges2 = [];
          for (const e of edges2) {
            const k = `${e.from}->${e.to}->${e.type}->${(e.label || '').trim().toLowerCase()}`;
            if (seen.has(k)) continue;
            seen.add(k);
            uniq.push(e);
          }
          edges2 = uniq;
        }
        if (edges2.length > 0 || nodes.length < 2) return { edges: edges2, workflows: workflows2 };
      } catch (retryErr) {
        logger.warn('[RelationshipAnalyst] retry also failed:', retryErr instanceof Error ? retryErr.message : retryErr);
      }
    }

    logger.warn('[RelationshipAnalyst] Using heuristic relationship fallback');
    return inferRelationshipsHeuristic(nodes);
  } catch (err) {
    logger.error('[RelationshipAnalyst] LLM call failed:', err);
    if (nodes.length >= 2) {
      return inferRelationshipsHeuristic(nodes);
    }
    throw new Error(`Failed to analyze relationships: ${err instanceof Error ? err.message : String(err)}`);
  }
}
