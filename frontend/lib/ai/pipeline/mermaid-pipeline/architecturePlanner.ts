import { apiKeyManager } from '../../utils/apiKeyManager';
import { groqJsonCompletion } from '../../utils/groqJsonCompletion';
import logger from '@/lib/logger';
import { DEFAULT_GENERATION_MODEL, FALLBACK_GENERATION_MODEL } from '@/lib/ai/models';
import type { FormatConfig, StyleConfig } from './types';
import { themePrimaryColor, themeToNodeTypeStyles, getDiagramTheme } from '@/lib/theme/stylingConstants';
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  getDetailGuidance,
  getMaxNodesForSize,
} from './plannerPrompts';

interface PlannerOutput {
  reasoning: string;
  diagramType: 'graph TD' | 'graph LR';
  theme: string;
  mermaidCode: string;
}

const THEMES = ['forest-green', 'slate', 'dark-minimal', 'luxury', 'default'] as const;

/** Throttle back-to-back gpt-oss calls to reduce TPM spikes. */
class RateLimiter {
  private lastRequestTime = 0;
  private readonly minIntervalMs = 1000;

  async waitIfNeeded(modelId: string): Promise<void> {
    if (!modelId.includes('gpt-oss')) return;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

const rateLimiter = new RateLimiter();

function describeExistingContext(ctx: { nodes?: unknown[]; edges?: unknown[] }): string {
  const lines: string[] = [];
  const nodes = (ctx.nodes ?? []) as Array<Record<string, unknown>>;
  const edges = (ctx.edges ?? []) as Array<Record<string, unknown>>;
  const MAX_NODES = 10;
  const MAX_EDGES = 8;
  if (nodes.length > 0) {
    lines.push('Nodes:');
    for (const n of nodes.slice(0, MAX_NODES)) {
      const data = n.data as Record<string, unknown> | undefined;
      const label = data?.label ?? data?.text ?? data?.title ?? n.label ?? n.id;
      lines.push(`  - ${String(label ?? n.id ?? 'unknown')}`);
    }
    if (nodes.length > MAX_NODES) lines.push(`  +${nodes.length - MAX_NODES} more`);
  }
  if (edges.length > 0) {
    lines.push('Edges:');
    for (const e of edges.slice(0, MAX_EDGES)) {
      lines.push(`  - ${String(e.source ?? '?')}->${String(e.target ?? '?')}`);
    }
    if (edges.length > MAX_EDGES) lines.push(`  +${edges.length - MAX_EDGES} more`);
  }
  return lines.join('\n');
}

function stripJsonFences(raw: string): string {
  return raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
}

/**
 * Escape literal newlines, tabs, and carriage returns inside JSON string values.
 * LLMs frequently emit `mermaidCode: "graph LR\n  A --> B"` with real newlines
 * instead of the escaped `\n` that valid JSON requires.
 */
function escapeNewlinesInJsonStrings(json: string): string {
  let inString = false;
  let escaped = false;
  const result: string[] = [];
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escaped) {
      result.push(ch);
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      result.push(ch);
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result.push(ch);
      continue;
    }
    if (inString) {
      if (ch === '\n') { result.push('\\n'); continue; }
      if (ch === '\r') { result.push('\\r'); continue; }
      if (ch === '\t') { result.push('\\t'); continue; }
    }
    result.push(ch);
  }
  return result.join('');
}

/**
 * Extract the first `{ ... }` JSON object from LLM output that may contain
 * surrounding prose, markdown fences, or trailing text.
 */
function extractJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  if (start === -1) return raw;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return raw.slice(start, i + 1); }
  }
  return raw.slice(start);
}

function repairTruncatedJson(raw: string): string {
  let fixed = raw.replace(/,\s*([}\]])/g, '$1');
  // Escape literal newlines/tabs inside JSON strings
  fixed = escapeNewlinesInJsonStrings(fixed);
  const openObjects = (fixed.match(/\{/g) || []).length;
  const closeObjects = (fixed.match(/\}/g) || []).length;
  const openArrays = (fixed.match(/\[/g) || []).length;
  const closeArrays = (fixed.match(/\]/g) || []).length;
  for (let i = 0; i < openObjects - closeObjects; i++) fixed += '}';
  for (let i = 0; i < openArrays - closeArrays; i++) fixed += ']';
  return fixed;
}

/**
 * Multi-stage JSON extraction and repair. Tries progressively more aggressive
 * fixes so the pipeline doesn't fail on common LLM output quirks.
 */
function extractPlannerJson(raw: string): PlannerOutput {
  const stripped = stripJsonFences(raw);

  // Stage 1: direct parse with newline escaping
  try {
    return JSON.parse(escapeNewlinesInJsonStrings(stripped)) as PlannerOutput;
  } catch { /* continue */ }

  // Stage 2: extract the first {…} block (LLM may have prepended prose)
  const extracted = extractJsonObject(stripped);
  try {
    return JSON.parse(escapeNewlinesInJsonStrings(extracted)) as PlannerOutput;
  } catch { /* continue */ }

  // Stage 3: repair truncated / trailing-comma JSON
  try {
    return JSON.parse(repairTruncatedJson(extracted)) as PlannerOutput;
  } catch { /* continue */ }

  // Stage 4: last-ditch — try extracting from the raw (pre-strip) text
  const rawExtracted = extractJsonObject(raw);
  try {
    return JSON.parse(repairTruncatedJson(rawExtracted)) as PlannerOutput;
  } catch (finalErr) {
    throw new Error(
      `Failed to parse architecture planner output: ${finalErr instanceof Error ? finalErr.message : String(finalErr)}`
    );
  }
}

export async function runArchitecturePlanner(
  prompt: string,
  diagramSize: 'small' | 'medium' | 'large' = 'medium',
  detailLevel: 1 | 2 | 3 = 2,
  model?: string,
  existingContext?: { nodes?: unknown[]; edges?: unknown[] }
): Promise<{ formatConfig: FormatConfig; styleConfig: StyleConfig; mermaidCode: string; reasoning?: string }> {
  const maxNodes = getMaxNodesForSize(diagramSize);
  const systemPrompt = buildPlannerSystemPrompt();
  const existingSummary =
    existingContext && (existingContext.nodes?.length || existingContext.edges?.length)
      ? describeExistingContext(existingContext)
      : undefined;

  const userPrompt = buildPlannerUserPrompt(prompt, {
    diagramSize,
    maxNodes,
    detailGuidance: getDetailGuidance(detailLevel),
    existingSummary,
  });

  const requestedModel = model || DEFAULT_GENERATION_MODEL;
  const isGptOss = /^openai\/gpt-oss/i.test(requestedModel);
  const modelsToTry = isGptOss ? [requestedModel, FALLBACK_GENERATION_MODEL] : [requestedModel];

  let resultStr = '';
  let lastError: Error | null = null;
  let succeeded = false;
  // Each executeWithRetry call rotates through ALL Groq keys before throwing,
  // so a single attempt exercises the full key pool. We retry a few times in
  // case TPM windows roll between attempts.
  const maxAttempts = 3;

  for (const currentModel of modelsToTry) {
    if (succeeded) break;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await rateLimiter.waitIfNeeded(currentModel);

        resultStr = await apiKeyManager.executeWithRetry(async (groq) => {
          const attemptPrompt =
            attempt > 1
              ? `${userPrompt}\n\nIMPORTANT: Output ONLY a valid JSON object with keys "reasoning", "diagramType", "theme", and "mermaidCode". No markdown fences, no prose.`
              : userPrompt;
          return await groqJsonCompletion(groq, {
            model: currentModel,
            reasoning_effort: 'low',
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

        if (msg.includes('413') || msg.includes('tokens per minute')) {
          if (currentModel !== FALLBACK_GENERATION_MODEL) {
            logger.warn(
              `[ArchitecturePlanner] TPM limit hit on ${currentModel} (attempt ${attempt}/${maxAttempts}), falling back to ${FALLBACK_GENERATION_MODEL}`
            );
            break;
          }
        }

        if (attempt < maxAttempts) continue;
        break;
      }
    }
  }

  if (!succeeded && lastError) {
    throw lastError;
  }

  let cleaned: PlannerOutput;
  try {
    cleaned = extractPlannerJson(resultStr);
  } catch (parseErr) {
    logger.error('[ArchitecturePlanner] JSON parse failed after all repair attempts', {
      raw: resultStr.substring(0, 500),
    });
    throw parseErr;
  }

  // Post-process: replace "/" with " or " in node labels to avoid visual artifacts
  if (cleaned.mermaidCode) {
    // Handle both raw and escaped quotes in mermaid code
    cleaned.mermaidCode = cleaned.mermaidCode
      // node["label"] or node[("label")]
      .replace(/\[("|\))(["'])([^"']*\/[^"']*)\2\1?\]/g,
        (_m, _parens, _q, inner: string) => `[${_parens === '(' ? '(' : ''}"${inner.replace(/\s*\/\s*/g, ' or ')}"${_parens === ')' ? ')' : ''}]`)
      // Also handle escaped quotes in JSON strings: [\\"label\\"] 
      .replace(/\[(?:\()?\\"([^"\\]*(?:\\.[^"\\]*)*\/[^"\\]*(?:\\.[^"\\]*)*)\\"(?:\))?\]/g,
        (_m, inner: string) => `[${_m.startsWith('[(') ? '(' : ''}\\"${inner.replace(/\s*\/\s*/g, ' or ')}\\"${_m.endsWith(')]') ? ')' : ''}]`);
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
