/**
 * Checks a raw graph (nodes and edges sent as JSON, not built from Mermaid) before it is
 * stored. Such graphs come from the MCP drawing tool and are then rendered on public share
 * pages and in the editor, so only node types the canvas knows are accepted, and sizes,
 * counts and coordinates are bounded. Returns the reason, or `null` when the graph is fine.
 */

/** The node types the canvas registers (`components/canvas/canvasTypes.ts`). */
export const RAW_NODE_TYPES: ReadonlySet<string> = new Set([
  'systemNode', 'architectureNode', 'baseNode', 'databaseNode', 'cacheNode', 'shapeNode',
  'groupNode', 'group', 'frameNode', 'serviceNode', 'textLabelNode', 'annotationNode', 'imageNode',
  'decorNode', 'statNode',
  'messageBrokerNode', 'customNode', 'custom',
]);

export const MAX_RAW_NODES = 500;
export const MAX_RAW_EDGES = 1500;
export const MAX_RAW_BYTES = 2_000_000;
const MAX_COORD = 1_000_000;
const MAX_ID = 200;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function checkRawGraph(nodes: unknown[], edges: unknown[]): string | null {
  if (nodes.length > MAX_RAW_NODES) return `A canvas holds at most ${MAX_RAW_NODES} nodes.`;
  if (edges.length > MAX_RAW_EDGES) return `A canvas holds at most ${MAX_RAW_EDGES} connections.`;

  const ids = new Set<string>();
  for (const node of nodes) {
    if (!isRecord(node)) return 'Every node must be an object.';
    const { id, type, position, width, height, data } = node;
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID) return 'Every node needs a string id of up to 200 characters.';
    if (ids.has(id)) return `Duplicate node id "${id}".`;
    ids.add(id);
    if (typeof type !== 'string' || !RAW_NODE_TYPES.has(type)) return `Node "${id}" has an unsupported type.`;
    if (!isRecord(position) || !finite(position.x) || !finite(position.y) || Math.abs(position.x) > MAX_COORD || Math.abs(position.y) > MAX_COORD) {
      return `Node "${id}" needs a numeric position within ±${MAX_COORD}.`;
    }
    for (const size of [width, height]) {
      if (size !== undefined && (!finite(size) || size < 0 || size > 20_000)) return `Node "${id}" has an invalid size.`;
    }
    if (data !== undefined && !isRecord(data)) return `Node "${id}" has invalid data.`;
  }
  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (!isRecord(edge)) return 'Every connection must be an object.';
    const { id, source, target } = edge;
    if (typeof id !== 'string' || typeof source !== 'string' || typeof target !== 'string') return 'Every connection needs string id, source and target.';
    if (edgeIds.has(id)) return `Duplicate connection id "${id}".`;
    edgeIds.add(id);
    if (!ids.has(source) || !ids.has(target)) return `Connection "${id}" joins a node that does not exist.`;
  }
  if (JSON.stringify([nodes, edges]).length > MAX_RAW_BYTES) return 'The canvas is too large.';
  return null;
}
