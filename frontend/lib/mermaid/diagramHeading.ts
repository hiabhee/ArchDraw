import type { Node } from 'reactflow';
import { estimateTextNodeSize, TEXT_LABEL_COLOR_LIGHT } from '@/lib/utils/textSizing';
import { isTextNode } from './textNodes';

/** Stable id for the diagram title node emitted by AI / templates. */
export const DIAGRAM_TITLE_ID = 'title';

export function hasLayoutableNodes(nodes: Node[]): boolean {
  return nodes.some((node) => !isTextNode(node) && node.type !== 'annotationNode');
}

/** Top-anchored heading that rides above the graph through relayout / layout toggle. */
export function findDiagramTitleNode(nodes: Node[]): Node | undefined {
  const byId = nodes.find((n) => n.id === DIAGRAM_TITLE_ID && n.type === 'textLabelNode');
  if (byId) return byId;

  return nodes.find((node) => {
    if (node.type !== 'textLabelNode') return false;
    const data = node.data as Record<string, unknown>;
    return data.anchor === 'top' && data.fontSize === 'heading';
  });
}

export function createDiagramTitleNode(text: string, id = DIAGRAM_TITLE_ID): Node {
  const title = text.trim() || 'Diagram';
  const dims = estimateTextNodeSize(title, 'heading');

  return {
    id,
    type: 'textLabelNode',
    position: { x: 0, y: 0 },
    width: dims.width,
    height: dims.height,
    data: {
      text: title,
      label: title,
      fontSize: 'heading',
      anchor: 'top',
      color: TEXT_LABEL_COLOR_LIGHT,
    },
  };
}

function syncTitleDimensions(node: Node, text: string): Node {
  const dims = estimateTextNodeSize(text || 'Diagram', 'heading');
  return {
    ...node,
    width: dims.width,
    height: dims.height,
    data: {
      ...node.data,
      fontSize: 'heading',
      anchor: 'top',
    },
  };
}

/**
 * Preserve an existing top-anchored heading if present; never auto-create one.
 * Headings are now opt-in — AI/templates only emit a title when explicitly requested.
 * The heading is excluded from Dagre and repositioned above the graph after layout.
 */
export function ensureDiagramHeading(nodes: Node[], _title?: string): Node[] {
  if (!hasLayoutableNodes(nodes)) return nodes;

  const existing = findDiagramTitleNode(nodes);
  if (!existing) return nodes;

  const data = existing.data as Record<string, unknown>;
  const currentText = String(data.text ?? data.label ?? '').trim();
  const nextText = currentText || 'Diagram';

  return nodes.map((node) => {
    if (node.id !== existing.id) return node;
    return syncTitleDimensions(
      {
        ...node,
        data: {
          ...node.data,
          text: nextText,
          label: nextText,
          anchor: 'top',
          fontSize: 'heading',
        },
      },
      nextText,
    );
  });
}
