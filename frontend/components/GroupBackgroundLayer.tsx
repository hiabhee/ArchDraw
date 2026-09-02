'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDiagramStore } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme';
import { useDiagramAesthetics } from '@/lib/theme/useDiagramAesthetics';

/**
 * Renders group plates *behind* the edge SVG for neubrutalism.
 * In brutal the group fill is opaque (#dbeafe) so a group at zIndex 0
 * (nodes container is after edges in DOM) covers edge paths. The normal
 * fix is zIndex:-1 on the wrapper, but that is fragile across React Flow
 * stacking contexts and HMR. This layer is a direct child of
 * .react-flow__viewport (before .react-flow__edges in paint order) with
 * position:absolute and pointerEvents:none, so its rects are guaranteed
 * behind edges regardless of wrapper zIndex. GroupNode itself renders
 * transparent in brutal and lets this layer provide the visual plate.
 */
export function GroupBackgroundLayer() {
  const nodes = useDiagramStore((s) => s.nodes);
  const { isDark } = useCanvasTheme();
  const aesthetics = useDiagramAesthetics();
  const brutal = aesthetics.renderStyleId === 'neubrutalism';

  const groups = useMemo(() => {
    if (!brutal) return [];
    return nodes.filter(
      (n) =>
        n.type === 'groupNode' ||
        n.type === 'group' ||
        n.type === 'frameNode' ||
        (n.data as { isGroup?: boolean } | undefined)?.isGroup === true
    );
  }, [nodes, brutal]);

  const [viewportEl, setViewportEl] = useState<Element | null>(null);

  useEffect(() => {
    // .react-flow__viewport is created by ReactFlow; portal the layer there
    // as its first child so it paints before .react-flow__edges.
    const el = document.querySelector('.react-flow__viewport');
    setViewportEl(el);
    if (!el) return;
    const obs = new MutationObserver(() => {
      const next = document.querySelector('.react-flow__viewport');
      if (next !== el) setViewportEl(next);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  if (!brutal || groups.length === 0 || !viewportEl) return null;

  // Very light pastel palette — low contrast, soft tints only (no dark/high-contrast fills).
  // User asked for lighter shades of blue/green/yellow/etc exclusively.
  const BRUTAL_LIGHT_PALETTE = [
    '#eff6ff', // blue-50
    '#f0fdf4', // green-50
    '#fefce8', // yellow-50
    '#fdf2f8', // pink-50
    '#eef2ff', // indigo-50
    '#fff7ed', // orange-50
    '#faf5ff', // purple-50
    '#f0fdfa', // teal-50
  ] as const;
  const BRUTAL_DARK_PALETTE = [
    '#eff6ff', // blue-50 - keep light even in dark mode per request
    '#f0fdf4', // green-50
    '#fefce8', // yellow-50
    '#fdf2f8', // pink-50
    '#eef2ff', // indigo-50
    '#fff7ed', // orange-50
    '#faf5ff', // purple-50
    '#f0fdfa', // teal-50
  ] as const;

  // Stable order — sorted by id so color doesn't flicker when nodes reorder
  const orderedGroups = [...groups].sort((a, b) => a.id.localeCompare(b.id));

  const layer = (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        // Behind .react-flow__edges / __nodes (both z-index:auto inside the
        // viewport's stacking context). zIndex:-1 paints after the viewport's
        // own background but before any auto-positioned children, so the plate
        // stays behind edge paths even when appended last via portal.
        zIndex: -1,
      }}
    >
      {orderedGroups.map((node, idx) => {
        // Absolute position in flow coordinates — handle nested groups via
        // parent walk (same logic as edgeHelpers.getAbsolutePosition)
        let absX = node.position.x;
        let absY = node.position.y;
        let cur: typeof node | undefined = node;
        const seen = new Set<string>([node.id]);
        const byId = new Map(nodes.map((n) => [n.id, n]));
        while (cur && (cur.parentId || (cur as unknown as { parentNode?: string }).parentNode)) {
          const pid = cur.parentId || (cur as unknown as { parentNode?: string }).parentNode;
          if (!pid || seen.has(pid)) break;
          seen.add(pid);
          const parent = byId.get(pid);
          if (!parent || !parent.position) break;
          absX += parent.position.x;
          absY += parent.position.y;
          cur = parent;
        }
        const dataRec = node.data as { accentColor?: string; groupColor?: string; color?: string } | undefined;
        const custom = dataRec?.accentColor || dataRec?.groupColor || dataRec?.color;
        // Lighten any existing saturated custom color (old diagrams stored #2563eb etc) to pastel
        const toPastel = (hex: string) => {
          if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const nr = Math.round(r * 0.18 + 255 * 0.82);
          const ng = Math.round(g * 0.18 + 255 * 0.82);
          const nb = Math.round(b * 0.18 + 255 * 0.82);
          return `rgb(${nr}, ${ng}, ${nb})`;
        };
        const palette = isDark ? BRUTAL_DARK_PALETTE : BRUTAL_LIGHT_PALETTE;
        const bg = custom ? toPastel(custom) : palette[idx % palette.length];
        // Low-contrast soft border + subtle shadow per request (no black 3px / 5px hard shadow)
        // Derive a slightly darker tint of the bg for border - still light, not high-contrast
        const BRUTAL_LIGHT_BORDER = ['#dbeafe','#dcfce7','#fef08a','#fbcfe8','#ddd6fe','#fed7aa','#e9d5ff','#ccfbf1'] as const;
        const BRUTAL_DARK_BORDER = ['#dbeafe','#dcfce7','#fef08a','#fbcfe8','#ddd6fe','#fed7aa','#e9d5ff','#ccfbf1'] as const;
        const borderPalette = isDark ? BRUTAL_DARK_BORDER : BRUTAL_LIGHT_BORDER;
        const borderColor = custom ? 'rgba(15,23,42,0.12)' : borderPalette[idx % borderPalette.length];
        const width = node.width ?? (node.style as { width?: number })?.width ?? 300;
        const height = node.height ?? (node.style as { height?: number })?.height ?? 200;

        return (
          <div
            key={`group-bg-${node.id}`}
            style={{
              position: 'absolute',
              left: absX,
              top: absY,
              width,
              height,
              backgroundColor: bg,
              border: `1px solid ${borderColor}`,
              borderRadius: 10,
              boxShadow: isDark ? '0 1px 2px rgba(0,0,0,0.18)' : '0 1px 3px rgba(15,23,42,0.06)',
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </div>
  );

  return createPortal(layer, viewportEl);
}
