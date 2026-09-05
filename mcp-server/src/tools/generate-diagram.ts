import type { ArchitectureNode, ArchitectureEdge, ReactFlowNode, ReactFlowEdge, TierType } from '../types/index.js';
import type { GenerateDiagramInput } from '../lib/schema.js';
import { runELKLayout, validateLayout } from '../lib/elk-runner.js';
import { parseUserPrompt } from '../lib/parse-prompt.js';
import { fetchWithTimeout } from '../lib/http.js';
import {
  TIER_COLORS,
  TIER_ORDER,
  TIER_RANK,
  COMM_COLORS,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  DEFAULT_GROUP_HEIGHT,
} from '../lib/constants.js';

function assignTierFromLayer(layer: string): TierType {
  const normalized = layer.toLowerCase();
  if (TIER_ORDER.includes(normalized as TierType)) return normalized as TierType;
  return 'compute';
}

function validateNodes(nodes: ArchitectureNode[], techStack?: string[], customFeatures?: string[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const node of nodes) {
    if (!node.id) {
      errors.push(`Node missing id: ${node.label}`);
    } else if (ids.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id}`);
    } else {
      ids.add(node.id);
    }

    if (!node.label) errors.push(`Node missing label`);

    const layer = node.tier || node.layer;
    if (!layer) errors.push(`Node ${node.label || node.id} missing tier/layer`);

    // Tech stack fidelity: warn if subtitle looks generic
    if (node.subtitle) {
      const genericTerms = ['service', 'server', 'api', 'database', 'storage', 'cache', 'worker', 'backend'];
      const subtitleLower = node.subtitle.toLowerCase();
      const labelLower = (node.label || '').toLowerCase();
      const isGeneric = genericTerms.some(t => subtitleLower === t || subtitleLower === `${labelLower} ${t}`);
      if (isGeneric && techStack && techStack.length > 0) {
        errors.push(`WARNING: Node "${node.label}" has a generic subtitle "${node.subtitle}". With user-specified tech stack, subtitles must include actual technology names.`);
      }
    }
  }

  // Validate parentId references
  for (const node of nodes) {
    if (node.parentId && !ids.has(node.parentId)) {
      errors.push(`Node "${node.id}" has parentId "${node.parentId}" which does not exist`);
    }
    if (node.parentId && node.isGroup) {
      errors.push(`Node "${node.id}" cannot be both a group and a child (parentId + isGroup)`);
    }
  }

  // Tech stack fidelity check: every specified tech must appear in at least one node
  if (techStack && techStack.length > 0) {
    const allText = nodes.map(n => `${n.label} ${n.subtitle || ''}`).join(' ').toLowerCase();
    for (const tech of techStack) {
      if (!allText.includes(tech.toLowerCase())) {
        errors.push(`TECH FIDELITY: User specified "${tech}" but it does not appear in any node label or subtitle. Add a node or update a subtitle to mention "${tech}".`);
      }
    }
  }

  // Custom features check
  if (customFeatures && customFeatures.length > 0) {
    const allText = nodes.map(n => `${n.label} ${n.subtitle || ''}`).join(' ').toLowerCase();
    for (const feature of customFeatures) {
      if (!allText.includes(feature.toLowerCase())) {
        errors.push(`FEATURE MISSING: User requested "${feature}" but it does not appear in any node label or subtitle. Add a dedicated node or update an existing one.`);
      }
    }
  }

  return errors;
}

function validateEdgeTopology(
  nodes: ArchitectureNode[],
  edges: Array<{ source: string; target: string; label?: string; id?: string }>
): string[] {
  const topologyErrors: string[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Count how many edges TARGET each node (inbound degree)
  const inboundCount = new Map<string, number>();
  for (const n of nodes) inboundCount.set(n.id, 0);
  for (const e of edges) {
    inboundCount.set(e.target, (inboundCount.get(e.target) || 0) + 1);
  }

  const totalEdges = edges.length;

  for (const node of nodes) {
    if (node.isGroup) continue;
    const tier = (node.tier || node.layer || 'compute').toLowerCase();
    const inbound = inboundCount.get(node.id) || 0;
    const label = node.label || node.id;

    // ── RULE 1: Client nodes are SOURCES — max 1-2 inbound edges (responses only) ──
    if (tier === 'client' && inbound > 2) {
      topologyErrors.push(
        `🚨 STAR TOPOLOGY — Client node "${label}" has ${inbound} edges pointing TO it. ` +
        `Client tier nodes (Web App, Mobile App) INITIATE requests — they are edge SOURCES, not targets. ` +
        `FIX: Reverse these edges. Flow must be: Web Client → API Gateway → Services → Data. ` +
        `Services must NEVER point back to the Web Client.`
      );
    }

    // ── RULE 2: No single non-gateway node should receive >45% of all edges ──
    if (totalEdges >= 4 && inbound >= Math.ceil(totalEdges * 0.45) && tier !== 'edge') {
      topologyErrors.push(
        `🚨 STAR TOPOLOGY — Node "${label}" (${tier}) is acting as a HUB with ${inbound}/${totalEdges} edges pointing TO it. ` +
        `Architecture must use tiered flow, not hub-and-spoke. ` +
        `FIX: Route connections through the appropriate gateway/service tier instead of directly to this node.`
      );
    }
  }

  // ── RULE 3: No backward edges (higher tier → lower tier except response flows) ──
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;
    if (sourceNode.isGroup || targetNode.isGroup) continue;

    const sourceTier = (sourceNode.tier || sourceNode.layer || 'compute').toLowerCase() as TierType;
    const targetTier = (targetNode.tier || targetNode.layer || 'compute').toLowerCase() as TierType;
    const sourceRank = TIER_RANK[sourceTier] ?? 2;
    const targetRank = TIER_RANK[targetTier] ?? 2;

    // Compute/data/async tier nodes must NEVER connect to client tier
    if (sourceRank >= 2 && targetRank === 0) {
      topologyErrors.push(
        `🚨 BACKWARD EDGE — "${sourceNode.label}" (${sourceTier}) → "${targetNode.label}" (client). ` +
        `Backend services must NEVER send edges to the client tier. ` +
        `FIX: Remove this edge. If the client needs real-time updates, add a WebSocket Gateway or Notification Service as an intermediary.`
      );
    }

    // Edge tier nodes should generally not point back to client either
    if (sourceRank >= 1 && targetRank === 0 && sourceTier !== 'external') {
      topologyErrors.push(
        `⚠️  DIRECTION WARNING — "${sourceNode.label}" (${sourceTier}) → "${targetNode.label}" (client). ` +
        `In request-response architecture, edges flow LEFT→RIGHT: client → gateway → services → data. ` +
        `Do not draw reverse edges back to the client.`
      );
    }
  }

  return topologyErrors;
}

interface NodeInput {
  id?: string;
  label: string;
  tier?: string;
  layer?: string;
  subtitle?: string;
  icon?: string;
  tierColor?: string;
  accentColor?: string;
  groupColor?: string;
  status?: 'healthy' | 'warning' | 'error' | 'unknown';
  shape?: string;
  width?: number;
  height?: number;
  serviceType?: string;
  isGroup?: boolean;
  parentId?: string;
}

export async function generateDiagram(input: GenerateDiagramInput): Promise<{
  success: boolean;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  elkPositions: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    layoutAlgorithm: string;
    direction: string;
    groupCount: number;
  };
  diagramUrl?: string;
  sessionId?: string;
  shareUrl?: string;
  embeddedDiagram?: { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] };
  message?: string;
  errors?: string[];
}> {
  const errors: string[] = [];

  try {
    const { direction } = input;

    // Handle Mermaid input directly
    if (input.mermaid) {
      const API_BASE = process.env.API_BASE_URL || 'https://archdraw.hiabhee.online';
      const label = input.label || 'AI Diagram';
      
      const saveResponse = await fetchWithTimeout(`${API_BASE}/api/diagram/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mermaid: input.mermaid,
          label,
          source: 'mcp',
        }),
      });

      if (!saveResponse.ok) {
        const errText = await saveResponse.text();
        let errData;
        try {
          errData = JSON.parse(errText);
        } catch {}
        const errorMsg = errData?.error || errText || 'Failed to save diagram to API';
        const warnings = errData?.warnings ? ` Warnings: ${errData.warnings.join(', ')}` : '';
        return {
          success: false, nodes: [], edges: [], elkPositions: [],
          metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'Mermaid Pipeline', direction: input.direction || 'RIGHT', groupCount: 0 },
          errors: [`${errorMsg}${warnings}`],
        };
      }

      const saveData = await saveResponse.json() as { sessionId: string; nodes: any[]; edges: any[]; warnings?: string[] };
      const urlPath = `/editor?session=${saveData.sessionId}`;
      const diagramUrl = `${API_BASE}${urlPath}`;
      const sessionId = saveData.sessionId;
      const shareUrl = `${API_BASE}/share/${sessionId}`;
      const nodeCount = saveData.nodes.filter(n => !n.data?.isGroup).length;
      const groupCount = saveData.nodes.filter(n => n.data?.isGroup).length;

      const techStack = input.techStack || [];
      const customFeatures = input.customFeatures || [];
      const techLine = techStack.length > 0
        ? `\n\n🔧 **Tech Stack Applied**: ${techStack.join(', ')}`
        : '';
      const featuresLine = customFeatures.length > 0
        ? `\n⚡ **Features Included**: ${customFeatures.join(', ')}`
        : '';
      const promptLine = input.userPrompt
        ? `\n\n💬 **From prompt**: "${input.userPrompt.substring(0, 100)}${input.userPrompt.length > 100 ? '...' : ''}"` : '';

      const message = `✅ Diagram ready! Open this URL to view and edit:\n\n${diagramUrl}\n\n🔗 Shareable link:\n${shareUrl}\n\n📊 ${nodeCount} nodes, ${groupCount} groups, ${saveData.edges.length} edges.${techLine}${featuresLine}${promptLine}\n\n**To export**: Use session ID "${sessionId}" with the export_diagram tool.`;

      return {
        success: true,
        nodes: saveData.nodes,
        edges: saveData.edges,
        elkPositions: [],
        metadata: {
          nodeCount: saveData.nodes.length,
          edgeCount: saveData.edges.length,
          layoutAlgorithm: 'Mermaid Pipeline',
          direction: input.direction || 'RIGHT',
          groupCount,
        },
        diagramUrl,
        sessionId,
        shareUrl,
        embeddedDiagram: { nodes: saveData.nodes, edges: saveData.edges },
        message,
        errors: saveData.warnings && saveData.warnings.length > 0 ? saveData.warnings : undefined,
      };
    }

    if (!input.nodes || input.nodes.length === 0) {
      return {
        success: false, nodes: [], edges: [], elkPositions: [],
        metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'ELK layered', direction, groupCount: 0 },
        errors: ['No nodes or mermaid string provided.'],
      };
    }

    // Check if AI used groups — warn if not
    const groupNodes = input.nodes.filter((n: NodeInput) => n.isGroup);
    if (groupNodes.length === 0) {
      errors.push('WARNING: No group nodes provided. Best practice: wrap related nodes in group containers (isGroup:true) for visual clarity.');
    }

    // Extract tech/feature context for fidelity checks.
    // If the caller did not pass an explicit techStack/customFeatures, derive
    // them from the userPrompt via the shared prompt parser (single source).
    const parsedPrompt = input.userPrompt ? parseUserPrompt(input.userPrompt) : null;
    const techStack = input.techStack && input.techStack.length > 0
      ? [...input.techStack]
      : parsedPrompt?.detectedTechStack || [];
    const customFeatures = input.customFeatures && input.customFeatures.length > 0
      ? [...input.customFeatures]
      : parsedPrompt?.customFeatures || [];

    const architectureNodes: ArchitectureNode[] = input.nodes.map((node: NodeInput, index: number) => {
      const layer = node.layer || node.tier || 'compute';
      const tier = assignTierFromLayer(layer);
      const isGroup = node.isGroup === true;

      return {
        id: node.id || `node-${index}`,
        type: isGroup ? 'groupNode' : 'systemNode',
        label: node.label,
        subtitle: node.subtitle || '',
        layer: tier,
        tier: tier,
        tierColor: node.tierColor || TIER_COLORS[tier],
        accentColor: node.accentColor,
        groupColor: node.groupColor,
        status: node.status,
        shape: node.shape,
        // Groups get larger default dimensions; clamp regular nodes to minimum
        width: isGroup
          ? Math.max(node.width || DEFAULT_GROUP_WIDTH, 300)
          : Math.max(node.width || DEFAULT_NODE_WIDTH, 160),
        height: isGroup
          ? Math.max(node.height || DEFAULT_GROUP_HEIGHT, 200)
          : Math.max(node.height || DEFAULT_NODE_HEIGHT, 60),
        icon: node.icon || (isGroup ? 'layers' : 'box'),
        metadata: { serviceType: node.serviceType },
        isGroup,
        parentId: node.parentId,
        serviceType: node.serviceType,
      };
    });

    // Validate node integrity
    const nodeIdSet = new Set(architectureNodes.map(n => n.id));
    const inputEdgeErrors: string[] = [];
    const inputEdgeIds = new Set<string>();

    for (const edge of (input.edges || [])) {
      if (edge.id && inputEdgeIds.has(edge.id)) {
        inputEdgeErrors.push(`Duplicate edge id: ${edge.id}`);
      } else if (edge.id) {
        inputEdgeIds.add(edge.id);
      }
      if (!nodeIdSet.has(edge.source)) {
        inputEdgeErrors.push(`Edge ${edge.id || 'unknown'}: invalid source "${edge.source}"`);
      }
      if (!nodeIdSet.has(edge.target)) {
        inputEdgeErrors.push(`Edge ${edge.id || 'unknown'}: invalid target "${edge.target}"`);
      }
      if (edge.source === edge.target) {
        inputEdgeErrors.push(`Edge ${edge.id || 'unknown'}: source and target are the same`);
      }
    }

    errors.push(...validateNodes(architectureNodes, techStack, customFeatures), ...inputEdgeErrors);

    // ── Run edge topology validation BEFORE layout ────────────────────────────
    const topologyErrors = validateEdgeTopology(
      architectureNodes,
      (input.edges || []).map(e => ({ source: e.source, target: e.target, label: e.label, id: e.id }))
    );
    if (topologyErrors.length > 0) {
      errors.push(...topologyErrors);
      // Return early with topology errors — do NOT render a broken diagram
      return {
        success: false,
        nodes: [],
        edges: [],
        elkPositions: [],
        metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'ELK layered', direction, groupCount: 0 },
        errors,
        message:
          `❌ Diagram rejected due to topology errors. Fix the following issues and call generate_diagram again:\n\n` +
          topologyErrors.map((e, i) => `${i + 1}. ${e}`).join('\n\n') +
          `\n\n📐 CORRECT FLOW: client → API Gateway → Services → Async → Data → External\n` +
          `   Edges must flow LEFT→RIGHT through tiers. Never connect service/data nodes back to the client.`,
      };
    }

    const architectureEdges: ArchitectureEdge[] = (input.edges || []).map((edge, index) => {
      const commType = (edge.communicationType || 'sync') as keyof typeof COMM_COLORS;
      const commStyle = COMM_COLORS[commType] || COMM_COLORS.sync;
      // Use provided label; for async/stream/event, fall back to comm type description
      const label = edge.label?.trim() || 'Connection';

      return {
        id: edge.id || `edge-${index}`,
        source: edge.source,
        target: edge.target,
        communicationType: commType as ArchitectureEdge['communicationType'],
        pathType: (edge.pathType ?? 'Smoothstep') as ArchitectureEdge['pathType'],
        label,
        labelPosition: 'center' as const,
        animated: commStyle.animated,
        style: {
          stroke: commStyle.color,
          strokeDasharray: commStyle.dash,
          strokeWidth: 2.5,
        },
        markerEnd: 'arrowclosed' as const,
        markerStart: 'none' as const,
      };
    });

    const layoutResult = await runELKLayout(architectureNodes, architectureEdges, { direction });

    const layoutValidation = validateLayout(layoutResult.nodes, layoutResult.edges);
    if (!layoutValidation.valid) {
      errors.push(...layoutValidation.errors);
    }

    let diagramUrl: string | undefined;
    let message: string | undefined;
    let sessionId: string | undefined;

    const API_BASE = process.env.API_BASE_URL || 'https://archdraw.hiabhee.online';

    try {
      const label = input.label || input.nodes[0]?.label || 'AI Diagram';
      const saveResponse = await fetchWithTimeout(`${API_BASE}/api/diagram/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: layoutResult.nodes,
          edges: layoutResult.edges,
          label,
          source: 'mcp',
        }),
      });

      if (saveResponse.ok) {
        const saveData = await saveResponse.json() as { sessionId: string; url?: string };
        const urlPath = saveData.url || `/editor?session=${saveData.sessionId}`;
        diagramUrl = `${API_BASE}${urlPath}`;
        sessionId = saveData.sessionId;
        const shareUrl = `${API_BASE}/share/${sessionId}`;
        const nodeCount = layoutResult.nodes.filter(n => !n.data?.isGroup).length;
        const groupCount = layoutResult.nodes.filter(n => n.data?.isGroup).length;

        // Build a context-aware success message
        const techLine = techStack.length > 0
          ? `\n\n🔧 **Tech Stack Applied**: ${techStack.join(', ')}`
          : '';
        const featuresLine = customFeatures.length > 0
          ? `\n⚡ **Features Included**: ${customFeatures.join(', ')}`
          : '';
        const promptLine = input.userPrompt
          ? `\n\n💬 **From prompt**: "${input.userPrompt.substring(0, 100)}${input.userPrompt.length > 100 ? '...' : ''}"` : '';

        message = `✅ Diagram ready! Open this URL to view and edit:\n\n${diagramUrl}\n\n🔗 Shareable link:\n${shareUrl}\n\n📊 ${nodeCount} nodes, ${groupCount} groups, ${layoutResult.edges.length} edges.${techLine}${featuresLine}${promptLine}\n\n**To export**: Use session ID "${sessionId}" with the export_diagram tool.`;
      }
    } catch {
      message = `Diagram generated with ${layoutResult.nodes.length} nodes and ${layoutResult.edges.length} edges, but couldn't save to generate a link. Make sure Next.js is running on ${API_BASE}.`;
    }

    const groupCount = architectureNodes.filter(n => n.isGroup).length;

    return {
      success: true,
      nodes: layoutResult.nodes,
      edges: layoutResult.edges,
      elkPositions: layoutResult.elkPositions,
      metadata: {
        nodeCount: layoutResult.nodes.length,
        edgeCount: layoutResult.edges.length,
        layoutAlgorithm: 'ELK layered',
        direction,
        groupCount,
      },
      diagramUrl,
      sessionId,
      shareUrl: sessionId ? `${API_BASE}/share/${sessionId}` : undefined,
      embeddedDiagram: { nodes: layoutResult.nodes, edges: layoutResult.edges },
      message,
      errors: errors.length > 0 ? errors : undefined,
    };

  } catch (error) {
    return {
      success: false, nodes: [], edges: [], elkPositions: [],
      metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'ELK layered', direction: input.direction, groupCount: 0 },
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
