import type { Edge, Node } from 'reactflow';
import { getCachedDiagramGeometryPlan, type DiagramGeometryPlan } from '../geometry/diagramGeometry';
import { measureLayoutAesthetics } from '../pipeline-shared/layout/layoutAesthetics';
import { layoutDiagramViaMermaid, type LayoutDirection, type RelayoutOptions } from './relayout';

/** A repair must improve a conflict without buying a different kind of conflict. */
export function acceptsLayoutRepair(before: DiagramGeometryPlan, after: DiagramGeometryPlan, beforeFit: number, afterFit: number): boolean {
  const metrics = (plan: DiagramGeometryPlan) => [
    plan.quality.hardViolations,
    plan.quality.criticalPathDisconnectCount,
    plan.quality.weightedCrossings,
    plan.quality.unexplainedPrivateOverlapLength,
    plan.violations.filter(issue => issue.code === 'LABEL_COLLISION').length,
  ];
  const previous = metrics(before), next = metrics(after);
  const issueKey = (issue: DiagramGeometryPlan['violations'][number]) =>
    JSON.stringify(Object.entries(issue).sort(([a], [b]) => a.localeCompare(b)));
  const existingHardIssues = new Set(before.violations.filter(issue => issue.severity === 'hard').map(issueKey));
  const introducesHardIssue = after.violations.some(issue => issue.severity === 'hard' && !existingHardIssues.has(issueKey(issue)));
  return !introducesHardIssue && !after.provisional && after.status !== 'failed'
    && afterFit >= beforeFit * 0.9
    && next.every((value, index) => value <= previous[index])
    && next.some((value, index) => value < previous[index]);
}

/** One bounded canonical relayout, judged on restored user edges and visible geometry. */
export async function repairDiagramLayout(nodes: Node[], edges: Edge[], direction: LayoutDirection, options: RelayoutOptions = {}) {
  const geometryOptions = { direction, straightEdges: false, renderStyleId: options.renderStyleId, iconMode: options.iconMode };
  const before = getCachedDiagramGeometryPlan(nodes, edges, geometryOptions);
  const unchanged = { nodes, edges, repaired: false, before, after: before };
  if (!nodes.length || before.provisional) return unchanged;
  const candidate = await layoutDiagramViaMermaid(nodes, edges, direction, { ...options, foldLongFlows: false, mixGroupDirections: false });
  if (!candidate.success) return unchanged;
  // Repair moves existing components only. Keep annotations and every edge's identity,
  // handles, labels, custom waypoints and styling exactly as authored.
  const positions = new Map(candidate.nodes.map(node => [node.id, node]));
  if (nodes.some(node => !positions.has(node.id))) return unchanged;
  const repairedNodes = nodes.map(node => {
    const laid = positions.get(node.id)!;
    return { ...node, position: laid.position, positionAbsolute: undefined, width: laid.width, height: laid.height, style: laid.style, data: { ...node.data, nodeWidth: laid.width, nodeHeight: laid.height } };
  });
  const byId = new Map(repairedNodes.map(node => [node.id, node]));
  // Geometry routing validates card collisions; containment is a separate layout invariant.
  for (const node of repairedNodes) {
    const parent = node.parentNode ? byId.get(node.parentNode) : undefined;
    if (parent && (node.position.x < 0 || node.position.y < 0
      || node.position.x + (node.width ?? 200) > (parent.width ?? 0)
      || node.position.y + (node.height ?? 88) > (parent.height ?? 0))) return unchanged;
  }
  const after = getCachedDiagramGeometryPlan(repairedNodes, edges, geometryOptions);
  const fit = (value: Node[]) => measureLayoutAesthetics(value, [], direction).fitScale;
  if (!acceptsLayoutRepair(before, after, fit(nodes), fit(repairedNodes))) return unchanged;
  return { nodes: repairedNodes, edges, repaired: true, before, after };
}
