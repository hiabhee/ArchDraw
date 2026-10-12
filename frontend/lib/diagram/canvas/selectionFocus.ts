import type { Edge, Node } from 'reactflow';

/**
 * Selection focus: with nodes selected, the selection, its first-degree
 * neighbours (incoming and outgoing) and the edges between them stay fully
 * visible; everything else is dimmed. Pure view state — applied as CSS, never
 * written into the graph.
 */
export interface SelectionFocus {
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
}

/** CSS class on the canvas wrapper while a focus is active. */
export const SELECTION_FOCUS_CLASS = 'archdraw-focus';

function parentOf(node: Node): string | undefined {
  return node.parentNode ?? (node as Node & { parentId?: string }).parentId ?? undefined;
}

export function computeSelectionFocus(
  selectedIds: readonly string[],
  nodes: readonly Node[],
  edges: readonly Edge[],
): SelectionFocus | null {
  if (selectedIds.length === 0) return null;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    const parent = parentOf(node);
    if (!parent) continue;
    const list = children.get(parent) ?? [];
    list.push(node.id);
    children.set(parent, list);
  }

  // A selected group stands for everything inside it.
  const focused = new Set<string>();
  const pending = selectedIds.filter((id) => byId.has(id));
  while (pending.length) {
    const id = pending.pop()!;
    if (focused.has(id)) continue;
    focused.add(id);
    pending.push(...(children.get(id) ?? []));
  }
  if (focused.size === 0) return null;

  const nodeIds = new Set(focused);
  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (!focused.has(edge.source) && !focused.has(edge.target)) continue;
    edgeIds.add(edge.id);
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  // Keep the containers of every visible node, so neighbours keep their context.
  for (const id of [...nodeIds]) {
    let parent = byId.get(id) ? parentOf(byId.get(id)!) : undefined;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      nodeIds.add(parent);
      parent = byId.get(parent) ? parentOf(byId.get(parent)!) : undefined;
    }
  }
  return { nodeIds, edgeIds };
}

function attr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Stylesheet that dims everything outside the focus (scoped to the focus class). */
export function selectionFocusCss(focus: SelectionFocus, dimOpacity = 0.5): string {
  const scope = `.${SELECTION_FOCUS_CLASS}`;
  const keep = [
    ...[...focus.nodeIds].map((id) => `${scope} .react-flow__node[data-id="${attr(id)}"]`),
    ...[...focus.edgeIds].map((id) => `${scope} .react-flow__edge[data-testid="rf__edge-${attr(id)}"]`),
    ...[...focus.edgeIds].map((id) => `${scope} [data-edge-label="${attr(id)}"]`),
  ];
  // `!important`: globals.css pins `.react-flow__node` / `.react-flow__edge` to
  // `opacity: 1 !important`; these scoped rules are more specific, so they win
  // only while a focus is active.
  return [
    `${scope} .react-flow__node, ${scope} .react-flow__edge, ${scope} [data-edge-label] { opacity: ${dimOpacity} !important; }`,
    keep.length ? `${keep.join(',\n')} { opacity: 1 !important; }` : '',
    // Keep the node's own transform/shadow transitions alongside the fade.
    `${scope} .react-flow__node { transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 150ms ease; }`,
    `${scope} .react-flow__edge, ${scope} [data-edge-label] { transition: opacity 150ms ease; }`,
    `@media (prefers-reduced-motion: reduce) { ${scope} .react-flow__node, ${scope} .react-flow__edge, ${scope} [data-edge-label] { transition: none; } }`,
  ].join('\n');
}
