import { getDiagramState } from '../lib/diagram-state.js';
import { TIER_RANK } from '../lib/constants.js';
import type { TierType } from '../types/index.js';

interface Issue {
  severity: 'error' | 'warning' | 'suggestion';
  nodeId?: string;
  message: string;
}

function getTier(node: { data: { layer?: string; tier?: string } }): string {
  return (node.data.tier || node.data.layer || 'compute').toLowerCase();
}

export async function validateDiagram(): Promise<{
  valid: boolean;
  errorCount: number;
  warningCount: number;
  suggestionCount: number;
  issues: Issue[];
}> {
  const state = getDiagramState();
  
  if (state.nodes.length === 0 && state.edges.length === 0) {
    return {
      valid: false,
      errorCount: 1,
      warningCount: 0,
      suggestionCount: 0,
      issues: [{ severity: 'error', message: 'No diagram loaded. Call generate_diagram or apply_template first.' }],
    };
  }

  const issues: Issue[] = [];
  const nodeIds = new Set(state.nodes.map(n => n.id));
  const nodeIdCounts = new Map<string, number>();
  const nodeEdgeCounts = new Map<string, number>();
  // Track how many edges TARGET each node (inbound degree)
  const nodeInboundCounts = new Map<string, number>();
  // Track WHICH nodes each node connects TO (targets)
  const nodeOutboundTargets = new Map<string, string[]>();

  for (const node of state.nodes) {
    const count = nodeIdCounts.get(node.id) || 0;
    nodeIdCounts.set(node.id, count + 1);
    nodeEdgeCounts.set(node.id, 0);
    nodeInboundCounts.set(node.id, 0);
    nodeOutboundTargets.set(node.id, []);
  }

  for (const edge of state.edges) {
    const sourceCount = nodeEdgeCounts.get(edge.source) || 0;
    const targetCount = nodeEdgeCounts.get(edge.target) || 0;
    nodeEdgeCounts.set(edge.source, sourceCount + 1);
    nodeEdgeCounts.set(edge.target, targetCount + 1);

    // Track inbound edges per node
    const inbound = nodeInboundCounts.get(edge.target) || 0;
    nodeInboundCounts.set(edge.target, inbound + 1);

    // Track what each node connects to
    const targets = nodeOutboundTargets.get(edge.source) || [];
    targets.push(edge.target);
    nodeOutboundTargets.set(edge.source, targets);
  }

  // ─── Duplicate IDs ────────────────────────────────────────────────────────
  for (const [id, count] of nodeIdCounts) {
    if (count > 1) {
      issues.push({ severity: 'error', nodeId: id, message: `Duplicate node ID: '${id}'` });
    }
  }

  // ─── Dangling edges ───────────────────────────────────────────────────────
  for (const edge of state.edges) {
    if (!nodeIds.has(edge.source)) {
      issues.push({ severity: 'error', nodeId: edge.source, message: `Edge '${edge.id}' references non-existent source node '${edge.source}'` });
    }
    if (!nodeIds.has(edge.target)) {
      issues.push({ severity: 'error', nodeId: edge.target, message: `Edge '${edge.id}' references non-existent target node '${edge.target}'` });
    }
  }

  // ─── Orphan nodes ─────────────────────────────────────────────────────────
  for (const node of state.nodes) {
    const edgeCount = nodeEdgeCounts.get(node.id) || 0;
    if (edgeCount === 0 && !node.data?.isGroup) {
      issues.push({ severity: 'error', nodeId: node.id, message: `Orphan node '${node.data.label}' has no connections` });
    }
  }

  // ─── STAR TOPOLOGY DETECTION — critical anti-pattern ─────────────────────
  // If any single non-gateway node has more than 40% of all edges pointing TO it,
  // it is being used as a hub — this is wrong.
  const totalEdges = state.edges.length;
  for (const node of state.nodes) {
    if (node.data?.isGroup) continue;
    const tier = getTier(node);
    const inbound = nodeInboundCounts.get(node.id) || 0;
    const label = node.data?.label || node.id;

    // Client-tier nodes should ONLY be sources (edges flow FROM them, not TO them)
    // except for the very rare response-back pattern
    if (tier === 'client' && inbound > 2) {
      issues.push({
        severity: 'error',
        nodeId: node.id,
        message: `STAR TOPOLOGY ERROR: Client node '${label}' is the TARGET of ${inbound} edges. ` +
          `Client tier nodes (Web App, Mobile App) are SOURCES — they initiate requests. ` +
          `Backend/service nodes must NOT connect back to the client. ` +
          `Fix: reverse these edges so they flow FROM the client → API Gateway → Services.`,
      });
    }

    // Any node receiving more than 50% of all edges is a hub — anti-pattern
    if (totalEdges >= 4 && inbound >= Math.ceil(totalEdges * 0.5) && tier !== 'edge') {
      issues.push({
        severity: 'error',
        nodeId: node.id,
        message: `STAR TOPOLOGY ERROR: Node '${label}' (${tier} tier) is the hub — ${inbound} of ${totalEdges} edges point TO it. ` +
          `Architecture must use a tiered flow, not a star/hub pattern. ` +
          `Edges must flow: client → edge → compute → async/data → external.`,
      });
    }
  }

  // ─── BACKWARD EDGE DETECTION — edges flowing right-to-left across tiers ──
  const nodeById = new Map(state.nodes.map(n => [n.id, n]));
  for (const edge of state.edges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) continue;
    if (sourceNode.data?.isGroup || targetNode.data?.isGroup) continue;

    const sourceTier = getTier(sourceNode) as TierType;
    const targetTier = getTier(targetNode) as TierType;
    const sourceTierOrder = TIER_RANK[sourceTier] ?? 2;
    const targetTierOrder = TIER_RANK[targetTier] ?? 2;

    // Severe backward: data/compute → client (e.g., database connecting to Web App)
    if (sourceTierOrder > 1 && targetTierOrder === 0) {
      issues.push({
        severity: 'error',
        nodeId: edge.source,
        message: `BACKWARD EDGE: '${sourceNode.data?.label}' (${sourceTier}) → '${targetNode.data?.label}' (client). ` +
          `Service and data nodes must NEVER connect to the client tier. ` +
          `The client initiates requests; it never receives direct pushes from backend services (use WebSocket gateway or notification service instead).`,
      });
    }

    // Edge tier should not connect back to client
    if (sourceTierOrder >= 1 && targetTierOrder === 0) {
      issues.push({
        severity: 'warning',
        nodeId: edge.source,
        message: `DIRECTION WARNING: Edge from '${sourceNode.data?.label}' (${sourceTier}) points back TO '${targetNode.data?.label}' (client tier). ` +
          `In a request-response architecture, backend→client connections should use response arrows or a separate WebSocket/SSE node, not direct edges.`,
      });
    }
  }

  // ─── Client tier node count ───────────────────────────────────────────────
  const clientNodes = state.nodes.filter(n => getTier(n) === 'client');
  if (clientNodes.length > 3) {
    issues.push({ severity: 'warning', message: `Client tier has ${clientNodes.length} nodes (max recommended: 3)` });
  }

  // ─── Too many nodes ───────────────────────────────────────────────────────
  if (state.nodes.length > 25) {
    issues.push({ severity: 'warning', message: `Diagram has ${state.nodes.length} nodes (may be unreadable, consider simplifying)` });
  }

  // ─── Missing tier assignments ─────────────────────────────────────────────
  for (const node of state.nodes) {
    if (!node.data.layer && !node.data.tier) {
      issues.push({ severity: 'warning', nodeId: node.id, message: `Node '${node.data.label}' has no tier assigned` });
    }
  }

  // ─── No observability ─────────────────────────────────────────────────────
  const observeNodes = state.nodes.filter(n => getTier(n) === 'observe');
  if (observeNodes.length === 0) {
    issues.push({ severity: 'suggestion', message: 'No observability nodes present (consider adding monitoring/logging)' });
  }

  // ─── No async communication ───────────────────────────────────────────────
  const asyncOrEventEdges = state.edges.filter(e => e.data?.communicationType === 'async' || e.data?.communicationType === 'event');
  if (asyncOrEventEdges.length === 0 && state.edges.length > 0) {
    issues.push({ severity: 'suggestion', message: 'No async/event communication used (consider if async patterns would improve architecture)' });
  }

  // ─── Disconnected external nodes ──────────────────────────────────────────
  const externalNodes = state.nodes.filter(n => getTier(n) === 'external');
  for (const extNode of externalNodes) {
    const edgeCount = nodeEdgeCounts.get(extNode.id) || 0;
    if (edgeCount === 0) {
      issues.push({ severity: 'suggestion', nodeId: extNode.id, message: `External tier node '${extNode.data.label}' has no edges` });
    }
  }

  // ─── Too simple ───────────────────────────────────────────────────────────
  if (state.nodes.length < 3) {
    issues.push({ severity: 'suggestion', message: 'Diagram has fewer than 3 nodes (may be too simple to be useful)' });
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const suggestionCount = issues.filter(i => i.severity === 'suggestion').length;

  return {
    valid: errorCount === 0,
    errorCount,
    warningCount,
    suggestionCount,
    issues,
  };
}
