import type { Node } from 'reactflow';

const SESSION_ID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function isPreviewId(value: string): boolean {
  return SESSION_ID.test(value);
}

export function previewCopyUrl(
  shareUrl: string,
  copyId: string,
  initial: readonly Pick<Node, 'id' | 'position'>[],
  current: readonly Node[],
): string {
  const url = new URL(shareUrl);
  if (!url.pathname.startsWith('/share/') || !isPreviewId(url.pathname.slice(7))) return '';
  const original = new Map(initial.map(node => [node.id, node.position]));
  const moves = current.flatMap(({ id, position }) => {
    const before = original.get(id);
    if (!before || (before.x === position.x && before.y === position.y)) return [];
    return [[id, position.x, position.y]];
  });
  url.pathname += '/save';
  url.search = new URLSearchParams({ copy: copyId }).toString();
  url.hash = encodeURIComponent(JSON.stringify(moves));
  return url.href;
}

export function applyPreviewMoves(nodes: Node[], encodedMoves: string): Node[] {
  const moves: unknown = JSON.parse(decodeURIComponent(encodedMoves));
  if (!Array.isArray(moves) || moves.length > 500) throw new Error('The preview layout could not be restored.');
  const positions = new Map<string, Node['position']>();
  for (const move of moves) {
    if (!Array.isArray(move) || move.length !== 3) throw new Error('The preview layout could not be restored.');
    const [id, x, y] = move;
    if (typeof id !== 'string' || typeof x !== 'number' || typeof y !== 'number'
      || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) {
      throw new Error('The preview layout could not be restored.');
    }
    positions.set(id, { x, y });
  }
  return nodes.map(node => {
    const position = positions.get(node.id);
    return position ? { ...node, position } : node;
  });
}
