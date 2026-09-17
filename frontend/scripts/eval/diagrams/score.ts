import { measureLayoutQuality } from '../../../lib/pipeline-shared/layout/layoutQuality';
import type { DiagramCase } from './corpus';
import type { RFNode, RFEdge } from '../../../lib/mermaid/types';

export function evaluateDiagram(test: DiagramCase, nodes: RFNode[], edges: RFEdge[]) {
  const matches = new Map(Object.entries(test.required).map(([key, pattern]) => [key,
    nodes.filter(n => n.type !== 'groupNode' && new RegExp(pattern, 'i').test(String(n.data.label ?? ''))).map(n => n.id)]));
  const missingComponents = [...matches].filter(([, ids]) => !ids.length).map(([key]) => key);
  const missingRelationships = test.relationships.filter(([source, target]) => !edges.some(e => matches.get(source)?.includes(e.source) && matches.get(target)?.includes(e.target)));
  const forbiddenComponents = nodes.filter(n => test.forbidden?.some(pattern => new RegExp(pattern, 'i').test(String(n.data.label ?? '')))).map(n => n.id);
  const removedExistingIds = test.existingContext?.nodes.filter(n => !nodes.some(next => next.id === n.id)).map(n => n.id) ?? [];
  return { componentCoverage: 1 - missingComponents.length / Object.keys(test.required).length,
    relationshipCoverage: 1 - missingRelationships.length / test.relationships.length,
    missingComponents, missingRelationships, forbiddenComponents, removedExistingIds,
    geometry: measureLayoutQuality(nodes, edges),
    passed: !missingComponents.length && !missingRelationships.length && !forbiddenComponents.length && !removedExistingIds.length };
}
