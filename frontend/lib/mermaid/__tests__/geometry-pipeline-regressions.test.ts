import { describe, expect, it } from 'vitest';
import { runMermaidPipeline } from '../pipeline';
import { semanticEdgeKeyString } from '../edgeFlowSemantics';

describe('geometry and flow metadata pipeline regressions', () => {
  it('scores RL geometry in the same horizontal orientation as final validation', async () => {
    const source = 'graph LR\n  a[Client] --> b[API]\n  b --> c[Database]';
    const lr = await runMermaidPipeline(source);
    const rl = await runMermaidPipeline(source.replace('graph LR', 'graph RL'));
    if (!lr.success) throw lr.error;
    if (!rl.success) throw rl.error;
    const lrA = lr.data.nodes.find(n => n.id === 'a')!.position.x;
    const lrC = lr.data.nodes.find(n => n.id === 'c')!.position.x;
    const rlA = rl.data.nodes.find(n => n.id === 'a')!.position.x;
    const rlC = rl.data.nodes.find(n => n.id === 'c')!.position.x;
    expect(Math.sign(lrC - lrA)).toBe(-Math.sign(rlC - rlA));
  });

  it('applies explicit semantic sidecars before Dagre layout', async () => {
    const key = semanticEdgeKeyString({
      sourceLayoutId: 'layout_61',
      targetLayoutId: 'layout_62',
      normalizedLabel: 'publishes',
      normalizedType: 'dotted',
      duplicateOrdinal: 0,
    });
    const result = await runMermaidPipeline(
      'graph LR\n  layout_61[Client] -.publishes.-> layout_62[Queue]',
      {
        edgeSemantics: new Map([[key, {
          importance: 'primary',
          importanceSource: 'explicit',
          flowRole: 'main',
          flowRoleSource: 'explicit',
          flowRoleConfidence: 1,
        }]]),
      },
    );

    if (!result.success) throw result.error;
    expect(result.data.edges[0].data).toMatchObject({
      importance: 'primary',
      importanceSource: 'explicit',
      flowRole: 'main',
      flowRoleSource: 'explicit',
    });
  });

  it('returns final-path geometry status and metrics from the materialized graph', async () => {
    const result = await runMermaidPipeline('graph LR\n  client[Client] --> api[API]\n  api --> db[(Database)]');
    if (!result.success) throw result.error;

    expect(result.data.geometrySummary).toMatchObject({
      status: expect.stringMatching(/^(ok|degraded|invalid|failed)$/),
      hardViolations: expect.any(Number),
      crossings: expect.any(Number),
      unexplainedPrivateOverlapLength: expect.any(Number),
      criticalPathDisconnectCount: expect.any(Number),
    });
    expect(result.data.geometrySummary?.status).not.toBe('invalid');
    expect(result.data.geometrySummary?.status).not.toBe('failed');
  });
});
