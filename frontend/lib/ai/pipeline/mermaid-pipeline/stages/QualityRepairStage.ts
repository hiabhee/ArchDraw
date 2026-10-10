import { successResult, type PipelineContext, type StageResult, isDomainSuccess } from '@/lib/pipeline-core';
import { runArchitecturePlanner } from '../architecturePlanner';
import type { AiPipelineData } from '../aiPipelineTypes';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { ScoreStage } from './ScoreStage';
import { ValidationStage } from './ValidationStage';
import logger from '@/lib/logger';
import { inferDiagramKind } from '../diagramIntent';

const actionable = (data: AiPipelineData) => data.validationOutput?.semanticIssues.filter(i => !i.type.startsWith('REASONING_')) ?? [];
const relationship = (e: { source: string; target: string; label?: unknown; data?: Record<string, unknown> }) =>
  JSON.stringify([e.source, e.target, e.label ?? e.data?.label ?? '']);

/** One quality revision; syntax retries/fallbacks must not recursively multiply its budget. */
export async function repairDiagramQuality(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
  const original = data.parseOutput;
  if (!original || !data.plan || !data.scoreOutput || !data.validationOutput) return successResult(data);
  const issues = actionable(data);
  if (data.plan.usedFallback || (issues.length === 0 && data.scoreOutput.score >= 65)) return successResult(data);
  const attempted = { ...data, repairAttempted: true, repairAccepted: false };
  try {
    const feedback = issues.map(i => `${i.type}: ${i.message}`).join('\n');
    const repaired = await runArchitecturePlanner(
      `${data.prompt}\n\nQUALITY REVISION: Correct the concrete issues below. Preserve all other component IDs, boundaries, and distinct relationships. Do not pad the graph to increase its score.\n${feedback || 'Improve clarity without adding or dropping requirements.'}\nCurrent Mermaid:\n${data.plan.mermaidCode}`,
      data.diagramSize, data.detailLevel, data.userIntent.model,
      { nodes: original.nodes, edges: original.edges },
      { maxAttempts: 1, allowModelFallback: false },
    );
    const direction = data.plan.formatConfig.diagramType;
    const mermaidCode = repaired.mermaidCode.replace(/^(\s*)(?:graph|flowchart)\s+(?:TD|TB|LR)\b/m, `$1${direction}`);
    const materialized = await runMermaidPipeline(mermaidCode, {
      diagramKind: inferDiagramKind(data.prompt),
      pruneOrphans: false,
    });
    if (!isDomainSuccess(materialized) || !materialized.data.nodes.length) return successResult(attempted, ['[QUALITY_REPAIR_RETAINED] Retained the original diagram because the quality revision failed or did not safely improve it.']);
    const parsed = materialized.data;
    const allowedChanges = new Set(issues.filter(i => i.type === 'VERB_NODE' || i.type === 'DUPLICATE_SYNONYM').map(i => i.nodeId));
    if (original.nodes.some(n => !allowedChanges.has(n.id) && !parsed.nodes.some(next => next.id === n.id))) return successResult(attempted, ['[QUALITY_REPAIR_RETAINED] Retained the original diagram because the quality revision failed or did not safely improve it.']);
    const allowedEdgeChanges = new Set(issues.filter(i => ['TIER_REVERSAL', 'CLIENT_AS_TARGET', 'DIRECT_GATEWAY_TO_DATA'].includes(i.type)).map(i => i.nodeId));
    const edges = new Set(parsed.edges.map(relationship));
    if (original.edges.some(e => !edges.has(relationship(e)) && !allowedChanges.has(e.source) && !allowedChanges.has(e.target) && !allowedEdgeChanges.has(e.source) && !allowedEdgeChanges.has(e.target))) return successResult(attempted, ['[QUALITY_REPAIR_RETAINED] Retained the original diagram because the quality revision failed or did not safely improve it.']);
    // Boundary preservation matters as much as keeping node IDs.
    if (original.nodes.some(n => !allowedChanges.has(n.id) && parsed.nodes.find(next => next.id === n.id)?.parentNode !== n.parentNode)) return successResult(attempted, ['[QUALITY_REPAIR_RETAINED] Retained the original diagram because the quality revision failed or did not safely improve it.']);
    const score = await new ScoreStage().execute({
      ...parsed, prompt: data.prompt, diagramSize: data.diagramSize, detailLevel: data.detailLevel,
      styleTheme: data.plan.styleConfig.theme,
      stylePlan: { style: 'generic', strictness: 'inferred', productionDepth: 'conceptual' },
    }, context);
    const validation = await new ValidationStage().execute({
      ...parsed, prompt: data.prompt, reasoning: repaired.reasoning, parseWarnings: parsed.warnings,
      diagramSize: data.diagramSize, detailLevel: data.detailLevel,
    }, context);
    if (!score.data || !validation.data) return successResult(attempted, ['[QUALITY_REPAIR_RETAINED] Retained the original diagram because the quality revision failed or did not safely improve it.']);
    const candidate = { ...attempted, scoreOutput: score.data, validationOutput: validation.data };
    const oldIssues = new Set(issues.map(i => `${i.type}:${i.nodeId ?? ''}`));
    const nextIssues = actionable(candidate);
    const noNewIssues = nextIssues.every(i => oldIssues.has(`${i.type}:${i.nodeId ?? ''}`));
    const improved = nextIssues.length < issues.length || score.data.score > data.scoreOutput.score;
    if (!noNewIssues || !improved || score.data.score < data.scoreOutput.score) return successResult(attempted, ['[QUALITY_REPAIR_RETAINED] Retained the original diagram because the quality revision failed or did not safely improve it.']);
    const plan = { ...data.plan, ...repaired, mermaidCode, formatConfig: { ...repaired.formatConfig, diagramType: direction } };
    return successResult({ ...candidate, repairAccepted: true, plan,
      parseOutput: { ...original, ...parsed, parseWarnings: parsed.warnings, plan } });
  } catch (error) {
    logger.warn('[QualityRepair] Revision failed; retaining original diagram', error);
    return successResult(attempted, ['[QUALITY_REPAIR_RETAINED] Retained the original diagram because the quality revision failed or did not safely improve it.']);
  }
}
