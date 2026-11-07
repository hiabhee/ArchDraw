'use client';

import { memo, useMemo } from 'react';
import { NodeProps, NodeResizer, useStore } from 'reactflow';
import { NodeHandles } from '@/components/canvas/nodes/NodeHandles';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { useCanvasTheme } from '@/lib/theme/appTheme';
import { CustomNodeIcon } from '@/lib/icons/CustomNodeIcon';
import { statIconName, statLayout, type StatNodeData, infographicNodeSize } from '@/lib/diagram/nodes/infographicNodes';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

/** A big number with its label: "99.9% uptime", "3 regions" (see infographicNodes). */
export const StatNode = memo(function StatNode({ id, data, selected }: NodeProps<StatNodeData>) {
  const { readOnly } = useCanvasView();
  const { isDark } = useCanvasTheme();
  const w = useStore((s) => Math.max(1, infographicNodeSize(s.nodeInternals.get(id), { width: 220, height: 150 }).width));
  const h = useStore((s) => Math.max(1, infographicNodeSize(s.nodeInternals.get(id), { width: 220, height: 150 }).height));
  const icon = statIconName(data, isDark);
  const layout = useMemo(() => statLayout(data, w, h, isDark, Boolean(icon)), [data, w, h, isDark, icon]);
  return (
    <div className="stat-node relative h-full w-full">
      {!readOnly && <NodeResizer isVisible={selected} minWidth={140} minHeight={90} />}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block" role="img" aria-label={[data.value, data.label, data.caption].filter(Boolean).join(' ')}>
        <rect x={0.5} y={0.5} width={w - 1} height={h - 1} rx={14} ry={14} fill={layout.surface} stroke={selected ? layout.selectedBorder : layout.border} strokeWidth={selected ? 2 : 1} />
        {icon && layout.icon && (
          <g transform={`translate(${layout.icon.x}, ${layout.icon.y})`}>
            <CustomNodeIcon name={icon} color={layout.iconColor} size={layout.icon.size} />
          </g>
        )}
        {layout.value && (
          <text x={layout.x} y={layout.value.y} fill={layout.valueColor} fontFamily={FONT} fontSize={layout.value.px} fontWeight={600} letterSpacing={-0.5}>{layout.value.text}</text>
        )}
        {layout.label && (
          <text x={layout.x} y={layout.label.y} fill={layout.labelColor} fontFamily={FONT} fontSize={layout.label.px} fontWeight={600}>
            {layout.label.lines.map((line, i) => <tspan key={i} x={layout.x} dy={i === 0 ? 0 : layout.label!.line}>{line}</tspan>)}
          </text>
        )}
        {layout.caption && (
          <text x={layout.x} y={layout.caption.y} fill={layout.captionColor} fontFamily={FONT} fontSize={layout.caption.px} fontWeight={400}>
            {layout.caption.lines.map((line, i) => <tspan key={i} x={layout.x} dy={i === 0 ? 0 : layout.caption!.line}>{line}</tspan>)}
          </text>
        )}
      </svg>
      <NodeHandles />
    </div>
  );
});
