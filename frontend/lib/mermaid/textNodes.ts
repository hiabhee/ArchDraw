export const TEXT_NODE_TYPES = new Set(['textLabelNode', 'annotationNode']);

export function isTextNode(node: { type?: string | null }): boolean {
  return TEXT_NODE_TYPES.has(node.type ?? '');
}
