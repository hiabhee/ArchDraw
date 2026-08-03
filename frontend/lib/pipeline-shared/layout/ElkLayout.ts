import type {
  LayoutEngine,
  LayoutParams,
  LayoutResult,
  PositionedNode,
  PositionedEdge,
  LayoutDirection,
} from './LayoutEngine';

interface ElkNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkNode[];
  edges?: ElkExtendedEdge[];
  layoutOptions?: Record<string, string>;
  parent?: string;
}

interface ElkExtendedEdge {
  id: string;
  sources?: string[];
  targets?: string[];
  sections?: ElkEdgeSection[];
}

interface ElkEdgeSection {
  bendPoints?: ElkPoint[];
}

interface ElkPoint {
  x: number;
  y: number;
}

interface ElkInstance {
  layout: (graph: ElkNode, options?: Record<string, unknown>) => Promise<ElkNode>;
}

/**
 * Use the browser-safe bundled build. The default `elkjs` entry requires `web-worker`,
 * which breaks Next.js client components.
 */
async function createElk(): Promise<ElkInstance> {
  const ELKModule = await import('elkjs/lib/elk.bundled.js');
  const ELK = (ELKModule as { default?: new () => ElkInstance }).default ?? (ELKModule as unknown as new () => ElkInstance);
  return new ELK();
}

function toElkLayoutOptions(direction: LayoutDirection) {
  const dirMap: Record<LayoutDirection, string> = {
    TB: 'DOWN',
    BT: 'UP',
    LR: 'RIGHT',
    RL: 'LEFT',
  };
  return {
    'elk.algorithm': 'layered',
    'elk.direction': dirMap[direction] ?? 'DOWN',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    'elk.spacing.nodeNode': '60',
    'elk.padding': '[40,40,40,40]',
    'elk.spacing.componentComponent': '30',
  };
}

export class ElkLayoutEngine implements LayoutEngine {
  readonly name = 'elk';
  private elk: ElkInstance | null = null;

  private async getElk(): Promise<ElkInstance> {
    if (!this.elk) {
      this.elk = await createElk();
    }
    return this.elk;
  }

  isAvailable(): boolean {
    return true;
  }

  async layout(params: LayoutParams): Promise<LayoutResult> {
    const warnings: string[] = [];
    const elk = await this.getElk();

    const elkGraph: ElkNode = {
      id: 'root',
      layoutOptions: toElkLayoutOptions(params.direction),
      children: [],
      edges: [],
    };

    const groupIds = new Set(params.nodes.filter(n => n.isGroup).map(n => n.id));
    const nodeMap = new Map(params.nodes.map(n => [n.id, n]));

    for (const node of params.nodes) {
      const elkNode: ElkNode = {
        id: node.id,
        width: node.width || 180,
        height: node.height || 60,
      };

      if (node.isGroup) {
        elkNode.layoutOptions = {
          'elk.padding': `[${params.options?.paddingTop ?? 64},${params.options?.paddingRight ?? 40},${params.options?.paddingBottom ?? 40},${params.options?.paddingLeft ?? 40}]`,
        };
      }

      if (node.parentId && groupIds.has(node.parentId)) {
        elkNode.parent = node.parentId;
      }

      elkGraph.children!.push(elkNode);
    }

    for (const edge of params.edges) {
      elkGraph.edges!.push({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      });
    }

    let layoutResult: ElkNode;
    try {
      layoutResult = await elk.layout(elkGraph);
    } catch (err) {
      warnings.push(`ELK layout failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      return {
        nodes: params.nodes.map(n => ({ ...n, x: 0, y: 0 })),
        edges: params.edges.map(e => ({ ...e })),
        warnings,
      };
    }

    const positionedNodes: PositionedNode[] = (layoutResult.children || []).map((elkChild: ElkNode) => {
      const original = nodeMap.get(elkChild.id);
      return {
        id: elkChild.id,
        x: elkChild.x ?? 0,
        y: elkChild.y ?? 0,
        width: elkChild.width ?? original?.width ?? 180,
        height: elkChild.height ?? original?.height ?? 60,
        parentId: original?.parentId,
        isGroup: original?.isGroup,
      };
    });

    const positionedEdges: PositionedEdge[] = params.edges.map((edge, idx) => {
      const elkEdge = layoutResult.edges?.[idx] || layoutResult.edges?.find((e: ElkExtendedEdge) => e.id === edge.id);
      return {
        ...edge,
        points: elkEdge?.sections?.flatMap((s: ElkEdgeSection) => s.bendPoints || [])?.map((p: ElkPoint) => ({ x: p.x, y: p.y })),
      };
    });

    return { nodes: positionedNodes, edges: positionedEdges, warnings };
  }
}
