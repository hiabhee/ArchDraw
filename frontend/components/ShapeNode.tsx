'use client';

import { memo, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow';
import { useCanvasTheme } from '@/lib/theme';
import { LIGHT_NODE_STYLES, DARK_NODE_STYLES, type NodeStyleConfig } from '@/lib/theme/stylingConstants';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { useInlineLabelEdit } from '@/hooks/useInlineLabelEdit';
import { useDiagramStore } from '@/store/diagramStore';
import { NodeIcon } from '@/components/NodeIcon';
import { resolveNodeIcon } from '@/lib/nodeIconResolver';
import { CustomNodeIcon, toCustomNodeIconName, type CustomNodeIconName } from '@/components/icons/CustomNodeIcon';
import './nodes/nodeStyles.css';

export type ShapeType =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'diamond'
  | 'cylinder'
  | 'circle'
  | 'parallelogram';

export interface ShapeNodeData {
  label: string;
  sublabel?: string;
  shape: ShapeType;
  color?: string;
  accentColor?: string;
  category?: string;
  componentType?: string;
  typeId?: string;
  icon?: string;
  iconSource?: string;
  technology?: string;
  serviceType?: string;
  nodeWidth?: number;
  nodeHeight?: number;
}

/** Fit to optical grid; wrap long labels inside the silhouette mid-band. */
function resolveShapeSize(data: ShapeNodeData): { width: number; height: number; labelMaxWidth: number } {
  const fitted = calculateNodeDimensions(data.label || '', data.sublabel, { shape: data.shape });
  const width = Math.max(data.nodeWidth ?? 0, fitted.width);
  const height = Math.max(data.nodeHeight ?? 0, fitted.height);
  // Keep text inside silhouette: diamonds/circles use a narrower mid-band.
  // Band fractions must stay aligned with SHAPE_TEXT_BAND in nodeSizing.ts.
  const band =
    data.shape === 'diamond' || data.shape === 'circle'
      ? 0.48
      : data.shape === 'parallelogram'
        ? 0.72
        : 0.88;
  return { width, height, labelMaxWidth: Math.max(72, Math.round(width * band)) };
}

const HANDLE_STYLE = (color: string) => ({
  width: 12,
  height: 12,
  background: '#ffffff',
  border: `2px solid ${color}60`,
  borderRadius: '50%',
  boxShadow: '0 2px 8px hsl(var(--foreground) / 0.15)',
  opacity: 0,
  transition: 'opacity 0.15s ease',
});

const CENTER_HANDLE: React.CSSProperties = {
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 1,
  height: 1,
  border: 'none',
  background: 'transparent',
  minWidth: 0,
  minHeight: 0,
};

function CustomNodeVisual({ name, color }: { name: CustomNodeIconName; color: string }) {
  const cellCount = name === 'arch-message-queue' ? 8 : 6;
  const filledCells = name === 'arch-partition' ? 2 : name === 'arch-event-stream' ? 5 : 4;

  if (name === 'arch-web') {
    return (
      <div className="node-object node-object-browser" style={{ borderColor: `${color}88` }}>
        <span style={{ background: color }} />
        <span style={{ background: color, opacity: 0.55 }} />
        <span style={{ background: color, opacity: 0.32 }} />
      </div>
    );
  }

  if (name === 'arch-server' || name === 'arch-service') {
    return (
      <div className="node-object node-object-lines">
        <span style={{ width: '86%', background: `${color}18` }} />
        <span style={{ width: '66%', background: `${color}16` }} />
        <span style={{ width: '78%', background: `${color}13` }} />
        <span style={{ width: '52%', background: `${color}11` }} />
      </div>
    );
  }

  if (name === 'arch-database') {
    return (
      <div className="node-object node-object-db" style={{ borderColor: `${color}55` }}>
        <span style={{ background: `${color}30` }} />
        <span style={{ background: `${color}14`, width: '78%' }} />
        <span style={{ background: `${color}12`, width: '92%' }} />
      </div>
    );
  }

  if (name === 'arch-message-queue' || name === 'arch-event-stream' || name === 'arch-partition') {
    return (
      <div className="node-object node-object-queue" style={{ borderColor: `${color}72`, background: `${color}10` }}>
        {Array.from({ length: cellCount }, (_, i) => (
          <span
            key={i}
            style={{
              background: color,
              opacity: i < filledCells ? 0.9 - i * 0.12 : 0.12,
            }}
          />
        ))}
      </div>
    );
  }

  if (name === 'arch-topic') {
    return (
      <div className="node-object node-object-topic" style={{ borderColor: `${color}55` }}>
        <span style={{ background: `${color}24` }} />
        <span style={{ background: `${color}16` }} />
      </div>
    );
  }

  if (name === 'arch-api-gateway' || name === 'arch-load-balancer') {
    return (
      <div className="node-object node-object-route">
        <span style={{ borderColor: color }} />
        <i style={{ background: color }} />
        <span style={{ borderColor: color }} />
      </div>
    );
  }

  return (
    <div className="node-object node-object-mark">
      <CustomNodeIcon name={name} color={color} size={30} />
    </div>
  );
}

/**
 * Node Handles — renders exactly 2 handles per side (one source, one target).
 */
function Handles({ color, nodeId }: { color: string; nodeId: string }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const s = HANDLE_STYLE(color);

  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, updateNodeInternals]);

  return (
    <NodeHandles handleStyle={s} nodeId={nodeId} />
  );
}

function Label({
  data,
  color,
  nodeId,
  maxWidth,
}: {
  data: ShapeNodeData;
  color: string;
  nodeId: string;
  maxWidth?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const showNodeIcons = useDiagramStore((s) => s.showNodeIcons);
  const diagramChromeMode = useDiagramStore((s) => s.diagramChromeMode);
  const labelEdit = useInlineLabelEdit({
    nodeId,
    currentLabel: data.label || '',
    containerRef,
  });
  const resolvedIcon = resolveNodeIcon({
    label: data.label,
    typeId: data.typeId,
    componentType: data.componentType,
    serviceType: data.serviceType,
    technology: data.technology,
    category: data.category,
    icon: data.icon,
    color,
  });
  const customVisual = diagramChromeMode === 'edit' ? toCustomNodeIconName(resolvedIcon.icon) : null;

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center text-center px-1 select-none"
      style={{ width: '100%', maxWidth: maxWidth ?? '100%' }}
    >
      {showNodeIcons && (
        <>
          {customVisual ? (
            <CustomNodeVisual name={customVisual} color={resolvedIcon.color} />
          ) : (
            <div
              className="node-icon-box mb-1"
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: `${color}14`,
              }}
            >
              <NodeIcon
                technology={resolvedIcon.technology}
                fallbackIcon={resolvedIcon.icon}
                fallbackColor={resolvedIcon.color}
                size={14}
              />
            </div>
          )}
        </>
      )}
      {labelEdit.isEditing ? (
        <input
          {...labelEdit.inputProps}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            margin: 0,
            lineHeight: 1.25,
            width: '100%',
            textAlign: 'center',
            boxSizing: 'border-box',
            borderRadius: 3,
            boxShadow: `0 0 0 2px ${color}`,
            cursor: 'text',
          }}
        />
      ) : (
        <span
          className="text-[13px] font-semibold text-foreground leading-snug"
          onDoubleClick={labelEdit.startEdit}
          style={{
            cursor: 'text',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'normal',
            maxWidth: '100%',
          }}
        >
          {data.label}
        </span>
      )}
      {data.sublabel && (
        <span
          className="text-[10px] font-medium tracking-wide mt-0.5"
          style={{ color: `${color}99`, maxWidth: '100%', overflowWrap: 'anywhere' }}
        >
          {data.sublabel}
        </span>
      )}
    </div>
  );
}

function Backplates({ layers, borderRadius }: { layers: { offset: number; color: string }[], borderRadius: number | string }) {
  return (
    <>
      {layers.map((layer, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: borderRadius,
            transform: `translate(${layer.offset}px, ${layer.offset}px)`,
            background: layer.color,
            zIndex: -1,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );
}

// ── Individual shape renderers ────────────────────────────────────────────────

function Rectangle({ id, data, selected, rounded, backplates, isDark, styles, width, height, labelMaxWidth }: { id: string; data: ShapeNodeData; selected: boolean; rounded: boolean; backplates: { offset: number; color: string }[]; isDark: boolean; styles: NodeStyleConfig; width: number; height: number; labelMaxWidth: number }) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const r = rounded ? 10 : 6;
  return (
    <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
      {backplates.length > 0 && <Backplates layers={backplates} borderRadius={r} />}
      <div
        style={{
          width,
          height,
          borderRadius: r,
          border: selected
            ? `2px solid ${color}`
            : isDark
              ? '1.25px solid rgba(255, 255, 255, 0.12)'
              : '1.25px solid rgba(15, 23, 42, 0.14)',
          background: isDark ? styles.background : '#ffffff',
          boxShadow: selected
            ? styles.shadowSelected
            : styles.shadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        }}
      >
        <Label data={data} color={color} nodeId={id} maxWidth={labelMaxWidth} />
      </div>
      <Handles color={color} nodeId={id} />
    </div>
  );
}

function Diamond({ id, data, selected, backplates, isDark, width: W, height: H, labelMaxWidth }: { id: string; data: ShapeNodeData; selected: boolean; backplates: { offset: number; color: string }[]; isDark: boolean; width: number; height: number; labelMaxWidth: number }) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={`${W / 2},4 ${W - 4},${H / 2} ${W / 2},${H - 4} 4,${H / 2}`} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <linearGradient id={`diamond-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`${color}12`} />
            <stop offset="100%" stopColor={`${color}05`} />
          </linearGradient>
        </defs>
        <polygon
          points={`${W / 2},4 ${W - 4},${H / 2} ${W / 2},${H - 4} 4,${H / 2}`}
          fill={`url(#diamond-grad-${id})`}
          stroke={selected ? color : isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.16)'}
          strokeWidth={selected ? 2 : 1.25}
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} maxWidth={labelMaxWidth} />
      </div>
    </div>
  );
}

function Cylinder({ id, data, selected, backplates, isDark, width: W, height: H, labelMaxWidth }: { id: string; data: ShapeNodeData; selected: boolean; backplates: { offset: number; color: string }[]; isDark: boolean; width: number; height: number; labelMaxWidth: number }) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const RY = Math.max(10, Math.round(H * 0.12));
  const stroke = selected ? color : isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.16)';
  const strokeW = selected ? 2 : 1.25;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50% / 15%', transform: `translate(${layer.offset}px, ${layer.offset}px)`, background: layer.color, zIndex: -1 }} />
      ))}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <linearGradient id={`cyl-body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDark ? `${color}18` : `${color}10`} />
            <stop offset="100%" stopColor={isDark ? `${color}08` : `${color}04`} />
          </linearGradient>
          <linearGradient id={`cyl-top-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDark ? `${color}22` : `${color}14`} />
            <stop offset="100%" stopColor={isDark ? `${color}10` : `${color}06`} />
          </linearGradient>
        </defs>
        <rect x={2} y={RY} width={W - 4} height={H - RY * 2} fill={`url(#cyl-body-${id})`} stroke={stroke} strokeWidth={strokeW} />
        <ellipse cx={W / 2} cy={H - RY} rx={(W - 4) / 2} ry={RY} fill={isDark ? `${color}12` : `${color}08`} stroke={stroke} strokeWidth={strokeW} />
        <ellipse cx={W / 2} cy={RY} rx={(W - 4) / 2} ry={RY} fill={`url(#cyl-top-${id})`} stroke={stroke} strokeWidth={strokeW} />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: RY }}>
        <Label data={data} color={color} nodeId={id} maxWidth={labelMaxWidth} />
      </div>
    </div>
  );
}

function Circle({ id, data, selected, backplates, isDark, width: W, height: H, labelMaxWidth }: { id: string; data: ShapeNodeData; selected: boolean; backplates: { offset: number; color: string }[]; isDark: boolean; width: number; height: number; labelMaxWidth: number }) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.length > 0 && <Backplates layers={backplates} borderRadius="50%" />}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        <ellipse
          cx={W / 2} cy={H / 2} rx={W / 2 - 2} ry={H / 2 - 2}
          fill={isDark ? `${color}14` : `${color}08`}
          stroke={selected ? color : isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.16)'}
          strokeWidth={selected ? 2 : 1.25}
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} maxWidth={labelMaxWidth} />
      </div>
    </div>
  );
}

function Parallelogram({ id, data, selected, backplates, isDark, width: W, height: H, labelMaxWidth }: { id: string; data: ShapeNodeData; selected: boolean; backplates: { offset: number; color: string }[]; isDark: boolean; width: number; height: number; labelMaxWidth: number }) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const SKEW = Math.min(20, Math.round(W * 0.08));
  const pts = `${SKEW},2 ${W - 2},2 ${W - SKEW - 2},${H - 2} 2,${H - 2}`;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
       {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={pts} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <polygon
          points={pts}
          fill={isDark ? `${color}14` : `${color}08`}
          stroke={selected ? color : isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.16)'}
          strokeWidth={selected ? 2 : 1.25}
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} maxWidth={labelMaxWidth} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function ShapeNodeComponent({ id, data, selected }: NodeProps<ShapeNodeData>) {
  const { isDark } = useCanvasTheme();
  const styles = isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES;
  const backplates = styles.backplates;
  const { width, height, labelMaxWidth } = resolveShapeSize(data);
  const sized = { width, height, labelMaxWidth };
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, width, height, updateNodeInternals]);

  const renderShape = () => {
    switch (data.shape) {
      case 'diamond':          return <Diamond id={id} data={data} selected={!!selected} backplates={backplates} isDark={isDark} {...sized} />;
      case 'cylinder':         return <Cylinder id={id} data={data} selected={!!selected} backplates={backplates} isDark={isDark} {...sized} />;
      case 'circle':           return <Circle id={id} data={data} selected={!!selected} backplates={backplates} isDark={isDark} {...sized} />;
      case 'parallelogram':    return <Parallelogram id={id} data={data} selected={!!selected} backplates={backplates} isDark={isDark} {...sized} />;
      case 'rounded-rectangle': return <Rectangle id={id} data={data} selected={!!selected} rounded backplates={backplates} isDark={isDark} styles={styles} {...sized} />;
      default:                 return <Rectangle id={id} data={data} selected={!!selected} rounded={false} backplates={backplates} isDark={isDark} styles={styles} {...sized} />;
    }
  };

  return renderShape();
}

export const ShapeNode = memo(ShapeNodeComponent);
