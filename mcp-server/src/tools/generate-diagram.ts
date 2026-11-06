import type { ReactFlowNode, ReactFlowEdge } from '../types/index.js';
import type { GenerateDiagramInput } from '../lib/schema.js';
import { describeSaveFailure } from '../lib/preview-links.js';
import { fetchWithTimeout, getApiBase } from '../lib/http.js';
import { validateGraph } from './validate-diagram.js';

function structuredInputToMermaid(nodes: NodeInput[], edges: NonNullable<GenerateDiagramInput['edges']>, direction: GenerateDiagramInput['direction']): string {
  const graphDirection = direction === 'DOWN' || direction === 'UP' ? 'TD' : 'LR';
  const lines = [`graph ${graphDirection}`];
  for (const node of nodes) {
    const label = (node.label || node.id || 'Component').replaceAll('"', "'").replaceAll('\n', ' ');
    lines.push(`  ${node.id || 'component'}["${label}"]`);
  }
  for (const edge of edges || []) lines.push(`  ${edge.source} --> ${edge.target}`);
  return lines.join('\n');
}

/* Legacy ELK validation retained only until the next major release. */
/* function validateNodes(nodes: ArchitectureNode[], techStack?: string[], customFeatures?: string[]): string[] {
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
} */

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
  updateToken?: string;
  shareUrl?: string;
  embeddedDiagram?: { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] };
  message?: string;
  /** The diagram drawn by ArchDraw's SVG export, for the inline preview only. */
  previewSvg?: string;
  /** Why a requested preview link could not be created. */
  linkError?: string;
  errors?: string[];
}> {
  try {
    const { direction } = input;

    // Handle Mermaid input directly
    if (input.mermaid) {
      const API_BASE = getApiBase();
      const label = input.label || 'AI Diagram';
      if (!API_BASE) {
        return { success: false, nodes: [], edges: [], elkPositions: [], metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'Mermaid Pipeline', direction: input.direction || 'RIGHT', groupCount: 0 }, errors: ['Mermaid generation requires API_BASE_URL to run the ArchDraw pipeline.'] };
      }
      
      const previewResponse = await fetchWithTimeout(`${API_BASE}/api/diagram/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mermaid: input.mermaid,
          label,
          dryRun: true,
          preview: true,
        }),
      });

      if (!previewResponse.ok) {
        const errText = await previewResponse.text();
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

      const preview = await previewResponse.json() as { nodes: ReactFlowNode[]; edges: ReactFlowEdge[]; warnings?: string[]; previewSvg?: string };
      const validation = validateGraph(preview.nodes, preview.edges);
      const structuralErrors = validation.issues.filter(issue => issue.severity === 'error').map(issue => issue.message);
      if (structuralErrors.length > 0) {
        return { success: false, nodes: [], edges: [], elkPositions: [], metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'Mermaid Pipeline', direction: input.direction || 'RIGHT', groupCount: 0 }, errors: structuralErrors };
      }

      let sessionId: string | undefined;
      let updateToken: string | undefined;
      let diagramUrl: string | undefined;
      let shareUrl: string | undefined;
      let linkError: string | undefined;
      if (input.publish) {
        // A failed publish must not throw away a successfully generated
        // diagram — return it and report why there is no link.
        try {
          const saveResponse = await fetchWithTimeout(`${API_BASE}/api/diagram/load`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mermaid: input.mermaid, label, source: 'mcp', publish: true }),
          });
          if (saveResponse.ok) {
            const saved = await saveResponse.json() as { sessionId: string; updateToken: string };
            sessionId = saved.sessionId;
            updateToken = saved.updateToken;
            diagramUrl = `${API_BASE}/editor?session=${sessionId}`;
            shareUrl = `${API_BASE}/share/${sessionId}`;
          } else {
            linkError = describeSaveFailure(saveResponse.status);
          }
        } catch (error) {
          linkError = error instanceof Error ? error.message : 'ArchDraw could not save the preview';
        }
      }
      const saveData = preview;
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

      // Links are rendered first by the tool handler (formatPreviewLinks).
      const message = `✅ Diagram ready — ${nodeCount} nodes, ${groupCount} groups, ${saveData.edges.length} edges.${techLine}${featuresLine}${promptLine}`;

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
        updateToken,
        shareUrl,
        linkError,
        embeddedDiagram: { nodes: saveData.nodes, edges: saveData.edges },
        message,
        previewSvg: preview.previewSvg,
        errors: [...(saveData.warnings || []), ...validation.issues.filter(issue => issue.severity !== 'error').map(issue => issue.message)],
      };
    }

    if (!input.nodes || input.nodes.length === 0) {
      return {
        success: false, nodes: [], edges: [], elkPositions: [],
        metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'ELK layered', direction, groupCount: 0 },
        errors: ['No nodes or mermaid string provided.'],
      };
    }

    // JSON remains supported for existing agents, but is deliberately adapted
    // into Mermaid so every generated diagram uses the editor's canonical
    // Mermaid → Dagre pipeline rather than a competing ELK layout.
    return generateDiagram({
      ...input,
      mermaid: structuredInputToMermaid(input.nodes as NodeInput[], input.edges || [], input.direction),
    });

  } catch (error) {
    return {
      success: false, nodes: [], edges: [], elkPositions: [],
      metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'Mermaid Pipeline', direction: input.direction, groupCount: 0 },
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
