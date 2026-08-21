import type { Node, Edge } from 'reactflow';
import { isTextNode } from '@/lib/mermaid/textNodes';
import { isDirectiveOnlyShape } from '@/lib/shapeRegistry';

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '\\"');
}

/** Emit an `%% archdraw-shape` override for silhouettes with no native token. */
function formatShapeDirective(id: string, shape: string): string | null {
  if (!isDirectiveOnlyShape(shape)) return null;
  return `  %% archdraw-shape: ${JSON.stringify({ id: sanitizeId(id), shape })}`;
}

function formatNodeWithShape(id: string, label: string, shape?: string): string {
  const cleanId = sanitizeId(id);
  const escaped = escapeLabel(label);
  
  if (!shape) return `${cleanId}["${escaped}"]`;
  
  switch (shape) {
    case 'cylinder':
      return `${cleanId}[("${escaped}")]`;
    case 'diamond':
      return `${cleanId}{"${escaped}"}`;
    case 'circle':
      return `${cleanId}(("${escaped}"))`;
    case 'hexagon':
      return `${cleanId}{{"${escaped}"}}`;
    case 'rounded-rectangle':
    case 'rounded':
      return `${cleanId}("${escaped}")`;
    case 'parallelogram':
      return `${cleanId}[/"${escaped}"/]`;
    default:
      return `${cleanId}["${escaped}"]`;
  }
}

/** Resolve the subgraph/node a text element is anchored to. */
function resolveTextAnchorTarget(node: Node): string | undefined {
  const data = node.data as Record<string, unknown>;
  const anchorTarget = data.anchorTarget as string | undefined;
  if (anchorTarget) return anchorTarget;
  return (node.parentNode as string | undefined) || (node as { parentId?: string }).parentId;
}

/**
 * Serialize a text/annotation node back into an `%% archdraw-*` directive so it
 * round-trips through the canonical Mermaid path. Returns null for nodes the
 * parser could not re-read (e.g. empty text).
 */
function formatTextDirective(node: Node): string | null {
  const data = node.data as Record<string, unknown>;
  const anchor = (data.anchor as string) || 'none';
  const base: Record<string, unknown> = {
    id: sanitizeId(node.id),
    anchor,
  };

  const target = resolveTextAnchorTarget(node);
  if (target && (anchor === 'subgraph' || anchor === 'node')) {
    base.anchorTarget = sanitizeId(target);
  }

  if (anchor === 'none' && node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number') {
    base.x = Math.round(node.position.x);
    base.y = Math.round(node.position.y);
  }

  if (node.type === 'annotationNode') {
    base.title = String(data.title ?? '');
    base.body = String(data.body ?? '');
    const size = data.titleSize as string;
    if (size) base.size = size;
    return `  %% archdraw-note: ${JSON.stringify(base)}`;
  }

  base.text = String(data.text ?? '');
  if (!base.text) return null;
  const fontSize = data.fontSize as string;
  if (fontSize) base.size = fontSize;
  return `  %% archdraw-text: ${JSON.stringify(base)}`;
}

export function reactFlowToMermaid(nodes: Node[], edges: Edge[], direction: 'TD' | 'LR' = 'TD'): string {
  const groupNodes = nodes.filter(n => n.type === 'groupNode' || n.data?.isGroup);
  const groupIds = new Set(groupNodes.map(n => n.id));
  const regularNodes = nodes.filter(n => !groupIds.has(n.id) && !isTextNode(n));
  const textNodes = nodes.filter(isTextNode);

  const lines: string[] = [];
  lines.push(`graph ${direction}`);
  lines.push('');

  for (const textNode of textNodes) {
    const directive = formatTextDirective(textNode);
    if (directive) lines.push(directive);
  }
  if (textNodes.length > 0) {
    lines.push('');
  }

  const resolveParentId = (n: Node): string | undefined =>
    n.parentNode ||
    (n as { parentId?: string }).parentId ||
    (n.data?.parentId as string | undefined);

  // Build a map of group children (including nested groups)
  const groupChildren = new Map<string, Node[]>();
  for (const node of regularNodes) {
    const parentId = resolveParentId(node);
    if (parentId && groupIds.has(parentId)) {
      const children = groupChildren.get(parentId) || [];
      children.push(node);
      groupChildren.set(parentId, children);
    }
  }

  // Build a map of nested groups (groups that are children of other groups)
  const nestedGroups = new Map<string, Node[]>();
  for (const group of groupNodes) {
    const parentId = resolveParentId(group);
    if (parentId && groupIds.has(parentId)) {
      const children = nestedGroups.get(parentId) || [];
      children.push(group);
      nestedGroups.set(parentId, children);
    }
  }

  // Find top-level groups (no parent)
  const topLevelGroups = groupNodes.filter(n => {
    const parentId = resolveParentId(n);
    return !parentId || !groupIds.has(parentId);
  });

  // Recursively render a group and its contents
  const renderGroup = (group: Node, indent: number) => {
    const gid = sanitizeId(group.id);
    const glabel = escapeLabel(String(group.data?.label ?? group.id));
    const prefix = '  '.repeat(indent);
    lines.push(`${prefix}subgraph ${gid}["${glabel}"]`);

    // Render child groups first (nested)
    const childGroups = nestedGroups.get(group.id) || [];
    for (const childGroup of childGroups) {
      renderGroup(childGroup, indent + 1);
    }

    // Render child nodes
    const children = groupChildren.get(group.id) || [];
    for (const child of children) {
      const cshape = child.data?.shape as string | undefined;
      const directive = formatShapeDirective(child.id, cshape ?? '');
      if (directive) lines.push(`${prefix}  ${directive}`);
      lines.push(`${prefix}  ${formatNodeWithShape(child.id, String(child.data?.label ?? child.id), cshape)}`);
    }

    lines.push(`${prefix}end`);
    lines.push('');
  };

  // Render all top-level groups
  for (const group of topLevelGroups) {
    renderGroup(group, 1);
  }

  // Render ungrouped nodes
  const ungrouped = regularNodes.filter(n => {
    const parentId = resolveParentId(n);
    return !parentId || !groupIds.has(parentId);
  });
  for (const node of ungrouped) {
    const nshape = node.data?.shape as string | undefined;
    const directive = formatShapeDirective(node.id, nshape ?? '');
    if (directive) lines.push(`  ${directive}`);
    lines.push(`  ${formatNodeWithShape(node.id, String(node.data?.label ?? node.id), nshape)}`);
  }

  if (ungrouped.length > 0) {
    lines.push('');
  }

  for (const edge of edges) {
    const src = sanitizeId(edge.source);
    const tgt = sanitizeId(edge.target);
    const data = (edge.data ?? {}) as Record<string, unknown>;
    const edgeVariant = data.edgeVariant as string | undefined;
    const connectionType = data.connectionType as string | undefined;
    const edgeType = data.edgeType as string | undefined;
    // The renderer treats data.label as canonical when top-level label is
    // absent — read both so labeled edges survive the round-trip.
    const rawLabel = edge.label ?? (data.label as string | undefined);
    const elabel = rawLabel ? escapeLabel(String(rawLabel)) : '';

    // Resolve the effective edge kind the way the renderer does:
    // edgeVariant || connectionType || edgeType (data/edgeTypes.ts).
    const resolvedVariant = edgeVariant || connectionType || edgeType;
    const isAsyncFamily =
      connectionType === 'async' ||
      edgeType === 'async' ||
      edgeType === 'stream' ||
      edgeType === 'event' ||
      edgeType === 'dep' ||
      data.syncAsync === 'async';

    let arrow: string;
    if (resolvedVariant === 'invisible' || edge.hidden) {
      // Layout-only edges (Mermaid `~~~`) must stay invisible, not degrade
      // into visible dotted arrows.
      arrow = '~~~';
    } else if (resolvedVariant === 'thick') {
      arrow = '==>';
    } else if (
      resolvedVariant === 'bidirectional' ||
      // Markers live at the top level of React Flow edges, not in data.
      (edge.markerStart && edge.markerEnd)
    ) {
      arrow = '<-->';
    } else if (resolvedVariant === 'dashed' || resolvedVariant === 'dotted' || isAsyncFamily) {
      arrow = elabel ? `-.${elabel}.->` : '-.->';
    } else {
      arrow = '-->';
    }

    // `~~~` carries no label syntax — drop the pill for invisible edges.
    if (elabel && !arrow.includes(elabel) && arrow !== '~~~') {
      lines.push(`  ${src} ${arrow}|"${elabel}"| ${tgt}`);
    } else {
      lines.push(`  ${src} ${arrow} ${tgt}`);
    }
  }

  return lines.join('\n');
}

