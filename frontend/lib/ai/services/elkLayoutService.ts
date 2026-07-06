import type { ReactFlowNode, ReactFlowEdge, ArchitectureNode, ArchitectureEdge } from '../types';
import type { EdgePath, Point } from './edgeLayout';
import logger from '@/lib/logger';
import { getNodeShapeConfig } from '@/constants/nodeShapeConfig';
import { snapNodesToColumns } from '@/lib/utils/columnAlignNodes';
import { ELK_CONFIG, ELK_DIRECTION_OVERRIDE } from '@/lib/config';

export function getNormalizedTier(layer?: string): string {
  if (!layer) return 'compute';
  const clean = layer.toLowerCase().trim().replace(/[\s-]/g, '');

  if (clean === 'presentation' || clean === 'client' || clean === 'frontend') return 'client';
  if (clean === 'edge' || clean === 'infrastructure' || clean === 'gateway') return 'edge';
  if (clean === 'compute' || clean === 'application' || clean === 'compute/application') return 'compute';
  if (clean === 'async' || clean === 'queue') return 'async';
  if (clean === 'data' || clean === 'cache' || clean === 'storage') return 'data';
  if (clean === 'observe' || clean === 'observability' || clean === 'monitoring') return 'observe';
  if (clean === 'thirdparty' || clean === 'external') return 'external';

  // Substring matches as fallback
  if (clean.includes('client') || clean.includes('present') || clean.includes('frontend')) return 'client';
  if (clean.includes('edge') || clean.includes('infra') || clean.includes('gate')) return 'edge';
  if (clean.includes('compute') || (clean.includes('app') && !clean.includes('frontend'))) return 'compute';
  if (clean.includes('async') || clean.includes('queue') || clean.includes('bus') || clean.includes('stream')) return 'async';
  if (clean.includes('data') || clean.includes('db') || clean.includes('cache') || clean.includes('store') || clean.includes('sql') || clean.includes('mongo')) return 'data';
  if (clean.includes('observe') || clean.includes('monitor') || clean.includes('log') || clean.includes('trace') || clean.includes('alert')) return 'observe';
  if (clean.includes('third') || clean.includes('ext') || clean.includes('api') || clean.includes('vendor')) return 'external';

  return 'compute';
}

interface ELKInterface {
  layout: (graph: Record<string, unknown>, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

let elkInstance: ELKInterface | null = null;
async function getELK(): Promise<ELKInterface> {
  if (!elkInstance) {
    const ELKModule = await import('elkjs/lib/elk.bundled.js');
    const ELK = ELKModule.default ?? ELKModule;
    elkInstance = new ELK() as any as ELKInterface;
  }
  return elkInstance;
}

const LAYOUT_CACHE = new Map<string, { nodes: ReactFlowNode[]; timestamp: number }>();
const LAYOUT_CACHE_TTL = 5 * 60 * 1000;

function getTopologySignature(nodes: ArchitectureNode[]): string {
  const layerCounts: Record<string, number> = {};
  for (const node of nodes) {
    const layer = node.layer || 'compute';
    layerCounts[layer] = (layerCounts[layer] || 0) + 1;
  }
  return JSON.stringify(Object.entries(layerCounts).sort(([a], [b]) => a.localeCompare(b)));
}

async function runELKLayoutAsync(
  graph: unknown,
  options?: Record<string, string>,
  timeoutMs: number = 10000
): Promise<unknown> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('ELK timeout after ' + timeoutMs + 'ms')), timeoutMs);
  });

  const elk = await getELK();
  const elkPromise = elk.layout(graph as Parameters<typeof elk.layout>[0]);

  return Promise.race([elkPromise, timeoutPromise]);
}

function adjustCachedLayout(
  cachedNodes: ReactFlowNode[],
  actualNodes: ArchitectureNode[],
  _nodeWidth: number,
  _nodeHeight: number
): ReactFlowNode[] {
  const cachedMap = new Map(cachedNodes.map(n => [n.data?.label || n.id, n]));
  const result: ReactFlowNode[] = [];

  for (const node of actualNodes) {
    const config = getNodeShapeConfig(node.serviceType);
    const cached = cachedMap.get(node.label);
    if (cached) {
      result.push({
        ...cached,
        id: node.id,
        data: {
          ...cached.data,
          label: node.label,
          layer: node.layer,
        },
        width: node.width ?? config.width,
        height: node.height ?? config.height,
      });
    } else {
      result.push({
        id: node.id,
        type: 'customNode',
        position: { x: TIER_X[node.layer || 'compute'] ?? 500, y: 50 },
        data: {
          label: node.label,
          icon: node.icon || 'box',
          layer: node.layer,
        },
        width: node.width ?? config.width,
        height: node.height ?? config.height,
      });
    }
  }

  return result;
}

export interface ELKLayoutConfig {
  elkOptions?: Record<string, string>;
  nodeWidth?: number;
  nodeHeight?: number;
}

export const DEFAULT_NODE_WIDTH = 160;
export const DEFAULT_NODE_HEIGHT = 70;

const OPTIMIZED_ELK_OPTIONS = ELK_CONFIG;

const TIER_X: Record<string, number> = {
  client: 50,
  edge: 420,
  compute: 840,
  async: 1300,
  data: 1760,
  observe: 2220,
  external: 2680,
};

const LAYER_ORDER = ['client', 'edge', 'compute', 'async', 'data', 'observe', 'external'];
const MIN_VERTICAL_SPACING = 110;
const MAX_NODES_PER_COLUMN = 4;

export type ComplexityTier = 'simple' | 'moderate' | 'complex';

export interface ELKLayoutConfig {
  elkOptions?: Record<string, string>;
  nodeWidth?: number;
  nodeHeight?: number;
  complexityTier?: ComplexityTier;
  maxNodesPerColumn?: number;
}

export function getELKOptionsForComplexity(tier: ComplexityTier): Record<string, string> {
  const baseOptions: Record<string, string> = {};
  
  if (tier === 'simple') {
    baseOptions['elk.spacing.nodeNode'] = '90';
    baseOptions['elk.spacing.edgeNode'] = '80';
    baseOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = '240';
    baseOptions['elk.padding'] = '[top=70, left=70, bottom=70, right=70]';
  } else if (tier === 'moderate') {
    baseOptions['elk.spacing.nodeNode'] = '110';
    baseOptions['elk.spacing.edgeNode'] = '90';
    baseOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = '300';
    baseOptions['elk.padding'] = '[top=80, left=80, bottom=80, right=80]';
  } else {
    baseOptions['elk.spacing.nodeNode'] = '130';
    baseOptions['elk.spacing.edgeNode'] = '110';
    baseOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = '360';
    baseOptions['elk.padding'] = '[top=100, left=100, bottom=100, right=100]';
  }

  return {
    ...OPTIMIZED_ELK_OPTIONS,
    ...baseOptions,
  };
}

export interface LayoutResult {
  nodes: ReactFlowNode[];
  edgePaths: EdgePath[];
  elkGraph: { id: string; x?: number; y?: number; width?: number; height?: number }[];
}

interface ELKNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ELKNode[];
  edges?: ELKEdge[];
  ports?: ELKPort[];
  layoutOptions?: Record<string, string>;
}

interface ELKEdge {
  id: string;
  sources: string[];
  targets: string[];
  labels?: { text: string; width?: number; height?: number }[];
}

interface ELKPort {
  id: string;
  width?: number;
  height?: number;
  properties?: {
    'org.eclipse.elk.port.side': 'EAST' | 'WEST' | 'NORTH' | 'SOUTH';
    'org.eclipse.elk.port.anchor': 'CENTER' | 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
  };
}

interface ELKGraph {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ELKNode[];
  edges?: ELKEdge[];
  ports?: ELKPort[];
}

function distributeNodesVertically(
  nodes: ArchitectureNode[],
  startY: number,
  maxPerColumn: number = MAX_NODES_PER_COLUMN
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const columns = Math.ceil(nodes.length / maxPerColumn);
  const columnWidth = 280;

  for (let i = 0; i < nodes.length; i++) {
    const column = Math.floor(i / maxPerColumn);
    const row = i % maxPerColumn;
    positions.push({
      x: column * columnWidth,
      y: startY + row * MIN_VERTICAL_SPACING,
    });
  }

  return positions;
}

function createDistributedPorts(nodeId: string, side: 'EAST' | 'WEST', count: number): ELKPort[] {
  if (count === 0) {
    return [{
      id: `${nodeId}-port-${side.toLowerCase()}-default`,
      width: 10,
      height: 10,
      properties: {
        'org.eclipse.elk.port.side': side,
        'org.eclipse.elk.port.anchor': 'CENTER',
      },
    }];
  }

  const ports: ELKPort[] = [];
  const positions = count === 1 ? [0.5] : count === 2 ? [0.3, 0.7] : [0.25, 0.5, 0.75];

  positions.slice(0, count).forEach((pos, idx) => {
    const anchor = pos === 0.5 ? 'CENTER' : pos < 0.5 ? 'TOP' : 'BOTTOM';
    ports.push({
      id: `${nodeId}-port-${side.toLowerCase()}-${idx}`,
      width: 8,
      height: 8,
      properties: {
        'org.eclipse.elk.port.side': side,
        'org.eclipse.elk.port.anchor': anchor as 'CENTER' | 'TOP' | 'BOTTOM',
      },
    });
  });

  return ports;
}

function calculateGroupDimensions(nodes: ArchitectureNode[]): ArchitectureNode[] {
  const CHILD_WIDTH        = 200;   // actual node width
  const CHILD_HEIGHT       = 80;    // actual node height
  const CHILD_MARGIN       = 20;    // gap between siblings (halved from 40)
  const GROUP_PADDING_H    = 30;    // left + right padding each (halved from 60)
  const GROUP_PADDING_TOP  = 36;    // clears label tag (~28px) + breathing room (halved from 72)
  const GROUP_PADDING_BOT  = 30;    // (halved from 60)
  const ROW_GAP            = 20;    // (halved from 40)

  return nodes.map(node => {
    if (node.isGroup !== true) return node;

    const children = nodes.filter(c => c.parentId === node.id);
    if (children.length === 0) return node;

    const columnsCount = Math.min(3, children.length);
    const rows = Math.ceil(children.length / columnsCount);
    const groupWidth  = (columnsCount * CHILD_WIDTH) + ((columnsCount - 1) * CHILD_MARGIN) + 2 * GROUP_PADDING_H;
    const groupHeight = (rows * CHILD_HEIGHT) + ((rows - 1) * ROW_GAP) + GROUP_PADDING_TOP + GROUP_PADDING_BOT;

    return {
      ...node,
      width:  Math.max(groupWidth,  160),
      height: Math.max(groupHeight, 100),
    };
  });
}

function postProcessLayout(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): ReactFlowNode[] {
  const nodesByTier: Record<string, ReactFlowNode[]> = {};
  const NODE_HEIGHT = 70;
  const NODE_WIDTH = 160;
  const VERTICAL_SPACING = 130;
  const HORIZONTAL_SPACING = 160;

  for (const node of nodes) {
    const tier = getNormalizedTier(node.data?.layer || 'compute');
    if (!nodesByTier[tier]) nodesByTier[tier] = [];
    nodesByTier[tier].push(node);
  }

  const processedNodes = [...nodes];

  for (const tier of LAYER_ORDER) {
    const tierNodes = nodesByTier[tier] || [];
    if (tierNodes.length <= 1) continue;

    tierNodes.sort((a, b) => a.position.y - b.position.y);

    let currentY = tierNodes[0].position.y;
    for (let i = 0; i < tierNodes.length; i++) {
      const node = tierNodes[i];
      const nodeIndex = processedNodes.findIndex(n => n.id === node.id);
      if (nodeIndex === -1) continue;

      if (i > 0) {
        const prevNode = tierNodes[i - 1];
        const minY = prevNode.position.y + (prevNode.height || NODE_HEIGHT) + VERTICAL_SPACING;
        currentY = Math.max(currentY, minY);
      }

      processedNodes[nodeIndex] = {
        ...processedNodes[nodeIndex],
        position: { ...processedNodes[nodeIndex].position, y: currentY },
      };

      currentY += (node.height || NODE_HEIGHT) + VERTICAL_SPACING;
    }

    const x = TIER_X[tier] ?? 500;
    tierNodes.forEach(node => {
      const nodeIndex = processedNodes.findIndex(n => n.id === node.id);
      if (nodeIndex !== -1) {
        processedNodes[nodeIndex] = {
          ...processedNodes[nodeIndex],
          position: { ...processedNodes[nodeIndex].position, x },
        };
      }
    });
  }

  return processedNodes;
}

function resolveEdgeConflicts(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): ReactFlowEdge[] {
  const sourceCounts = new Map<string, number>();
  const processed = edges.map(edge => {
    const count = (sourceCounts.get(edge.source) || 0) + 1;
    sourceCounts.set(edge.source, count);

    let offset = 0;
    if (count > 1) {
      const offsetIndex = count - 1;
      offset = (offsetIndex % 2 === 0 ? 1 : -1) * Math.floor(offsetIndex / 2) * 20;
    }

    return { ...edge, data: { ...edge.data, sourceOffset: offset } };
  });

  return processed;
}

export async function computeELKLayout(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  config: ELKLayoutConfig = {}
): Promise<LayoutResult> {
  const nodeWidth = config.nodeWidth ?? DEFAULT_NODE_WIDTH;
  const nodeHeight = config.nodeHeight ?? DEFAULT_NODE_HEIGHT;

  const signature = getTopologySignature(nodes);
  const cached = LAYOUT_CACHE.get(signature);
  if (cached && Date.now() - cached.timestamp < LAYOUT_CACHE_TTL) {
    logger.log(`[ELK] Cache hit for signature: ${signature}`);
    const cachedNodes = adjustCachedLayout(cached.nodes, nodes, nodeWidth, nodeHeight);
    return {
      nodes: cachedNodes,
      edgePaths: [],
      elkGraph: cachedNodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y })),
    };
  }

  const nodesWithGroupDims = calculateGroupDimensions(nodes);

  const groupNodes = nodesWithGroupDims.filter(n => n.isGroup === true);
  const childNodes = nodesWithGroupDims.filter(n => n.parentId !== undefined);
  const rootNodes = nodesWithGroupDims.filter(n => !n.isGroup && !n.parentId);

  const incomingEdgeCount = new Map<string, number>();
  const outgoingEdgeCount = new Map<string, number>();
  edges.forEach(edge => {
    incomingEdgeCount.set(edge.target, (incomingEdgeCount.get(edge.target) || 0) + 1);
    outgoingEdgeCount.set(edge.source, (outgoingEdgeCount.get(edge.source) || 0) + 1);
  });

  const nodeLayerMap = new Map<string, number>();
  nodesWithGroupDims.forEach((node, index) => {
    const tier = getNormalizedTier(node.tier || node.layer || 'compute');
    const layerIndex = LAYER_ORDER.indexOf(tier);
    nodeLayerMap.set(node.id, layerIndex >= 0 ? layerIndex : 2);
  });

  const validateAndFixOrphanNodes = (
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[]
  ): ArchitectureEdge[] => {
    const connectedNodes = new Set<string>();
    edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    const orphanNodes = nodes.filter(node => !connectedNodes.has(node.id));
    const fixedEdges = [...edges];

    if (orphanNodes.length === 0) return fixedEdges;

    const nodesByLayer = new Map<string, ArchitectureNode[]>();
    nodes.forEach(node => {
      const layer = node.layer || 'service';
      if (!nodesByLayer.has(layer)) nodesByLayer.set(layer, []);
      nodesByLayer.get(layer)!.push(node);
    });

    for (const orphan of orphanNodes) {
      const orphanLayer = orphan.layer || 'service';
      const orphanLayerIndex = LAYER_ORDER.indexOf(orphanLayer);

      let targetNode: ArchitectureNode | undefined;
      for (let i = orphanLayerIndex + 1; i < LAYER_ORDER.length; i++) {
        const layerNodes = nodesByLayer.get(LAYER_ORDER[i]) || [];
        const connected = layerNodes.find(n => connectedNodes.has(n.id));
        if (connected) { targetNode = connected; break; }
      }

      if (!targetNode) {
        for (let i = orphanLayerIndex - 1; i >= 0; i--) {
          const layerNodes = nodesByLayer.get(LAYER_ORDER[i]) || [];
          const connected = layerNodes.find(n => connectedNodes.has(n.id));
          if (connected) { targetNode = connected; break; }
        }
      }

      if (targetNode) {
        fixedEdges.push({
          id: `auto-edge-${orphan.id}-to-${targetNode.id}`,
          source: orphan.id,
          target: targetNode.id,
          sourceHandle: 'right',
          targetHandle: 'left',
          communicationType: 'sync',
          pathType: 'smooth',
          label: '',
          labelPosition: 'center',
          animated: false,
          style: { stroke: '#94a3b8', strokeDasharray: '', strokeWidth: 2 },
          markerEnd: 'arrowclosed',
          markerStart: 'none',
        });
        connectedNodes.add(orphan.id);
      }
    }

    return fixedEdges;
  };

  const validatedEdges = validateAndFixOrphanNodes(nodes, edges);

  const toElkNode = (node: ArchitectureNode): ELKNode => {
    const config = getNodeShapeConfig(node.serviceType);
    const width = node.width ?? config.width;
    const height = node.height ?? config.height;
    const inCount = validatedEdges.filter(e => e.target === node.id).length || incomingEdgeCount.get(node.id) || 0;
    const outCount = validatedEdges.filter(e => e.source === node.id).length || outgoingEdgeCount.get(node.id) || 0;

    const ports: ELKPort[] = [];
    if (inCount > 0) ports.push(...createDistributedPorts(node.id, 'WEST', inCount));
    if (outCount > 0) ports.push(...createDistributedPorts(node.id, 'EAST', outCount));
    if (inCount === 0 && outCount === 0) {
      ports.push(...createDistributedPorts(node.id, 'WEST', 1));
      ports.push(...createDistributedPorts(node.id, 'EAST', 1));
    }

    const tier = getNormalizedTier(node.tier || node.layer || 'compute');
    const x = TIER_X[tier] ?? 500;

    return {
      id: node.id,
      width,
      height,
      x,
      y: 50,
      ports,
      layoutOptions: {
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `${width}, ${height}`,
        'elk.portConstraints': 'FIXED_SIDE',
      },
    };
  };

  const toElkGroupNode = (group: ArchitectureNode): ELKNode => {
    const children = childNodes.filter(c => c.parentId === group.id).map(toElkNode);
    return {
      id: group.id,
      width: group.width ?? 400,
      height: group.height ?? 280,
      children,
      layoutOptions: {
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `${group.width ?? 400}, ${group.height ?? 280}`,
        'elk.portConstraints': 'FIXED_SIDE',
      },
    };
  };

  const elkNodes = [
    ...rootNodes.map(toElkNode),
    ...groupNodes.map(toElkGroupNode),
  ];

  const edgeSourceIndex = new Map<string, number>();
  const edgeTargetIndex = new Map<string, number>();
  const nodeIds = new Set(nodesWithGroupDims.map(n => n.id));

  const validEdges = validatedEdges.filter(e => e.source !== e.target);

  // Push sink nodes (no outgoing edges) to the last layer
  const sinkIds = new Set(
    nodesWithGroupDims.map(n => n.id).filter(id => !validEdges.some(e => e.source === id))
  );
  for (const elkNode of elkNodes) {
    if (sinkIds.has(elkNode.id) && elkNode.layoutOptions) {
      elkNode.layoutOptions['elk.layered.layering.layerId'] = '99';
    }
  }

  const elkEdges = validEdges
    .filter(edge => {
      const sourceIsGroup = groupNodes.some(g => g.id === edge.source);
      const targetIsGroup = groupNodes.some(g => g.id === edge.target);
      if (sourceIsGroup || targetIsGroup) {
        logger.log(`[ELK] Filtering edge ${edge.id}: group node not in edge (sourceGroup=${sourceIsGroup}, targetGroup=${targetIsGroup})`);
        return false;
      }
      return true;
    })
    .map((edge) => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        return null;
      }
      
      const sourceIdx = edgeSourceIndex.get(edge.source) || 0;
      const targetIdx = edgeTargetIndex.get(edge.target) || 0;
      edgeSourceIndex.set(edge.source, sourceIdx + 1);
      edgeTargetIndex.set(edge.target, targetIdx + 1);

      return {
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
        sourcePort: `${edge.source}-port-east-${sourceIdx}`,
        targetPort: `${edge.target}-port-west-${targetIdx}`,
      };
    }).filter(Boolean) as ELKEdge[];

  try {
    const layoutStartTime = Date.now();
    logger.log(`[ELK] Starting layout: ${nodes.length} nodes, ${edges.length} edges`);

    const graph = {
      id: 'root',
      children: elkNodes,
      edges: elkEdges,
    };

    const elkGraph = await runELKLayoutAsync(graph) as ELKGraph;

    logger.log(`[ELK] Completed in ${Date.now() - layoutStartTime}ms`);

    LAYOUT_CACHE.set(signature, {
      nodes: [],
      timestamp: Date.now(),
    });

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const extractAllNodes = (node: ELKGraph): { id: string; x?: number; y?: number; width?: number; height?: number }[] => {
      const result: { id: string; x?: number; y?: number; width?: number; height?: number }[] = [];
      if (node.id && node.id !== 'root' && node.x !== undefined && node.y !== undefined) {
        result.push({ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height });
      }
      if (node.children) {
        for (const child of node.children) {
          result.push(...extractAllNodes(child));
        }
      }
      return result;
    };

    const allELKNodes = extractAllNodes(elkGraph);
    const reactFlowNodes: ReactFlowNode[] = [];

    for (const elkNode of allELKNodes) {
      const originalNode = nodeMap.get(elkNode.id);
      if (!originalNode) continue;

      const isGroup = originalNode.isGroup === true;
      const isChild = originalNode.parentId !== undefined;
      const tier = getNormalizedTier(originalNode.tier || originalNode.layer || 'compute');
      
      let x: number;
      if (isChild && isGroup === false) {
        x = elkNode.x ?? 0;
      } else if (isGroup) {
        x = TIER_X[tier] ?? elkNode.x ?? 500;
      } else {
        x = TIER_X[tier] ?? elkNode.x ?? 500;
      }
      
      const y = isChild ? (elkNode.y ?? 0) : (elkNode.y ?? 0);

      reactFlowNodes.push({
        id: elkNode.id,
        type: isGroup ? 'group' : 'systemNode',
        position: { x, y },
        data: {
          label: originalNode.label,
          icon: originalNode.icon ?? 'box',
          layer: originalNode.layer,
          layerIndex: originalNode.layerIndex,
          isGroup: originalNode.isGroup,
          parentId: originalNode.parentId,
          groupLabel: originalNode.groupLabel,
          groupColor: originalNode.groupColor,
          serviceType: originalNode.serviceType,
        },
        width: originalNode.width ?? nodeWidth,
        height: originalNode.height ?? nodeHeight,
        zIndex: isGroup ? 0 : 1,
        extent: isChild ? 'parent' : undefined,
        style: isGroup ? { width: originalNode.width ?? nodeWidth, height: originalNode.height ?? nodeHeight } : undefined,
      });
    }

    const postProcessedNodes = postProcessLayout(reactFlowNodes, []);

    const columnAlignedNodes = snapNodesToColumns(
      postProcessedNodes,
      n => n.position.x,
      (n, x) => ({ ...n, position: { ...n.position, x } }),
      60
    );

    const result = {
      nodes: columnAlignedNodes,
      edgePaths: [],
      elkGraph: allELKNodes,
    };

    LAYOUT_CACHE.set(signature, {
      nodes: columnAlignedNodes,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    logger.error('[ELK] Error:', error);
    return computeFallbackLayout(nodes, edges, nodeWidth, nodeHeight);
  }
}

function computeFallbackLayout(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  _nodeWidth: number,
  _nodeHeight: number
): LayoutResult {
  logger.warn('[ELK] Using fallback layout');

  const nodesByLayer: Record<string, ArchitectureNode[]> = {};
  for (const node of nodes) {
    const layer = getNormalizedTier(node.tier || node.layer || 'compute');
    if (!nodesByLayer[layer]) nodesByLayer[layer] = [];
    nodesByLayer[layer].push(node);
  }

  const reactFlowNodes: ReactFlowNode[] = [];

  for (const layer of LAYER_ORDER) {
    const layerNodes = nodesByLayer[layer] || [];
    if (layerNodes.length === 0) continue;

    const layerX = TIER_X[layer] ?? 500;
    let y = 50;

    layerNodes.forEach((node, index) => {
      const config = getNodeShapeConfig(node.serviceType);
      const nodeW = node.width ?? config.width;
      const nodeH = node.height ?? config.height;
      reactFlowNodes.push({
        id: node.id,
        type: node.isGroup === true ? 'group' : 'systemNode',
        position: { x: layerX, y },
        data: {
          label: node.label,
          icon: node.icon ?? 'box',
          layer: node.layer,
          layerIndex: node.layerIndex,
          isGroup: node.isGroup,
          parentId: node.parentId,
          groupLabel: node.groupLabel,
          groupColor: node.groupColor,
          serviceType: node.serviceType,
        },
        width: nodeW,
        height: nodeH,
      });
      y += nodeH + 100;
    });
  }

  return {
    nodes: reactFlowNodes,
    edgePaths: [],
    elkGraph: [],
  };
}

export function computeEdgePathsWithELK(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  elkOptions?: Record<string, string>
): EdgePath[] {
  const edgePaths: EdgePath[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceHandlePos = getHandlePosition(sourceNode, edge.sourceHandle);
    const targetHandlePos = getHandlePosition(targetNode, edge.targetHandle);

    const waypoints = computeSplineWaypoints(sourceHandlePos, targetHandlePos, sourceNode, targetNode, edge, elkOptions);

    edgePaths.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      waypoints,
      labelPosition: computeLabelPositionFromWaypoints(waypoints),
      pathType: 'orthogonal',
    });
  }

  return edgePaths;
}

function getHandlePosition(node: ReactFlowNode, handleId: string): Point {
  const width = node.width ?? DEFAULT_NODE_WIDTH;
  const height = node.height ?? DEFAULT_NODE_HEIGHT;
  const x = node.position.x;
  const y = node.position.y;

  switch (handleId) {
    case 'top': return { x: x + width / 2, y };
    case 'bottom': return { x: x + width / 2, y: y + height };
    case 'left':
    case 'left-mid': return { x, y: y + height / 2 };
    default: return { x: x + width, y: y + height / 2 };
  }
}

function computeSplineWaypoints(
  sourcePos: Point,
  targetPos: Point,
  sourceNode: ReactFlowNode,
  targetNode: ReactFlowNode,
  _edge: ReactFlowEdge,
  elkOptions?: Record<string, string>
): Point[] {
  const waypoints: Point[] = [sourcePos];
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const edgeNodeMargin = parseInt(elkOptions?.['elk.spacing.edgeNode'] ?? '100', 10);
  const labelMargin = parseInt(elkOptions?.['elk.spacing.labelNode'] ?? '50', 10);

  const sourceHeight = sourceNode.height ?? DEFAULT_NODE_HEIGHT;
  const targetHeight = targetNode.height ?? DEFAULT_NODE_HEIGHT;
  const sourceCenterY = sourceNode.position.y + sourceHeight / 2;
  const targetCenterY = targetNode.position.y + targetHeight / 2;

  if (Math.abs(dx) > Math.abs(dy)) {
    const midX = sourcePos.x + dx / 2;
    waypoints.push({ x: midX, y: sourcePos.y });
    const verticalOffset = Math.abs(dy) > (sourceHeight + targetHeight) / 2 ? 0 : Math.sign(dy) * edgeNodeMargin;
    waypoints.push({ x: midX, y: targetCenterY + verticalOffset - labelMargin });
  } else {
    const midY = (sourceCenterY + targetCenterY) / 2;
    const exitX = sourcePos.x + edgeNodeMargin;
    const entryX = targetPos.x - edgeNodeMargin;
    waypoints.push({ x: exitX, y: sourcePos.y });
    waypoints.push({ x: exitX, y: midY });
    waypoints.push({ x: entryX, y: midY });
  }

  waypoints.push(targetPos);
  return simplifyWaypoints(waypoints);
}

function simplifyWaypoints(waypoints: Point[]): Point[] {
  if (waypoints.length <= 2) return waypoints;

  const simplified: Point[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];
    const isCollinear = (prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y);
    if (!isCollinear) simplified.push(curr);
  }
  simplified.push(waypoints[waypoints.length - 1]);
  return simplified;
}

function computeLabelPositionFromWaypoints(waypoints: Point[]): Point {
  if (waypoints.length < 2) return waypoints[0] ?? { x: 0, y: 0 };
  const midIndex = Math.floor(waypoints.length / 2);
  const p1 = waypoints[midIndex - 1] ?? waypoints[0];
  const p2 = waypoints[midIndex] ?? waypoints[waypoints.length - 1];
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

export function generateSVGPath(waypoints: Point[]): string {
  if (waypoints.length === 0) return '';
  if (waypoints.length === 1) return `M ${waypoints[0].x} ${waypoints[0].y}`;
  let path = `M ${waypoints[0].x} ${waypoints[0].y}`;
  for (let i = 1; i < waypoints.length; i++) {
    path += ` L ${waypoints[i].x} ${waypoints[i].y}`;
  }
  return path;
}

export function generateBezierPath(waypoints: Point[]): string {
  if (waypoints.length < 2) return '';
  if (waypoints.length === 2) {
    return `M ${waypoints[0].x} ${waypoints[0].y} C ${waypoints[0].x + 50} ${waypoints[0].y}, ${waypoints[1].x - 50} ${waypoints[1].y}, ${waypoints[1].x} ${waypoints[1].y}`;
  }
  let path = `M ${waypoints[0].x} ${waypoints[0].y}`;
  for (let i = 1; i < waypoints.length; i++) {
    path += ` L ${waypoints[i].x} ${waypoints[i].y}`;
  }
  return path;
}

export function generateSmoothstepPath(waypoints: Point[]): string {
  if (waypoints.length < 2) return '';
  return `M ${waypoints[0].x} ${waypoints[0].y} L ${waypoints[waypoints.length - 1].x} ${waypoints[waypoints.length - 1].y}`;
}

export function runSpeculativeELK(
  nodes: ArchitectureNode[],
  onLayoutReady: (layout: LayoutResult) => void
): void {
  if (nodes.length < 4) return;

  runELKLayoutQuick(nodes).then(layout => {
    if (layout) {
      onLayoutReady(layout);
    }
  }).catch(() => {});
}

async function runELKLayoutQuick(nodes: ArchitectureNode[]): Promise<LayoutResult | null> {
  const elkNodes = nodes.map(node => {
    const config = getNodeShapeConfig(node.serviceType);
    return {
      id: node.id,
      width: node.width ?? config.width,
      height: node.height ?? config.height,
      x: TIER_X[node.layer || 'compute'] ?? 500,
      y: 50,
      ports: [
        { id: `${node.id}-port-west-default`, width: 10, height: 10, properties: { 'org.eclipse.elk.port.side': 'WEST' as const, 'org.eclipse.elk.port.anchor': 'CENTER' as const } },
        { id: `${node.id}-port-east-default`, width: 10, height: 10, properties: { 'org.eclipse.elk.port.side': 'EAST' as const, 'org.eclipse.elk.port.anchor': 'CENTER' as const } },
      ],
      layoutOptions: {
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `${node.width ?? config.width}, ${node.height ?? config.height}`,
      },
    };
  });

  try {
    const graph = {
      id: 'root',
      children: elkNodes,
      edges: [],
    };

    const elkGraph = await runELKLayoutAsync(graph) as ELKGraph;

    const reactFlowNodes: ReactFlowNode[] = elkGraph.children?.map((elkNode, i) => {
      const originalNode = nodes[i];
      const config = getNodeShapeConfig(originalNode?.serviceType);
      const tier = originalNode?.tier || originalNode?.layer || 'compute';
      return {
        id: elkNode.id,
        type: 'customNode',
        position: { x: elkNode.x ?? TIER_X[tier] ?? 500, y: elkNode.y ?? 0 },
        data: {
          label: originalNode.label,
          icon: originalNode.icon ?? 'box',
          layer: originalNode.layer,
        },
        width: elkNode.width ?? config.width,
        height: elkNode.height ?? config.height,
      };
    }) ?? [];

    return {
      nodes: reactFlowNodes,
      edgePaths: [],
      elkGraph: elkGraph.children?.map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height })) ?? [],
    };
  } catch {
    return null;
  }
}

export function clearLayoutCache(): void {
  LAYOUT_CACHE.clear();
}
