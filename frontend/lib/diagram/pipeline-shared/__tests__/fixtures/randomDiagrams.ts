import type { Edge, Node } from 'reactflow';

/**
 * Seeded random diagrams for layout property tests. Shapes are layered DAGs with
 * fan-outs, fan-ins, skip edges and optional subgraphs, the same mix an AI or repo
 * diagram produces. Deterministic: the same seed always gives the same diagram.
 */
export interface RandomDiagram {
  id: string;
  nodes: Node[];
  edges: Edge[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RandomDiagramOptions {
  groups?: boolean;
  /** `dense`: most nodes connect to most of the next layer (complete bipartite layers are common). `sparse`: realistic fan-outs and fan-ins. */
  density?: 'dense' | 'sparse';
}

export function randomDiagram(seed: number, options: RandomDiagramOptions = {}): RandomDiagram {
  const edgeChance = options.density === 'sparse' ? 0.35 : 0.6;
  const skipChance = options.density === 'sparse' ? 0.08 : 0.2;
  const rand = mulberry32(seed);
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
  const layers = 2 + Math.floor(rand() * 5);
  const members: string[][] = [];
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let n = 0;
  for (let layer = 0; layer < layers; layer++) {
    const count = 1 + Math.floor(rand() * 4);
    const row: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = `n${n++}`;
      row.push(id);
      nodes.push({
        id,
        type: 'systemNode',
        position: { x: layer * 300, y: i * 120 },
        data: { label: `Node ${id}`, subtitle: '', layer: 'compute', category: 'compute', color: '#0d9488', icon: 'Box', nodeWidth: 182, nodeHeight: 82 },
      });
    }
    members.push(row);
  }
  const addEdge = (source: string, target: string) => {
    if (edges.some(e => e.source === source && e.target === target)) return;
    edges.push({ id: `e${edges.length}`, source, target, type: 'simpleFloating', data: { label: '', edgeType: 'sync', connectionType: 'sync', pathType: 'Smoothstep' } });
  };
  for (let layer = 0; layer < layers - 1; layer++) {
    for (const source of members[layer]) {
      const targets = members[layer + 1].filter(() => rand() < edgeChance);
      if (targets.length === 0) targets.push(pick(members[layer + 1]));
      for (const target of targets) addEdge(source, target);
    }
    // Every node in the next layer gets at least one parent.
    for (const target of members[layer + 1]) {
      if (!edges.some(e => e.target === target)) addEdge(pick(members[layer]), target);
    }
  }
  // Skip edges across one or more layers.
  for (let layer = 0; layer < layers - 2; layer++) {
    for (const source of members[layer]) {
      if (rand() < skipChance) addEdge(source, pick(members[layer + 2 + Math.floor(rand() * (layers - layer - 2))]));
    }
  }
  if (options.groups && n >= 4) {
    const flat = members.flat();
    const groupCount = 1 + Math.floor(rand() * 2);
    for (let g = 0; g < groupCount; g++) {
      const size = 2 + Math.floor(rand() * Math.min(4, flat.length - 2));
      const start = Math.floor(rand() * (flat.length - size + 1));
      const children = flat.slice(start, start + size);
      const gid = `g${g}`;
      nodes.push({ id: gid, type: 'groupNode', position: { x: 0, y: 0 }, data: { label: `Group ${g}` }, style: { width: 400, height: 400 } });
      for (const id of children) {
        const node = nodes.find(x => x.id === id)!;
        node.parentNode = gid;
        node.extent = 'parent';
      }
    }
  }
  return { id: `random-${options.density ?? 'dense'}-${seed}${options.groups ? '-groups' : ''}`, nodes, edges };
}
