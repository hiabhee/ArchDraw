import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repairDiagramQuality } from '../QualityRepairStage';
import { runArchitecturePlanner } from '../../architecturePlanner';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { ScoreStage } from '../ScoreStage';
import { ValidationStage } from '../ValidationStage';
import { DefaultPipelineContext } from '@/lib/pipeline-core/PipelineContext';
import type { AiPipelineData } from '../../aiPipelineTypes';
vi.mock('../../architecturePlanner', () => ({ runArchitecturePlanner: vi.fn() }));
const context = new DefaultPipelineContext('repair');
const plan = { formatConfig: { format: 'mermaid' as const, diagramType: 'graph LR' as const, optionalVariants: [] },
  styleConfig: { primaryColor: '#000', secondaryColor: '#fff', background: '#fff', fontFamily: 'Inter', theme: 'slate' },
  mermaidCode: 'graph LR\n api["Order Service"] -->|writes records| db[("PostgreSQL")]\n audit["Audit Service"]',
  reasoning: 'The order service writes data to PostgreSQL. The audit service must record order changes.',
  usedFallback: false, inEditMode: false, droppedExistingContext: false };
async function input(): Promise<AiPipelineData> {
  const materialized = await runMermaidPipeline(plan.mermaidCode);
  if (!materialized.success) throw materialized.error;
  const parsed = materialized.data;
  const prompt = 'Order Service writes to PostgreSQL and sends events to Audit Service';
  const score = await new ScoreStage().execute({ ...parsed, prompt, diagramSize: 'small', detailLevel: 1, styleTheme: 'slate', stylePlan: { style: 'generic', strictness: 'inferred', productionDepth: 'conceptual' } }, context);
  const validation = await new ValidationStage().execute({ ...parsed, prompt, reasoning: plan.reasoning, diagramSize: 'small', detailLevel: 1, parseWarnings: [] }, context);
  return { prompt, userIntent: { description: prompt, systemType: 'architecture', complexity: 'medium' }, diagramSize: 'small', detailLevel: 1, plan,
    parseOutput: { ...parsed, parseWarnings: [], plan, usedFallback: false, droppedExistingContext: false }, scoreOutput: score.data!, validationOutput: validation.data! };
}
beforeEach(() => vi.clearAllMocks());
describe('bounded quality revision', () => {
  it('accepts a revision resolving a disconnected required component', async () => {
    const data = await input();
    vi.mocked(runArchitecturePlanner).mockResolvedValue({ ...plan, mermaidCode: `${plan.mermaidCode}\n api -->|sends events| audit` });
    const result = await repairDiagramQuality(data, context);
    expect(result.data?.repairAccepted).toBe(true);
    expect(result.data?.parseOutput?.edges).toHaveLength(2);
    expect(runArchitecturePlanner).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runArchitecturePlanner).mock.calls[0][5]).toMatchObject({ maxAttempts: 1, allowModelFallback: false });
  });
  it('rejects higher-scoring simplification that drops a component', async () => {
    const data = await input();
    vi.mocked(runArchitecturePlanner).mockResolvedValue({ ...plan, mermaidCode: 'graph LR\n api["Order Service"] -->|writes records| db[("PostgreSQL")]' });
    const result = await repairDiagramQuality(data, context);
    expect(result.data?.repairAccepted).toBe(false);
    expect(result.data?.parseOutput).toBe(data.parseOutput);
  });
  it('rejects a revision that drops a distinct relationship', async () => {
    const data = await input();
    vi.mocked(runArchitecturePlanner).mockResolvedValue({ ...plan, mermaidCode: 'graph LR\n api["Order Service"] -->|sends events| audit["Audit Service"]\n audit -->|writes records| db[("PostgreSQL")]' });
    const result = await repairDiagramQuality(data, context);
    expect(result.data?.repairAccepted).toBe(false);
    expect(result.data?.parseOutput).toBe(data.parseOutput);
  });
  it('keeps the original on provider errors', async () => {
    const data = await input();
    vi.mocked(runArchitecturePlanner).mockRejectedValue(new Error('unavailable'));
    const result = await repairDiagramQuality(data, context);
    expect(result.data?.repairAttempted).toBe(true);
    expect(result.data?.parseOutput).toBe(data.parseOutput);
  });
  it('skips revisions when quality passes', async () => {
    const data = await input();
    data.validationOutput = { semanticIssues: [], mechanicalRepairs: [] };
    data.scoreOutput!.score = 90;
    await repairDiagramQuality(data, context);
    expect(runArchitecturePlanner).not.toHaveBeenCalled();
  });
});
