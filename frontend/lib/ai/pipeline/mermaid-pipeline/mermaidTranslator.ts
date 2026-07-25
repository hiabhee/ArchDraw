import type { Node, Edge } from 'reactflow';

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '\\"');
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
    case 'rounded-rectangle':
    case 'rounded':
      return `${cleanId}("${escaped}")`;
    case 'parallelogram':
      return `${cleanId}[/"${escaped}"/]`;
    default:
      return `${cleanId}["${escaped}"]`;
  }
}

export function reactFlowToMermaid(nodes: Node[], edges: Edge[], direction: 'TD' | 'LR' = 'TD'): string {
  const groupNodes = nodes.filter(n => n.type === 'groupNode' || n.data?.isGroup);
  const groupIds = new Set(groupNodes.map(n => n.id));
  const regularNodes = nodes.filter(n => !groupIds.has(n.id));

  const lines: string[] = [];
  lines.push(`graph ${direction}`);
  lines.push('');

  for (const group of groupNodes) {
    const gid = sanitizeId(group.id);
    const glabel = escapeLabel(String(group.data?.label ?? group.id));
    lines.push(`  subgraph ${gid}["${glabel}"]`);

    const children = regularNodes.filter(n => n.parentNode === group.id || n.data?.parentId === group.id);
    for (const child of children) {
      lines.push(`    ${formatNodeWithShape(child.id, String(child.data?.label ?? child.id), child.data?.shape)}`);
    }

    lines.push('  end');
    lines.push('');
  }

  const ungrouped = regularNodes.filter(n => !n.parentNode && !n.data?.parentId);
  for (const node of ungrouped) {
    lines.push(`  ${formatNodeWithShape(node.id, String(node.data?.label ?? node.id), node.data?.shape)}`);
  }

  if (ungrouped.length > 0) {
    lines.push('');
  }

  for (const edge of edges) {
    const src = sanitizeId(edge.source);
    const tgt = sanitizeId(edge.target);
    const edgeVariant = edge.data?.edgeVariant as string | undefined;
    const connectionType = edge.data?.connectionType as string | undefined;
    const elabel = edge.label ? escapeLabel(String(edge.label)) : '';

    let arrow: string;
    if (edgeVariant === 'thick') {
      arrow = '==>';
    } else if (edgeVariant === 'dashed' || connectionType === 'async') {
      arrow = elabel ? `-.${elabel}.->` : '-.->';
    } else if (edge.data?.markerStart && edge.data?.markerEnd) {
      arrow = '<-->';
    } else {
      arrow = '-->';
    }

    if (elabel && !arrow.includes(elabel)) {
      lines.push(`  ${src} ${arrow}|"${elabel}"| ${tgt}`);
    } else {
      lines.push(`  ${src} ${arrow} ${tgt}`);
    }
  }

  return lines.join('\n');
}

