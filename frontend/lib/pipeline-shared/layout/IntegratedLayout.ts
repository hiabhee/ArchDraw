import { DagreLayoutEngine } from './DagreLayout';
import type { LayoutParams, LayoutResult, LayoutDirection } from './LayoutEngine';
import { defaultCompoundLayoutOptions, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './LayoutEngine';

/** Minimal ReactFlow-shaped graph used by pipeline layout. */
export interface RFNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  width?: number;
  height?: number;
  style?: Record<string, unknown>;
  parentNode?: string;
  extent?: 'parent' | [[number, number], [number, number]];
  [key: string]: unknown;
}

export interface RFEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RFObjects {
  nodes: RFNode[];
  edges: RFEdge[];
}

export type Direction = 'TD' | 'LR' | 'BT' | 'RL';

export interface IntegratedLayoutOptions {
  direction?: Direction;
  options?: {
    nodeSep?: number;
    rankSep?: number;
    marginX?: number;
    marginY?: number;
    padding?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
  };
}

/**
 * Canonical RF graph layout entry point.
 * Mermaid + pipeline stages should call this (or `layoutSync`) instead of local Dagre copies.
 */
export class IntegratedLayoutEngine {
  private dagreEngine: DagreLayoutEngine;

  constructor() {
    this.dagreEngine = new DagreLayoutEngine();
  }

  private toLayoutParams(objects: RFObjects, options: IntegratedLayoutOptions): LayoutParams {
    const direction = this.mapDirection(options.direction ?? 'LR');
    const defaults = defaultCompoundLayoutOptions(direction);
    return {
      nodes: objects.nodes.map(node => ({
        id: node.id,
        width: node.width || DEFAULT_NODE_WIDTH,
        height: node.height || DEFAULT_NODE_HEIGHT,
        parentId: node.parentNode
        || (node as { parentId?: string }).parentId
        || (node.data as { parentId?: string })?.parentId,
        isGroup: node.type === 'groupNode' || (node.data as { isGroup?: boolean })?.isGroup === true,
      })),
      edges: objects.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
      direction,
      options: { ...defaults, ...options.options },
    };
  }

  private fromLayoutResult(objects: RFObjects, result: LayoutResult): RFObjects {
    const byId = new Map(result.nodes.map(n => [n.id, n]));

    const layoutedNodes: RFNode[] = objects.nodes.map(originalNode => {
      const layoutNode = byId.get(originalNode.id);
      if (!layoutNode) {
        throw new Error(`Node ${originalNode.id} not found in layout result`);
      }

      return {
        ...originalNode,
        // Prefer engine result so cycle clearing is reflected on RF nodes
        parentNode: layoutNode.parentId,
        position: { x: layoutNode.x, y: layoutNode.y },
        width: layoutNode.width,
        height: layoutNode.height,
        style: originalNode.type === 'groupNode'
          ? { ...(originalNode.style as Record<string, unknown> | undefined), width: layoutNode.width, height: layoutNode.height }
          : originalNode.style,
      };
    });

    return {
      nodes: layoutedNodes,
      edges: [...objects.edges],
    };
  }

  /** Sync compound layout via Dagre (canonical for Mermaid pipeline). */
  layoutSync(objects: RFObjects, options: IntegratedLayoutOptions = {}): RFObjects {
    const params = this.toLayoutParams(objects, options);
    const result = this.dagreEngine.layoutSync(params);
    return this.fromLayoutResult(objects, result);
  }

  private mapDirection(direction: Direction): LayoutDirection {
    const map: Record<Direction, LayoutDirection> = {
      TD: 'TB',
      LR: 'LR',
      BT: 'BT',
      RL: 'RL',
    };
    return map[direction] || 'TB';
  }
}

let integratedLayoutEngine: IntegratedLayoutEngine | null = null;

export function getIntegratedLayoutEngine(): IntegratedLayoutEngine {
  if (!integratedLayoutEngine) {
    integratedLayoutEngine = new IntegratedLayoutEngine();
  }
  return integratedLayoutEngine;
}

/** Documented canonical helper for Mermaid / pipeline RF graphs. */
export function applyRfLayout(
  objects: RFObjects,
  direction: Direction = 'LR',
  options?: IntegratedLayoutOptions['options']
): RFObjects {
  return getIntegratedLayoutEngine().layoutSync(objects, { direction, options });
}
