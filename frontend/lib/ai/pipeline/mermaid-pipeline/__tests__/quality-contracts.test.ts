import { describe, it, expect, vi } from 'vitest';
import { describeExistingContext } from '../architecturePlanner';
import { PLANNER_EXAMPLES } from '../plannerPrompts';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { LayoutOverrideStage } from '../stages/LayoutOverrideStage';
import { ValidationStage } from '../stages/ValidationStage';
import { DefaultPipelineContext } from '@/lib/pipeline-core/PipelineContext';
import { scoreDiagram } from '../../scoreDiagram';
import { measureLayoutQuality } from '@/lib/pipeline-shared/layout/layoutQuality';
import { ArchitecturePlanningStage } from '../stages/ArchitecturePlanningStage';
import { runArchitecturePlanner } from '../architecturePlanner';
vi.mock('../architecturePlanner', async importOriginal => ({
  ...await importOriginal<typeof import('../architecturePlanner')>(),
  runArchitecturePlanner: vi.fn(),
}));
const context = () => new DefaultPipelineContext('quality-test');
const plan = { formatConfig: { format: 'mermaid' as const, diagramType: 'graph TD' as const, optionalVariants: [] },
  styleConfig: { primaryColor: '#000', secondaryColor: '#fff', background: '#fff', fontFamily: 'Inter', theme: 'slate' },
  mermaidCode: 'graph TD\n a["Service"] --> b["Database"]', inEditMode: false, usedFallback: false, droppedExistingContext: false };

describe('quality contracts', () => {
  it('serializes the entire edit graph with stable IDs, labels and boundaries', () => {
    const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, parentNode: 'group', data: { label: `Node ${i}`, shape: 'cloud' } }));
    const edges = Array.from({ length: 29 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}`, data: { label: `Operation ${i}` } }));
    const serialized = JSON.parse(describeExistingContext({ nodes, edges }));
    expect(serialized.nodes).toHaveLength(30);
    expect(serialized.edges).toHaveLength(29);
    expect(serialized.nodes[29]).toMatchObject({ id: 'n29', label: 'Node 29', parentNode: 'group', shape: 'cloud' });
    expect(serialized.edges[28].label).toBe('Operation 28');
  });
  it('preserves planner direction and honors explicit overrides even for concepts', async () => {
    const stage = new LayoutOverrideStage();
    const conceptDetection = { implicitConcept: null, promptLower: 'layered architecture', isVerticalRequested: false };
    expect((await stage.execute({ plan, conceptDetection }, context())).data?.formatConfig.diagramType).toBe('graph TD');
    expect((await stage.execute({ plan, conceptDetection: { ...conceptDetection, promptLower: 'horizontal layout' } }, context())).data?.mermaidCode).toContain('graph LR');
    expect((await stage.execute({ plan, conceptDetection: { ...conceptDetection, implicitConcept: { subject: 'Docker', domain: 'container-runtime', template: 'docker' }, isVerticalRequested: true } }, context())).data?.formatConfig.diagramType).toBe('graph TD');
  });
  it('plans concept prompts and only uses templates on provider failure', async () => {
    const stage = new ArchitecturePlanningStage();
    const input = { prompt: 'Explain Docker', diagramSize: 'medium' as const, detailLevel: 2 as const,
      conceptDetection: { implicitConcept: { subject: 'Docker', domain: 'container-runtime' as const, template: 'docker' as const }, promptLower: 'explain docker', isVerticalRequested: false } };
    vi.mocked(runArchitecturePlanner).mockResolvedValueOnce(plan);
    expect((await stage.execute(input, context())).data?.usedFallback).toBe(false);
    vi.mocked(runArchitecturePlanner).mockRejectedValueOnce(new Error('provider unavailable'));
    expect((await stage.execute(input, context())).data?.usedFallback).toBe(true);
    vi.mocked(runArchitecturePlanner).mockRejectedValueOnce(new Error('provider unavailable'));
    expect((await stage.execute({ ...input, existingContext: { nodes: [{ id: 'keep' }], edges: [] } }, context())).success).toBe(false);
  });
  it('preserves workflow verbs, repeated steps, feedback loops and backend callbacks', async () => {
    const result = await runMermaidPipeline('graph LR\n a["Validate"] --> b["Transform"]\n b --> c["Validate"]\n c --> a\n server["Service"] -->|push notification| client["Web Browser"]');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['a', 'b', 'c', 'server', 'client']));
    expect(result.data.edges).toHaveLength(4);
    expect(result.data.nodesRemoved).toBe(0);
    const validation = await new ValidationStage().execute({ ...result.data, prompt: 'workflow to validate and transform', reasoning: 'Validate input, transform it, and repeat validation before continuing.', diagramSize: 'medium', detailLevel: 2, parseWarnings: [] }, context());
    expect(validation.data?.semanticIssues.filter(i => ['VERB_NODE', 'DUPLICATE_SYNONYM', 'CLIENT_AS_TARGET', 'REASONING_INCOMPLETE'].includes(i.type))).toEqual([]);
  });
  it('repairs the ride-sharing architecture failure mode', async () => {
    const result = await runMermaidPipeline(`graph LR
      mobile["Mobile App"] -->|requests ride| gateway{"API Gateway"}
      gateway -->|authenticates| authVerb["authenticates"]
      auth["Auth Service"] -->|returns token| mobile
      pricing["Pricing Service"] -->|caches rates| caches["caches"]
      redis["Redis Cache"]` , { diagramKind: 'architecture', pruneOrphans: true });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.nodes.map(n => n.data.label)).not.toEqual(expect.arrayContaining(['authenticates', 'caches', 'Redis Cache']));
    expect(result.data.nodesRemoved).toBeGreaterThanOrEqual(2);
    expect(result.data.edges.some(edge => edge.source === 'gateway' && edge.target === 'auth')).toBe(true);
    expect(result.data.edges.some(edge => edge.source === 'pricing' && edge.target === 'redis')).toBe(true);
  });
  it.each(PLANNER_EXAMPLES)('materializes the $category example without losing content', async example => {
    const result = await runMermaidPipeline(example.output.mermaidCode);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.nodesRemoved).toBe(0);
    expect(result.data.edgesRemoved).toBe(0);
    expect(result.data.groupsRemoved).toBe(0);
    const groups = result.data.nodes.filter(n => n.type === 'groupNode');
    for (const group of groups) expect(result.data.nodes.filter(n => n.parentNode === group.id).length).toBeGreaterThanOrEqual(2);
  });
  it('scores geometry, parentNode membership, and top-level edge labels', () => {
    const a = { id: 'a', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'A' }, width: 100, height: 50 };
    const b = { ...a, id: 'b' };
    expect(measureLayoutQuality([a, b], []).nodeOverlaps).toBe(1);
    const edges = [{ id: 'ab', source: 'a', target: 'b', label: 'queries' }];
    const clear = [a, { ...b, position: { x: 300, y: 0 } }];
    expect(scoreDiagram(clear, edges).score).toBeGreaterThan(scoreDiagram([a, b], edges).score);
    expect(scoreDiagram(clear, edges).score).toBeGreaterThan(scoreDiagram(clear, edges.map(e => ({ ...e, label: '' }))).score);
    const grouped = [{ ...a, id: 'group', type: 'groupNode' }, ...clear.map(n => ({ ...n, parentNode: 'group' }))];
    expect(scoreDiagram(grouped, edges).hasGroups).toBe(true);
    expect(scoreDiagram(clear, edges, { nodesRemoved: 1 }).preservationPenalty).toBe(5);
  });
});
