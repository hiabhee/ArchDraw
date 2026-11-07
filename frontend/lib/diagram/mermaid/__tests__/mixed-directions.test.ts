import { describe, expect, it } from 'vitest';
import { runMermaidPipeline } from '../pipeline';
import { measureLayoutAesthetics } from '@/lib/diagram/pipeline-shared/layout/layoutAesthetics';

// A grouped map shaped like an agent-published project map: a long left-to-right row of
// stages, each a group, several of them a chain of steps that is wide when laid out the
// same way as the row.
const MAP = (directions: Record<string, string> = {}) => `graph LR
  subgraph External["External"]
    nird["NIRD archive"]
    glims["GLIMS WFS"]
    sentinel["Sentinel archives"]
  end
  subgraph Ingest["Ingest"]
    ${directions.Ingest ? `direction ${directions.Ingest}` : ''}
    fetch["Benchmark fetch"]
    hma["HMA tiles"]
    prep["Site data prep"]
    rasters["Site rasters"]
  end
  subgraph Training["Training"]
    ${directions.Training ? `direction ${directions.Training}` : ''}
    pseudo["Pseudo-labelling"]
    flowing["Fine-Flowing"]
    weights["Model weights"]
  end
  subgraph Inference["Inference"]
    infer["GlaViTU inference"]
    outputs["Experiment outputs"]
  end
  subgraph Analysis["Analysis"]
    valid["Validation"]
    change["Change detection"]
  end
  subgraph Presentation["Presentation"]
    figs["Figures"]
  end
  nird -->|HMA tiles| fetch
  glims -->|inventory outlines| prep
  sentinel -->|S2/S1 scenes| prep
  fetch --> hma
  prep --> rasters
  hma -->|even-year stacks| pseudo
  hma -->|train/val tiles| flowing
  pseudo -->|pseudo-labels| flowing
  flowing --> weights
  weights -->|checkpoints| infer
  rasters -->|analysis-year stacks| infer
  infer --> outputs
  outputs -->|masks, outlines| valid
  outputs -->|masks, outlines| change
  valid -->|metrics| figs
  change -->|change stats| figs`;

type Laid = { id: string; type?: string; parentNode?: string; position: { x: number; y: number }; width?: number; height?: number; data?: { direction?: string } };

async function layout(mermaid: string, mixGroupDirections: boolean) {
  const result = await runMermaidPipeline(mermaid, { layoutProfile: 'studio-minimal', mixGroupDirections, foldLongFlows: true });
  if (!result.success) throw new Error('pipeline failed');
  return { nodes: result.data.nodes as unknown as Laid[], edges: result.data.edges };
}

function absolute(nodes: Laid[]) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const origin = (n: Laid): { x: number; y: number } => {
    const parent = n.parentNode && byId.get(n.parentNode);
    const base = parent ? origin(parent) : { x: 0, y: 0 };
    return { x: n.position.x + base.x, y: n.position.y + base.y };
  };
  return { byId, origin };
}

describe('mixed left-to-right and top-down flow', () => {
  it('lays some groups out top-down so a long row of stages fits the screen far better', async () => {
    const plain = await layout(MAP(), false);
    const mixed = await layout(MAP(), true);
    const fit = (laid: Awaited<ReturnType<typeof layout>>) => measureLayoutAesthetics(laid.nodes as never, laid.edges as never, 'LR').fitScale;
    expect(fit(mixed)).toBeGreaterThan(fit(plain) * 1.5);
  });

  it('never overlaps two nodes or pushes one out of its group', async () => {
    const { nodes } = await layout(MAP(), true);
    const { byId, origin } = absolute(nodes);
    const leaves = nodes.filter(n => n.type !== 'groupNode');
    for (let i = 0; i < leaves.length; i++) {
      for (let j = i + 1; j < leaves.length; j++) {
        const a = origin(leaves[i]), b = origin(leaves[j]);
        const overlap = a.x < b.x + leaves[j].width! && a.x + leaves[i].width! > b.x && a.y < b.y + leaves[j].height! && a.y + leaves[i].height! > b.y;
        expect(overlap, `${leaves[i].id} overlaps ${leaves[j].id}`).toBe(false);
      }
    }
    for (const leaf of leaves.filter(n => n.parentNode)) {
      const group = byId.get(leaf.parentNode!)!;
      const l = origin(leaf), g = origin(group);
      expect(l.x).toBeGreaterThanOrEqual(g.x - 0.5);
      expect(l.y).toBeGreaterThanOrEqual(g.y - 0.5);
      expect(l.x + leaf.width!).toBeLessThanOrEqual(g.x + group.width! + 0.5);
      expect(l.y + leaf.height!).toBeLessThanOrEqual(g.y + group.height! + 0.5);
    }
  });

  it('leaves no direction on a group the layout chose it for (it is the layout\'s choice, not the diagram\'s)', async () => {
    const { nodes } = await layout(MAP(), true);
    expect(nodes.filter(n => n.type === 'groupNode' && n.data?.direction)).toEqual([]);
  });

  it('is deterministic: the same diagram gets the same mix and the same positions', async () => {
    const first = await layout(MAP(), true);
    const second = await layout(MAP(), true);
    expect(second.nodes.map(n => [n.id, n.position.x, n.position.y])).toEqual(first.nodes.map(n => [n.id, n.position.x, n.position.y]));
  });

  it('respects a direction the author gave a group, and does not strip it', async () => {
    const { nodes } = await layout(MAP({ Training: 'LR' }), true);
    const training = nodes.find(n => n.id === 'Training')!;
    expect(training.data?.direction).toBeDefined();
  });
});
