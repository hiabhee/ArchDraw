import type { ReactFlowNode, ReactFlowEdge } from '../types/index.js';
import type { UpdateDiagramInput } from '../lib/schema.js';
import { getDiagramState, setDiagramState } from '../lib/diagram-state.js';
import { fetchWithTimeout } from '../lib/http.js';
import {
  TIER_COLORS,
  COMM_COLORS,
  TIER_X_POSITIONS_LR,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  DEFAULT_GROUP_HEIGHT,
  type CommStyle,
} from '../lib/constants.js';

const VERTICAL_GAP = 80;

function tierOf(node: ReactFlowNode): string {
  const tier = (node.data?.tier || node.data?.layer || 'compute').toLowerCase();
  return tier;
}

/** Find a non-colliding spot for a new node below the existing nodes of its tier. */
function findPlacement(nodes: ReactFlowNode[], tier: string): { x: number; y: number } {
  const sameTier = nodes.filter(n => tierOf(n) === tier);
  if (sameTier.length === 0) {
    return { x: TIER_X_POSITIONS_LR[tier as keyof typeof TIER_X_POSITIONS_LR] ?? 50, y: 80 };
  }
  const maxBottom = Math.max(...sameTier.map(n => n.position.y + (n.height || DEFAULT_NODE_HEIGHT)));
  const x = sameTier[0].position.x;
  return { x, y: maxBottom + VERTICAL_GAP };
}

function buildEdge(edge: {
  source: string;
  target: string;
  communicationType?: string;
  label?: string;
  pathType?: string;
}, id: string): ReactFlowEdge {
  const commType = (edge.communicationType || 'sync') as keyof typeof COMM_COLORS;
  const commStyle: CommStyle = COMM_COLORS[commType] || COMM_COLORS.sync;
  const label = edge.label || '';
  const pathType = edge.pathType || 'smooth';

  return {
    id,
    source: edge.source,
    target: edge.target,
    type: 'simpleFloating',
    animated: commStyle.animated,
    label,
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
    markerEnd: { type: 'arrowclosed' as string, color: commStyle.color },
    data: {
      communicationType: commType as 'sync' | 'async' | 'stream' | 'event' | 'dep',
      pathType: pathType as ReactFlowEdge['data']['pathType'],
      label,
    },
  };
}

export async function updateDiagram(input: UpdateDiagramInput): Promise<{
  success: boolean;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  message: string;
  changes: {
    nodesAdded: number;
    nodesRemoved: number;
    nodesUpdated: number;
    edgesAdded: number;
    edgesRemoved: number;
    nodesRepositioned: number;
  };
  sessionId?: string;
  diagramUrl?: string;
  error?: string;
}> {
  const state = getDiagramState();

  if (state.nodes.length === 0 && state.edges.length === 0) {
    return {
      success: false,
      nodes: [],
      edges: [],
      message: '',
      changes: { nodesAdded: 0, nodesRemoved: 0, nodesUpdated: 0, edgesAdded: 0, edgesRemoved: 0, nodesRepositioned: 0 },
      error: 'No diagram exists. Call generate_diagram first.',
    };
  }

  const changes = { nodesAdded: 0, nodesRemoved: 0, nodesUpdated: 0, edgesAdded: 0, edgesRemoved: 0, nodesRepositioned: 0 };

  let nodes = state.nodes.map(n => ({
    ...n,
    position: { ...n.position },
    data: { ...n.data },
  }));
  let edges = state.edges.map(e => ({ ...e }));

  if (input.removeNodeIds && input.removeNodeIds.length > 0) {
    const removeSet = new Set(input.removeNodeIds);
    nodes = nodes.filter(n => !removeSet.has(n.id));
    edges = edges.filter(e => !removeSet.has(e.source) && !removeSet.has(e.target));
    changes.nodesRemoved = input.removeNodeIds.length;
    changes.edgesRemoved = state.edges.length - edges.length;
  }

  if (input.removeEdgeIds && input.removeEdgeIds.length > 0) {
    const removeSet = new Set(input.removeEdgeIds);
    edges = edges.filter(e => !removeSet.has(e.id));
    changes.edgesRemoved += input.removeEdgeIds.length;
  }

  if (input.addNodes && input.addNodes.length > 0) {
    const newNodes: ReactFlowNode[] = input.addNodes.map(node => {
      const tier = (node.tier || 'compute').toLowerCase();
      const isGroup = node.isGroup === true;
      const placement = findPlacement(nodes, tier);

      return {
        id: node.id,
        type: isGroup ? 'groupNode' : 'systemNode',
        position: placement,
        data: {
          label: node.label,
          icon: node.icon || (isGroup ? 'layers' : 'box'),
          layer: tier as ReactFlowNode['data']['layer'],
          tier: tier as ReactFlowNode['data']['tier'],
          tierColor: node.tierColor || TIER_COLORS[tier as keyof typeof TIER_COLORS] || TIER_COLORS.compute,
          accentColor: node.accentColor,
          subtitle: node.subtitle,
          status: node.status,
          isGroup,
          parentId: node.parentId,
          groupColor: node.groupColor,
        },
        width: isGroup ? (node.width || DEFAULT_GROUP_WIDTH) : (node.width || DEFAULT_NODE_WIDTH),
        height: isGroup ? (node.height || DEFAULT_GROUP_HEIGHT) : (node.height || DEFAULT_NODE_HEIGHT),
        zIndex: isGroup ? 0 : 1,
        ...(node.parentId ? { parentNode: node.parentId } : {}),
      };
    });
    nodes = [...nodes, ...newNodes];
    changes.nodesAdded = input.addNodes.length;
    changes.nodesRepositioned += input.addNodes.length;
  }

  if (input.updateNodes && input.updateNodes.length > 0) {
    for (const update of input.updateNodes) {
      const node = nodes.find(n => n.id === update.id);
      if (node) {
        if (update.label !== undefined) node.data.label = update.label;
        if (update.subtitle !== undefined) node.data.subtitle = update.subtitle;
        if (update.icon !== undefined) node.data.icon = update.icon;
        if (update.accentColor !== undefined) node.data.accentColor = update.accentColor;
        if (update.status !== undefined) node.data.status = update.status;
        if (update.tier) {
          node.data.layer = update.tier as ReactFlowNode['data']['layer'];
          node.data.tier = update.tier as ReactFlowNode['data']['tier'];
          node.data.tierColor = update.tierColor || TIER_COLORS[update.tier as keyof typeof TIER_COLORS] || TIER_COLORS.compute;
        } else if (update.tierColor) {
          node.data.tierColor = update.tierColor;
        }
        changes.nodesUpdated++;
      }
    }
  }

  if (input.addEdges && input.addEdges.length > 0) {
    let edgeIndex = edges.length;
    const newEdges: ReactFlowEdge[] = input.addEdges.map(edge => buildEdge(edge, `edge-${edgeIndex++}`));
    edges = [...edges, ...newEdges];
    changes.edgesAdded = input.addEdges.length;
  }

  setDiagramState({ nodes, edges });

  let sessionId: string | undefined;
  let diagramUrl: string | undefined;

  // Best-effort persistence: save the updated canvas to a new share session so
  // the result is viewable in the editor. Never fail the update if the API is down.
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
  try {
    const saveResponse = await fetchWithTimeout(`${API_BASE}/api/diagram/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes,
        edges,
        label: 'Updated MCP Diagram',
        source: 'mcp',
      }),
    });
    if (saveResponse.ok) {
      const saveData = await saveResponse.json() as { sessionId: string; url?: string };
      sessionId = saveData.sessionId;
      const urlPath = saveData.url || `/editor?session=${saveData.sessionId}`;
      diagramUrl = `${API_BASE}${urlPath}`;
    }
  } catch {
    // ignore — local state is still updated
  }

  const changeSummary = [
    changes.nodesAdded > 0 ? `${changes.nodesAdded} node(s) added` : '',
    changes.nodesRemoved > 0 ? `${changes.nodesRemoved} node(s) removed` : '',
    changes.nodesUpdated > 0 ? `${changes.nodesUpdated} node(s) updated` : '',
    changes.edgesAdded > 0 ? `${changes.edgesAdded} edge(s) added` : '',
    changes.edgesRemoved > 0 ? `${changes.edgesRemoved} edge(s) removed` : '',
  ].filter(Boolean).join(', ');

  const urlLine = diagramUrl ? `\n\nView the updated diagram: ${diagramUrl}` : '';

  return {
    success: true,
    nodes,
    edges,
    message: `Diagram updated. ${changeSummary}.${urlLine}`,
    changes,
    sessionId,
    diagramUrl,
  };
}
