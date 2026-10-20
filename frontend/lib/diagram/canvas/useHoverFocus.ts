'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Edge, Node, NodeMouseHandler } from 'reactflow';
import { computeSelectionFocus, selectionFocusCss } from './selectionFocus';

/** Hover dims harder than selection: it is a quick "where does this connect?" glance. */
export const HOVER_DIM_OPACITY = 0.28;

/**
 * Hover focus: pointing at a component keeps its whole flow visible (every
 * component upstream and downstream of it, and the edges between) and dims
 * the rest. Same CSS as selection focus; pure view state, safe on read-only hosts.
 * Groups are skipped (hovering a whole area would light up most of the map).
 */
export function useHoverFocus(nodes: readonly Node[], edges: readonly Edge[], enabled = true) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const onNodeMouseEnter = useCallback<NodeMouseHandler>((_event, node) => {
    setHoveredId(node.type === 'groupNode' ? null : node.id);
  }, []);
  const onNodeMouseLeave = useCallback<NodeMouseHandler>(() => setHoveredId(null), []);

  const css = useMemo(() => {
    if (!enabled || !hoveredId) return null;
    const focus = computeSelectionFocus([hoveredId], nodes, edges, { flow: true });
    return focus ? selectionFocusCss(focus, HOVER_DIM_OPACITY) : null;
  }, [enabled, hoveredId, nodes, edges]);

  return { css, onNodeMouseEnter, onNodeMouseLeave };
}
