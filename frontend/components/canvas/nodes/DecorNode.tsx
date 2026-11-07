'use client';

import { createElement, memo } from 'react';
import { NodeProps, NodeResizer, useStore } from 'reactflow';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { useCanvasTheme } from '@/lib/theme/appTheme';
import { decorOpacity, decorPrimitives, type DecorNodeData, infographicNodeSize } from '@/lib/diagram/nodes/infographicNodes';

const toReactAttrs = (attrs: Record<string, string | number>) =>
  Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), value]));

/** A plain shape behind the diagram: a panel, a circle, a line or an arrow (see infographicNodes). */
export const DecorNode = memo(function DecorNode({ id, data, selected }: NodeProps<DecorNodeData>) {
  const { readOnly } = useCanvasView();
  const { isDark } = useCanvasTheme();
  const w = useStore((s) => Math.max(1, infographicNodeSize(s.nodeInternals.get(id), { width: 200, height: 100 }).width));
  const h = useStore((s) => Math.max(1, infographicNodeSize(s.nodeInternals.get(id), { width: 200, height: 100 }).height));
  const line = data.kind === 'line' || data.kind === 'arrow';
  return (
    <div className="decor-node h-full w-full" style={{ opacity: decorOpacity(data) }}>
      {!readOnly && <NodeResizer isVisible={selected} minWidth={line ? 8 : 16} minHeight={line ? 8 : 16} />}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block overflow-visible" aria-hidden>
        {decorPrimitives(data, w, h, isDark).map((primitive, index) => createElement(primitive.tag, { key: index, ...toReactAttrs(primitive.attrs) }))}
      </svg>
    </div>
  );
});
