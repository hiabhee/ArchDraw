import type { Edge, Node } from 'reactflow';
import { findNodeCollisions } from '../geometry/diagramGeometry';
import { layoutDiagramViaMermaid, type LayoutDirection } from '../mermaid/relayout';
import { getEffectiveNodeDimensions } from '../nodes/shapeNodeDimensions';

const studio = { renderStyleId: 'studio-minimal', iconMode: 'all' } as const;

/** Saved diagrams created before direction was included in preview links. */
function inferDirection(nodes: Node[], edges: Edge[]): LayoutDirection {
  const cards = new Map(nodes.map(node => [node.id, { ...node, ...getEffectiveNodeDimensions(node, studio.renderStyleId, studio.iconMode) }]));
  let down = 0;
  let right = 0;
  for (const edge of edges) {
    const source = cards.get(edge.source);
    const target = cards.get(edge.target);
    if (!source || !target || source.parentNode !== target.parentNode) continue;
    const dx = target.position.x - source.position.x - source.width;
    const dy = target.position.y - source.position.y - source.height;
    if (dy >= -2 && dx < 0) down++;
    if (dx >= -2 && dy < 0) right++;
  }
  return down > right ? 'TD' : 'LR';
}

/** Open a saved MCP graph using the dimensions the Studio cards actually render. */
export async function recoverMcpLayout(nodes: Node[], edges: Edge[], requestedDirection?: string | null) {
  const direction = requestedDirection === 'TD' || requestedDirection === 'LR'
    ? requestedDirection : inferDirection(nodes, edges);
  if (!findNodeCollisions(nodes, studio).length) return { nodes, direction };

  const candidate = await layoutDiagramViaMermaid(nodes, edges, direction, {
    ...studio, layoutProfile: 'studio-minimal', foldLongFlows: false, mixGroupDirections: false,
  });
  if (!candidate.success || candidate.nodes.length !== nodes.length || findNodeCollisions(candidate.nodes, studio).length) {
    return { nodes, direction };
  }
  return { nodes: candidate.nodes, direction };
}

export async function prepareMcpResult(nodes: Node[], edges: Edge[], direction?: LayoutDirection) {
  const recovered = await recoverMcpLayout(nodes, edges, direction);
  return { ...recovered, collisions: findNodeCollisions(recovered.nodes, studio).flatMap(issue =>
    issue.code === 'NODE_COLLISION' ? [[issue.nodeId, issue.otherNodeId]] : [],
  ) };
}
