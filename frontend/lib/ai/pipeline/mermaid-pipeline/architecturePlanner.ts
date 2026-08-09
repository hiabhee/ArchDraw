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
  const MAX_LISTED = 15;
  if (nodes.length > 0) {
    lines.push('Components:');
    for (const n of nodes.slice(0, MAX_LISTED)) {
      const data = n.data as Record<string, unknown> | undefined;
      const type = String(n.type ?? '');
      const isText = type === 'textLabelNode' || type === 'annotationNode';
      const label = data?.label ?? data?.text ?? data?.title ?? n.label ?? n.id;
      lines.push(`  - ${isText ? `[${type}] ` : ''}${String(label ?? n.id ?? 'unknown')}`);
    }
    if (nodes.length > MAX_LISTED) lines.push(`  ... and ${nodes.length - MAX_LISTED} more`);
  }
  if (edges.length > 0) {
    lines.push('Connections:');
    for (const e of edges.slice(0, MAX_LISTED)) {
      const label = e.label ?? (e.data as Record<string, unknown> | undefined)?.label;
      const suffix = label ? ` (${String(label)})` : '';
      lines.push(`  - ${String(e.source ?? '?')} -> ${String(e.target ?? '?')}${suffix}`);
    }
    if (edges.length > MAX_LISTED) lines.push(`  ... and ${edges.length - MAX_LISTED} more`);
  }
  return lines.join('\n');
}

function stripJsonFences(raw: string): string {
  return raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
}

function repairTruncatedJson(raw: string): string {
  let fixed = raw.replace(/,\s*([}\]])/g, '$1');
  const openObjects = (fixed.match(/\{/g) || []).length;
  const closeObjects = (fixed.match(/\}/g) || []).length;
  const openArrays = (fixed.match(/\[/g) || []).length;
  const closeArrays = (fixed.match(/\]/g) || []).length;
  for (let i = 0; i < openObjects - closeObjects; i++) fixed += '}';
  for (let i = 0; i < openArrays - closeArrays; i++) fixed += ']';
  return fixed;
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
  const maxAttempts = 2;

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
              `[ArchitecturePlanner] TPM limit hit on ${currentModel}, falling back to ${FALLBACK_GENERATION_MODEL}`
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
    cleaned = JSON.parse(stripJsonFences(resultStr)) as PlannerOutput;
  } catch (parseErr) {
    try {
      cleaned = JSON.parse(repairTruncatedJson(resultStr)) as PlannerOutput;
    } catch {
      logger.error('[ArchitecturePlanner] JSON parse failed after repair attempt', {
        raw: resultStr.substring(0, 500),
      });
      throw new Error(
        `Failed to parse architecture planner output: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      );
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
