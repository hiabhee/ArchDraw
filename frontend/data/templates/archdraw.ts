// Typed wrapper over data/templates/archdraw.json — the ArchDraw
// self-architecture template graph (56 nodes / 54 edges) as pure data.
import template from './archdraw.json';
import type { Node, Edge } from 'reactflow';

export const archdrawNodes: Node[] = template.nodes as Node[];
export const archdrawEdges: Edge[] = template.edges as Edge[];
