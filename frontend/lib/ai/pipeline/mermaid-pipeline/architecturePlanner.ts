import { apiKeyManager } from '../../utils/apiKeyManager';
import { groqJsonCompletion } from '../../utils/groqJsonCompletion';
import logger from '@/lib/logger';
import type { FormatConfig, StyleConfig, InventoryConfig, EdgeConfig } from './types';
import { themePrimaryColor, themeToNodeTypeStyles, getDiagramTheme } from '@/lib/theme/stylingConstants';

interface PlannerOutput {
  reasoning: string;
  diagramType: 'graph TD' | 'graph LR';
  theme: string;
  mermaidCode: string;
}

const THEMES = ['forest-green', 'slate', 'dark-minimal', 'luxury', 'default'] as const;

/**
 * Render a compact textual inventory of the caller's existing diagram so the
 * planner prompt can describe it to the LLM. Keeps shape loosely typed since
 * the API accepts existingContext as generic JSON (`z.any().optional()`).
 */
function describeExistingContext(ctx: { nodes?: unknown[]; edges?: unknown[] }): string {
  const lines: string[] = [];
  const nodes = (ctx.nodes ?? []) as Array<Record<string, unknown>>;
  const edges = (ctx.edges ?? []) as Array<Record<string, unknown>>;
  if (nodes.length > 0) {
    lines.push('Components:');
    for (const n of nodes) {
      const label = (n.data as Record<string, unknown> | undefined)?.label ?? n.label ?? n.id;
      lines.push(`  - ${String(label ?? n.id ?? 'unknown')}`);
    }
  }
  if (edges.length > 0) {
    lines.push('Connections:');
    for (const e of edges) {
      const label = e.label ?? (e.data as Record<string, unknown> | undefined)?.label;
      const suffix = label ? ` (${String(label)})` : '';
      lines.push(`  - ${String(e.source ?? '?')} -> ${String(e.target ?? '?')}${suffix}`);
    }
  }
  return lines.join('\n');
}

function buildSystemPrompt(): string {
  return `You are an Architecture Planner. Design practical architecture diagrams from user descriptions.

RULES:
1. EDGE LABELS: Max 2 words, verb-object format: "serves pages", "queries users"
2. TOPOLOGY: Clients → LB/Gateway → Services → DB/cache/queue. No reverse flows
3. FLOWS: Show full request/response cycle. Return path = chain reversed
4. SUBGRAPHS: Every node in a tier (Client, Gateway, Service, Data Layer)
5. SHAPES: DB=cylinder, Gateway=diamond, Queue=circle, Client=rounded rect, Service=rect
6. PATTERNS: LBs for HTTP only. Caches for read-heavy DBs. Only implied infrastructure
7. CONCEPT PROMPTS: Show internal components, group by responsibility, prefer graph LR
8. SEMANTICS: Show how system WORKS, not just tech list. Async flows in labels

REASONING (step-by-step):
Step 0: Classify (explicit vs open-ended vs mixed)
Step 1: List components and purposes
Step 2: Identify workflow
Step 3: Trace forward path
Step 4: Trace return path
Step 5: Check completeness
Step 6: Verify edge labels (≤2 words)
Step 7: Assign shapes and subgraphs

EXAMPLES:

1) Explicit architecture:
Prompt: "Web app login with LB, auth server, Postgres DB"
Output: {"reasoning":"Explicit architecture. Browser→LB→Auth→DB. Login flow. Complete. Labels concise. Standard shapes.","diagramType":"graph LR","theme":"slate","mermaidCode":"graph LR\\n  subgraph Client\\n    browser[\"Browser\"]\\n  end\\n  subgraph Gateway\\n    lb{\"Load Balancer\"}\\n  end\\n  subgraph Service\\n    auth[\"Auth Server\"]\\n  end\\n  subgraph Data\\n    db[(\"Postgres\")]\\n  end\\n  browser-->|routes| lb\\n  lb-->|authenticates| auth\\n  auth-->|queries| db\\n  db-->|returns| auth\\n  auth-->|returns token| lb\\n  lb-->|serves| browser"}

2) Open-ended concept:
Prompt: "Docker architecture"
Output: {"reasoning":"Open-ended. Show Docker internals. Client→API→Daemon→Registry→Runtime. Complete lifecycle.","diagramType":"graph TD","theme":"dark-minimal","mermaidCode":"graph TD\\n  client[\"Client\"]\\n  api[\"Docker API\"]\\n  daemon[\"Daemon\"]\\n  registry[(\"Registry\")]\\n  runtime[\"Runtime\"]\\n  client-->|CLI| api\\n  api-->|manages| daemon\\n  daemon-->|pulls| registry\\n  daemon-->|runs| runtime"}

SCHEMA: {"reasoning":"string (Steps 0-7)","diagramType":"graph TD|graph LR","theme":"forest-green|slate|dark-minimal|luxury|default","mermaidCode":"string"}

OUTPUT: Return ONLY the JSON object. No markdown fences.`;
}

function getMaxNodes(size: 'small' | 'medium' | 'large'): number {
  if (size === 'small') return 7;
  if (size === 'medium') return 12;
  return 20;
}

// ── Parse repair helpers ──

function stripJsonFences(raw: string): string {
  return raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
}

function repairTruncatedJson(raw: string): string {
  // Fix trailing commas before } or ]
  let fixed = raw.replace(/,\s*([}\]])/g, '$1');
  // If the string ends in the middle of an object/array, close it
  const openObjects = (fixed.match(/\{/g) || []).length;
  const closeObjects = (fixed.match(/\}/g) || []).length;
  const openArrays = (fixed.match(/\[/g) || []).length;
  const closeArrays = (fixed.match(/\]/g) || []).length;
  for (let i = 0; i < openObjects - closeObjects; i++) fixed += '}';
  for (let i = 0; i < openArrays - closeArrays; i++) fixed += ']';
  return fixed;
}

// ── Main function ──

export async function runArchitecturePlanner(
  prompt: string,
  diagramSize: 'small' | 'medium' | 'large' = 'medium',
  detailLevel: 1 | 2 | 3 = 2,
  model?: string,
  existingContext?: { nodes?: unknown[]; edges?: unknown[] }
): Promise<{ formatConfig: FormatConfig; styleConfig: StyleConfig; mermaidCode: string; reasoning?: string }> {
  const maxNodes = getMaxNodes(diagramSize);
  const systemPrompt = buildSystemPrompt();

  const detailGuidance = detailLevel === 1
    ? 'DIAGRAM SCOPE: KEEP IT SIMPLE. Show only the essential high-level components and their main interactions. Use concise edge labels (2 words or fewer). Skip infrastructure details, async flows, and secondary services. The goal is a quick overview, not a comprehensive architecture.'
    : detailLevel === 2
    ? 'DIAGRAM SCOPE: MODERATE DETAIL. Show core components and their main interactions. Include edge labels that describe the action and context. Include async flows and infrastructure details only when they are central to the architecture.'
    : 'DIAGRAM SCOPE: FULL DETAIL. Be comprehensive. Include all components, infrastructure, async flows, caches, queues, and supporting services. Edge labels must be descriptive (action + what + context). Show the complete workflow including background processing and data persistence. Include observability and cross-cutting concerns if relevant.';

  // Summarize the caller's existing diagram so "edit my diagram" flows
  // modify it rather than regenerating from scratch. Build a compact textual
  // inventory of current components and connections. Without this the
  // existingContext would be silently dropped and edits would lose the
  // user's existing diagram.
  const existingSummary = existingContext && (existingContext.nodes?.length || existingContext.edges?.length)
    ? describeExistingContext(existingContext)
    : '';
  const editDirective = existingSummary
    ? `\n\nEDIT MODE: The user already has the diagram below. Modify it to satisfy the request — keep existing components that still apply, add/remove/reconnect as needed, and do not discard the whole diagram unless the request explicitly asks for a redesign.\n\nCURRENT DIAGRAM:\n${existingSummary}\n`
    : '';

  const userPrompt = `Design a practical architecture diagram for: "${prompt}"${editDirective}

Target Diagram Constraints:
|- Size level: ${diagramSize}
|- Maximum nodes: ${maxNodes} total components (subgraphs/layers do not count towards this limit).
|- ${detailGuidance}

Output must conform to this JSON schema:
{
  "reasoning": "string",
  "diagramType": "graph TD" | "graph LR",
  "theme": "forest-green" | "slate" | "dark-minimal" | "luxury" | "default",
  "mermaidCode": "string"
}`;

/**
 * Simple rate limiter to prevent TPM accumulation
 */
class RateLimiter {
  private lastRequestTime = 0;
  private minIntervalMs = 1000; // 1 second between requests for high-rate-limit models

  async waitIfNeeded(modelId: string): Promise<void> {
    // Higher rate limit for gpt-oss models
    if (modelId.includes('gpt-oss')) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minIntervalMs) {
        const waitTime = this.minIntervalMs - timeSinceLastRequest;
        console.log(`[RateLimiter] Waiting ${waitTime}ms to prevent TPM accumulation`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      this.lastRequestTime = Date.now();
    }
  }
}

const rateLimiter = new RateLimiter();

  const requestedModel = model || 'openai/gpt-oss-120b';
  const FALLBACK_MODEL = 'llama-3.3-70b-versatile'; // Fallback to model with higher TPM limits
  const isGptOss = /^openai\/gpt-oss/i.test(requestedModel);

  let resultStr = '';
  const maxAttempts = 2;

  // For gpt-oss models with tight TPM limits, try the requested model first,
  // then fall back to the higher-limit model on 413 errors.
  const modelsToTry = isGptOss
    ? [requestedModel, FALLBACK_MODEL]
    : [requestedModel];

  let lastError: Error | null = null;
  let succeeded = false;

  for (const currentModel of modelsToTry) {
    if (succeeded) break;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Rate limit before each request
        await rateLimiter.waitIfNeeded(currentModel);
        
        resultStr = await apiKeyManager.executeWithRetry(async (groq) => {
          const attemptPrompt = attempt > 1
            ? `${userPrompt}\n\nIMPORTANT: Output ONLY a valid JSON object with keys "reasoning", "diagramType", "theme", and "mermaidCode". No markdown fences, no prose.`
            : userPrompt;
          return await groqJsonCompletion(groq, {
            model: currentModel,
            reasoning_effort: 'medium',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: attemptPrompt },
            ],
            temperature: 0.7,
            max_tokens: 8192,
          });
        });
        succeeded = true;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = new Error(msg);

        // 413 = TPM limit exceeded — fall back to a higher-limit model
        if (msg.includes('413') || msg.includes('tokens per minute')) {
          if (currentModel !== FALLBACK_MODEL) {
            logger.warn(`[ArchitecturePlanner] TPM limit hit on ${currentModel}, falling back to ${FALLBACK_MODEL}`);
            break; // break inner loop, outer loop picks next model
          }
        }

        if (attempt < maxAttempts) continue; // retry same model
        break; // try next model
      }
    }
  }

  if (!succeeded && lastError) {
    throw lastError;
  }

  let cleaned: PlannerOutput;
  try {
    cleaned = JSON.parse(stripJsonFences(resultStr)) as PlannerOutput;
  } catch (parseErr) {
    // Try to repair truncated JSON
    try {
      cleaned = JSON.parse(repairTruncatedJson(resultStr)) as PlannerOutput;
    } catch (repairErr) {
      logger.error('[ArchitecturePlanner] JSON parse failed after repair attempt', { raw: resultStr.substring(0, 500) });
      throw new Error(`Failed to parse architecture planner output: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
    }
  }

  const theme = THEMES.includes(cleaned.theme as (typeof THEMES)[number]) ? cleaned.theme : 'slate';

  const formatConfig: FormatConfig = {
    format: 'mermaid',
    diagramType: cleaned.diagramType,
    optionalVariants: [],
  };

  const styleConfig: StyleConfig = {
    primaryColor: themePrimaryColor(theme),
    secondaryColor: getDiagramTheme(theme).concerns.data.color,
    background: getDiagramTheme(theme).light.canvasHint,
    backgroundColor: getDiagramTheme(theme).light.canvasHint,
    fontFamily: 'Inter, sans-serif',
    theme: theme as 'forest-green' | 'slate' | 'dark-minimal' | 'luxury' | 'default',
    nodeTypeStyles: themeToNodeTypeStyles(theme),
  };

  return {
    formatConfig,
    styleConfig,
    mermaidCode: cleaned.mermaidCode,
    reasoning: cleaned.reasoning,
  };
}