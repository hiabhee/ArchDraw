import type { ArchitectureNode, ArchitectureEdge, ReactFlowNode, ReactFlowEdge, TierType } from '../types/index.js';
import type { ElkNode as LocalElkNode, ElkEdge as LocalElkEdge } from '../types/index.js';
import type { ElkNode as ElkApiNode } from 'elkjs/lib/elk-api.js';
import {
  COMM_COLORS,
  TIER_COLORS,
  TIER_ORDER,
  TIER_X_POSITIONS_LR,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  type LayoutDirection,
} from './constants.js';

export interface LayoutOptions {
  direction?: LayoutDirection;
  spacingMultiplier?: number;
}

export interface LayoutResult {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  elkPositions: Array<{ id: string; x: number; y: number; width: number; height: number }>;
}

const MIN_VERTICAL_GAP = 80;
const COLLISION_BUFFER = 20;
const MIN_CANVAS_HEIGHT = 1200;

interface PlacedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tier: TierType;
}

function normalizeTier(layer?: string): TierType {
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

function getNodesByTier(nodes: ArchitectureNode[]): Map<TierType, ArchitectureNode[]> {
  const nodesByTier = new Map<TierType, ArchitectureNode[]>();
  for (const tier of TIER_ORDER) {
    nodesByTier.set(tier, []);
  }
  for (const node of nodes) {
    if (node.isGroup) continue;
    const tier = normalizeTier(node.tier || node.layer);
    const tierNodes = nodesByTier.get(tier) || [];
    tierNodes.push(node);
    nodesByTier.set(tier, tierNodes);
  }
  return nodesByTier;
}

function calculateCanvasHeight(nodesByTier: Map<TierType, ArchitectureNode[]>): number {
  let maxNodesInLayer = 0;
  for (const [, tierNodes] of nodesByTier) {
    maxNodesInLayer = Math.max(maxNodesInLayer, tierNodes.length);
  }
  const requiredHeight = maxNodesInLayer * (DEFAULT_NODE_HEIGHT + MIN_VERTICAL_GAP) + 200;
  return Math.max(requiredHeight, MIN_CANVAS_HEIGHT);
}

function checkCollision(
  newNode: { x: number; y: number; width: number; height: number },
  placedNodes: PlacedNode[],
  buffer: number = COLLISION_BUFFER
): boolean {
  for (const placed of placedNodes) {
    const expanded = {
      x: placed.x - buffer,
      y: placed.y - buffer,
      width: placed.width + buffer * 2,
      height: placed.height + buffer * 2,
    };
    const overlaps = !(
      newNode.x + newNode.width <= expanded.x ||
      newNode.x >= expanded.x + expanded.width ||
      newNode.y + newNode.height <= expanded.y ||
      newNode.y >= expanded.y + expanded.height
    );
    if (overlaps) return true;
  }
  return false;
}

function findNonCollidingY(
  x: number,
  startY: number,
  width: number,
  height: number,
  placedNodes: PlacedNode[],
  canvasHeight: number
): number {
  let y = startY;
  const maxAttempts = 100;
  let attempts = 0;
  
  while (checkCollision({ x, y, width, height }, placedNodes) && attempts < maxAttempts) {
    y += MIN_VERTICAL_GAP / 2;
    if (y + height > canvasHeight - 50) {
      y = 50;
    }
    attempts++;
  }
  
  return Math.max(50, Math.min(y, canvasHeight - height - 50));
}

function distributeNodesVertically(
  nodes: ArchitectureNode[],
  startX: number,
  canvasHeight: number,
  placedNodes: PlacedNode[],
  tier: TierType
): PlacedNode[] {
  if (nodes.length === 0) return [];
  
  const nodeCount = nodes.length;
  const gap = tier === 'compute' && nodeCount > 4 ? 100 : MIN_VERTICAL_GAP;
  const totalHeight = nodeCount * DEFAULT_NODE_HEIGHT + (nodeCount - 1) * gap;
  const startY = Math.max(50, (canvasHeight - totalHeight) / 2);
  
  const placed: PlacedNode[] = [];
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const width = node.width || DEFAULT_NODE_WIDTH;
    const height = node.height || DEFAULT_NODE_HEIGHT;
    
    let y = startY + i * (height + gap);
    y = findNonCollidingY(startX, y, width, height, [...placedNodes, ...placed], canvasHeight);
    
    placed.push({
      id: node.id,
      x: startX,
      y,
      width,
      height,
      tier,
    });
  }
  
  return placed;
}

function createReactFlowEdge(
  edge: ArchitectureEdge,
  _sourceNode: PlacedNode,
  _targetNode: PlacedNode
): ReactFlowEdge {
  const commType = edge.communicationType || 'sync';
  const commStyle = COMM_COLORS[commType] || COMM_COLORS.sync;
  const pathType = edge.pathType || 'smooth';
  
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'simpleFloating',
    animated: commStyle.animated,
    label: edge.label || '',
    labelShowBg: true,
    labelBgPadding: [8, 4] as [number, number],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: '#1e1e2e', fillOpacity: 0.9 },
    labelStyle: { fontSize: 10, fontWeight: 600, fill: '#e2e8f0' },
    style: {
      stroke: commStyle.color,
      strokeWidth: 2,
      strokeDasharray: commStyle.dash,
    },
    markerEnd: { type: 'arrowclosed' as string, color: commStyle.color }, // Will be overridden or ignored by frontend components
    data: {
      communicationType: commType as 'sync' | 'async' | 'stream' | 'event' | 'dep',
      pathType,
      edgeType: commType,
      label: edge.label || '',
    },
  };
}

export function generateELKOptions(direction: LayoutDirection = 'RIGHT', density: 'low' | 'medium' | 'high' = 'medium'): Record<string, string> {
  const spacingMultiplier = density === 'high' ? 1.5 : density === 'medium' ? 1.2 : 1.0;
  
  const options: Record<string, string> = {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.portConstraints': 'FIXED_SIDE',
    'elk.spacing.nodeNode': String(Math.round(60 * spacingMultiplier)),
    'elk.spacing.edgeEdge': String(Math.round(40 * spacingMultiplier)),
    'elk.spacing.edgeNode': String(Math.round(60 * spacingMultiplier)),
    'elk.spacing.labelNode': '50',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.round(120 * spacingMultiplier)),
    'elk.layered.spacing.edgeNodeBetweenLayers': String(Math.round(100 * spacingMultiplier)),
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.crossingMinimization.forceNodeModelOrder': 'false',
    'elk.layered.separatingEdges.strategy': 'CENTERING',
    'elk.layered.unnecessaryBendpoints': 'false',
    'elk.layered.edgeRouting.selfLoopDistribution': 'EVEN',
    'elk.layered.mergeEdges': 'true',
    'elk.edgeLabels.inline': 'false',
    'elk.edgeLabels.placement': 'CENTER',
    'elk.padding': '[top=60, left=60, bottom=60, right=60]',
    'elk.layered.layering.strategy': 'LONGEST_PATH',
    'elk.layered.initialization.strategy': 'MULTI_LEVEL',
    'elk.aspectRatio': '2.0',
  };
  
  return options;
}

export function computeDensity(nodes: ArchitectureNode[]): 'low' | 'medium' | 'high' {
  const maxNodesPerTier = Math.max(
    ...TIER_ORDER.map(tier => {
      return nodes.filter(n => normalizeTier(n.tier || n.layer) === tier && !n.isGroup).length;
    }),
    0
  );
  
  return maxNodesPerTier > 6 ? 'high' : maxNodesPerTier > 3 ? 'medium' : 'low';
}

export function nodesToElkFormat(nodes: ArchitectureNode[]): LocalElkNode[] {
  return nodes.map(node => ({
    id: node.id,
    width: node.width || DEFAULT_NODE_WIDTH,
    height: node.height || DEFAULT_NODE_HEIGHT,
    layoutOptions: {
      'elk.nodeLabels.placement': 'INSIDE',
      'elk.portConstraints': 'FIXED_SIDE',
      'elk.portAlignment.default': 'CENTER',
    },
  }));
}

export function edgesToElkFormat(edges: ArchitectureEdge[]): LocalElkEdge[] {
  return edges.map(edge => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));
}

export async function runELKLayout(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  options: LayoutOptions = {}
): Promise<LayoutResult> {
  const direction = options.direction || 'RIGHT';
  const density = computeDensity(nodes);
  const elkOptions = generateELKOptions(direction, density);
  
  const elkNodes = nodesToElkFormat(nodes);
  const elkEdges = edgesToElkFormat(edges);
  
  try {
    const elkModule = await import('elkjs/lib/elk.bundled.js');
    const elk = new (elkModule.default as unknown as { new(): { layout(graph: object): Promise<ElkApiNode> } })();
    const layout = await elk.layout({
      id: 'root',
      layoutOptions: elkOptions,
      children: elkNodes,
      edges: elkEdges,
    });
    
    const nodeMap = new Map<string, { x: number; y: number; width: number; height: number; tier: TierType }>();
    
    if (layout.children) {
      for (const node of layout.children) {
        if (node.x !== undefined && node.y !== undefined) {
          const originalNode = nodes.find(n => n.id === node.id);
          const tier = originalNode ? normalizeTier(originalNode.tier || originalNode.layer) : 'compute';
          nodeMap.set(node.id, {
            x: node.x,
            y: node.y,
            width: node.width || DEFAULT_NODE_WIDTH,
            height: node.height || DEFAULT_NODE_HEIGHT,
            tier,
          });
        }
      }
    }
    
    const placedNodes: PlacedNode[] = [];
    for (const [id, pos] of nodeMap) {
      placedNodes.push({
        id,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        tier: pos.tier,
      });
    }
    
    const reactFlowNodes: ReactFlowNode[] = nodes.map(node => {
      const pos = nodeMap.get(node.id);
      const width = node.width || DEFAULT_NODE_WIDTH;
      const height = node.height || DEFAULT_NODE_HEIGHT;
      const tier = pos?.tier || normalizeTier(node.tier || node.layer);
      
      return {
        id: node.id,
        type: node.isGroup ? 'groupNode' : 'systemNode',
        position: {
          x: pos?.x ?? TIER_X_POSITIONS_LR[tier],
          y: pos?.y ?? 200,
        },
        data: {
          label: node.label,
          icon: node.icon || 'box',
          layer: node.layer,
          tier,
          tierColor: node.tierColor || TIER_COLORS[tier],
          subtitle: node.subtitle,
          serviceType: node.serviceType,
          isGroup: node.isGroup,
          parentId: node.parentId,
          groupLabel: node.groupLabel,
          groupColor: node.groupColor,
        },
        width: pos?.width ?? width,
        height: pos?.height ?? height,
        zIndex: node.isGroup ? 0 : 1,
        ...(node.parentId ? { parentNode: node.parentId } : {}),
      };
    });
    
    const nodePositionMap = new Map(placedNodes.map(p => [p.id, p]));
    
    const reactFlowEdges: ReactFlowEdge[] = edges.map(edge => {
      const sourceNode = nodePositionMap.get(edge.source);
      const targetNode = nodePositionMap.get(edge.target);
      
      if (sourceNode && targetNode) {
        return createReactFlowEdge(edge, sourceNode, targetNode);
      }
      
      const commType = edge.communicationType || 'sync';
      const commStyle = COMM_COLORS[commType] || COMM_COLORS.sync;
      const pathType = edge.pathType || 'smooth';
      
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'simpleFloating',
        animated: commStyle.animated,
        label: edge.label || '',
        labelShowBg: true,
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#1e1e2e', fillOpacity: 0.9 },
        labelStyle: { fontSize: 10, fontWeight: 600, fill: '#e2e8f0' },
        style: {
          stroke: commStyle.color,
          strokeWidth: 2,
          strokeDasharray: commStyle.dash,
        },
        markerEnd: { type: 'arrowclosed', color: commStyle.color },
        data: {
          communicationType: commType as 'sync' | 'async' | 'stream' | 'event' | 'dep',
          pathType,
          edgeType: commType,
          label: edge.label || '',
        },
      };
    });
    
    const elkPositions = Array.from(nodeMap.entries()).map(([id, pos]) => ({
      id,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
    }));
    
    return {
      nodes: reactFlowNodes,
      edges: reactFlowEdges,
      elkPositions,
    };
  } catch (error) {
    console.error('[ELK Runner] Layout computation failed:', error);
    return runFallbackLayout(nodes, edges, options);
  }
}

function tierAnchorForDirection(direction: LayoutDirection): Record<TierType, number> {
  const lr = TIER_X_POSITIONS_LR;
  if (direction === 'LEFT') {
    const max = Math.max(...TIER_ORDER.map(t => lr[t]));
    const reversed = {} as Record<TierType, number>;
    for (const tier of TIER_ORDER) reversed[tier] = max - lr[tier];
    return reversed;
  }
  if (direction === 'DOWN') {
    // Row layout — the anchor becomes the top Y coordinate of each tier.
    return { ...lr };
  }
  if (direction === 'UP') {
    const max = Math.max(...TIER_ORDER.map(t => lr[t]));
    const reversed = {} as Record<TierType, number>;
    for (const tier of TIER_ORDER) reversed[tier] = max - lr[tier];
    return reversed;
  }
  return { ...lr };
}

function calculateCanvasWidth(nodesByTier: Map<TierType, ArchitectureNode[]>): number {
  let maxNodesInLayer = 0;
  for (const [, tierNodes] of nodesByTier) {
    maxNodesInLayer = Math.max(maxNodesInLayer, tierNodes.length);
  }
  return maxNodesInLayer * (DEFAULT_NODE_WIDTH + MIN_VERTICAL_GAP) + 200;
}

function findNonCollidingX(
  startX: number,
  y: number,
  width: number,
  height: number,
  placedNodes: PlacedNode[],
  canvasWidth: number
): number {
  let x = startX;
  const maxAttempts = 100;
  let attempts = 0;

  while (checkCollision({ x, y, width, height }, placedNodes) && attempts < maxAttempts) {
    x += MIN_VERTICAL_GAP / 2;
    if (x + width > canvasWidth - 50) {
      x = 50;
    }
    attempts++;
  }

  return Math.max(50, Math.min(x, canvasWidth - width - 50));
}

function distributeNodesHorizontally(
  nodes: ArchitectureNode[],
  startY: number,
  canvasWidth: number,
  placedNodes: PlacedNode[],
  tier: TierType
): PlacedNode[] {
  if (nodes.length === 0) return [];

  const nodeCount = nodes.length;
  const totalWidth = nodeCount * DEFAULT_NODE_WIDTH + (nodeCount - 1) * MIN_VERTICAL_GAP;
  const startX = Math.max(50, (canvasWidth - totalWidth) / 2);

  const placed: PlacedNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const width = node.width || DEFAULT_NODE_WIDTH;
    const height = node.height || DEFAULT_NODE_HEIGHT;

    let x = startX + i * (width + MIN_VERTICAL_GAP);
    x = findNonCollidingX(x, startY, width, height, [...placedNodes, ...placed], canvasWidth);

    placed.push({
      id: node.id,
      x,
      y: startY,
      width,
      height,
      tier,
    });
  }

  return placed;
}

export function runFallbackLayout(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  options: LayoutOptions = {}
): LayoutResult {
  const direction = options.direction || 'RIGHT';
  const isRowLayout = direction === 'DOWN' || direction === 'UP';
  const nodesByTier = getNodesByTier(nodes);
  const tierAnchor = tierAnchorForDirection(direction);
  const canvasHeight = isRowLayout
    ? TIER_ORDER.length * (DEFAULT_NODE_HEIGHT + MIN_VERTICAL_GAP) + 200
    : calculateCanvasHeight(nodesByTier);
  const canvasWidth = isRowLayout ? calculateCanvasWidth(nodesByTier) : 0;

  const placedNodes: PlacedNode[] = [];

  for (const tier of TIER_ORDER) {
    const tierNodes = nodesByTier.get(tier) || [];
    const anchor = tierAnchor[tier];
    if (isRowLayout) {
      const tierPlaced = distributeNodesHorizontally(
        tierNodes,
        anchor,
        canvasWidth,
        placedNodes,
        tier
      );
      placedNodes.push(...tierPlaced);
    } else {
      const tierPlaced = distributeNodesVertically(
        tierNodes,
        anchor,
        canvasHeight,
        placedNodes,
        tier
      );
      placedNodes.push(...tierPlaced);
    }
  }

  const nodePositionMap = new Map(placedNodes.map(p => [p.id, p]));

  const reactFlowNodes: ReactFlowNode[] = nodes.map(node => {
    const placed = nodePositionMap.get(node.id);
    const tier = placed?.tier || normalizeTier(node.tier || node.layer);
    const width = node.width || DEFAULT_NODE_WIDTH;
    const height = node.height || DEFAULT_NODE_HEIGHT;

    return {
      id: node.id,
      type: node.isGroup ? 'groupNode' : 'systemNode',
      position: {
        x: placed?.x ?? tierAnchorForDirection(direction)[tier],
        y: placed?.y ?? 200,
      },
      data: {
        label: node.label,
        icon: node.icon || 'box',
        layer: node.layer,
        tier,
        tierColor: node.tierColor || TIER_COLORS[tier],
        subtitle: node.subtitle,
        serviceType: node.serviceType,
        isGroup: node.isGroup,
        parentId: node.parentId,
        groupLabel: node.groupLabel,
        groupColor: node.groupColor,
      },
      width: placed?.width ?? width,
      height: placed?.height ?? height,
      zIndex: node.isGroup ? 0 : 1,
      ...(node.parentId ? { parentNode: node.parentId } : {}),
    };
  });

  const reactFlowEdges: ReactFlowEdge[] = edges.map(edge => {
    const sourceNode = nodePositionMap.get(edge.source);
    const targetNode = nodePositionMap.get(edge.target);

    if (sourceNode && targetNode) {
      return createReactFlowEdge(edge, sourceNode, targetNode);
    }

    const commType = (edge.communicationType || 'sync') as keyof typeof COMM_COLORS;
    const commStyle = COMM_COLORS[commType] || COMM_COLORS.sync;
    const pathType = edge.pathType || 'smooth';

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'simpleFloating',
      animated: commStyle.animated,
      label: edge.label || '',
      labelShowBg: true,
      labelBgPadding: [8, 4] as [number, number],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: '#1e1e2e', fillOpacity: 0.9 },
      labelStyle: { fontSize: 10, fontWeight: 600, fill: '#e2e8f0' },
      style: {
        stroke: commStyle.color,
        strokeWidth: 2,
        strokeDasharray: commStyle.dash,
      },
      markerEnd: { type: 'arrowclosed', color: commStyle.color },
      data: {
        communicationType: commType as 'sync' | 'async' | 'stream' | 'event' | 'dep',
        pathType,
        edgeType: commType,
        label: edge.label || '',
      },
    };
  });

  const elkPositions = placedNodes.map(p => ({
    id: p.id,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
  }));

  return {
    nodes: reactFlowNodes,
    edges: reactFlowEdges,
    elkPositions,
  };
}

export function validateLayout(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      
      const aRight = a.position.x + (a.width || DEFAULT_NODE_WIDTH);
      const aBottom = a.position.y + (a.height || DEFAULT_NODE_HEIGHT);
      const bRight = b.position.x + (b.width || DEFAULT_NODE_WIDTH);
      const bBottom = b.position.y + (b.height || DEFAULT_NODE_HEIGHT);
      
      const overlaps = !(
        aRight <= b.position.x + COLLISION_BUFFER ||
        a.position.x >= bRight - COLLISION_BUFFER ||
        aBottom <= b.position.y + COLLISION_BUFFER ||
        a.position.y >= bBottom - COLLISION_BUFFER
      );
      
      if (overlaps) {
        errors.push(`Collision detected: ${a.data.label} overlaps with ${b.data.label}`);
      }
    }
  }
  
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    
    if (!source) errors.push(`Edge ${edge.id}: source node not found`);
    if (!target) errors.push(`Edge ${edge.id}: target node not found`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
