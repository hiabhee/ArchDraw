'use client';

import { memo, useEffect, useRef, type CSSProperties } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow';
import { useCanvasTheme } from '@/lib/theme';
import { LIGHT_NODE_STYLES, DARK_NODE_STYLES } from '@/lib/theme/stylingConstants';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { useInlineLabelEdit } from '@/hooks/useInlineLabelEdit';
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
  nodeWidth?: number;
  nodeHeight?: number;
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

function Label({ label, sublabel, color, nodeId }: { label: string; sublabel?: string; color: string; nodeId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelEdit = useInlineLabelEdit({
    nodeId,
    currentLabel: label || '',
    containerRef,
  });

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center text-center px-2 select-none"
      style={{ width: '100%' }}
    >
      {labelEdit.isEditing ? (
        <input
          {...labelEdit.inputProps}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            margin: 0,
            lineHeight: 1.3,
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
          className="text-[11px] font-semibold text-foreground leading-tight"
          onDoubleClick={labelEdit.startEdit}
          style={{ cursor: 'text' }}
        >
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color }}>
          {sublabel}
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

function Rectangle({ id, data, selected, rounded, backplates, isDark, styles }: { id: string; data: ShapeNodeData; selected: boolean; rounded: boolean; backplates: { offset: number; color: string }[]; isDark: boolean;     styles: CSSProperties }) {
  const color = data.accentColor ?? data.color ?? '#6B7280';
  const r = rounded ? 14 : 8;
  const width = data.nodeWidth ?? 140;
  const height = data.nodeHeight ?? 72;
  return (
    <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
      <Backplates layers={backplates} borderRadius={r} />
      <div
        style={{
          width,
          height,
          borderRadius: r,
          border: isDark ? '0.5px solid rgba(255, 255, 255, 0.12)' : '0.5px solid rgba(0, 0, 0, 0.08)',
          background: isDark ? styles.background : 'linear-gradient(145deg, #ffffff 0%, hsl(0 0% 98%) 100%)',
          boxShadow: selected 
            ? (isDark ? `0 0 0 2px ${color}, 0 8px 32px ${color}30, 0 4px 12px rgba(0,0,0,0.3)` : `0 0 0 2px ${color}, 0 8px 32px ${color}30, 0 4px 12px hsl(var(--foreground) / 0.1)`)
            : (isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px hsl(var(--foreground) / 0.08), inset 0 1px 0 hsl(var(--foreground) / 0.03)'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Colored shine overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: r,
          background: `linear-gradient(135deg, ${color}08 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />
        <Label label={data.label} sublabel={data.sublabel} color={color} nodeId={id} />
      </div>
      <Handles color={color} nodeId={id} />
    </div>
  );
}

function Diamond({ id, data, selected, backplates, isDark }: { id: string; data: ShapeNodeData; selected: boolean; backplates: { offset: number; color: string }[]; isDark: boolean }) {
  const color = data.accentColor ?? data.color ?? '#6B7280';
  const W = data.nodeWidth ?? 140;
  const H = data.nodeHeight ?? 80;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={`${W / 2},4 ${W - 4},${H / 2} ${W / 2},${H - 4} 4,${H / 2}`} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: selected ? `drop-shadow(0 0 8px ${color}40)` : 'none' }}>
        <defs>
          <linearGradient id={`diamond-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`${color}25`} />
            <stop offset="100%" stopColor={`${color}08`} />
          </linearGradient>
        </defs>
        <polygon
          points={`${W / 2},4 ${W - 4},${H / 2} ${W / 2},${H - 4} 4,${H / 2}`}
          fill={`url(#diamond-grad-${id})`}
          stroke={selected ? color : `${color}50`}
          strokeWidth={selected ? 2 : 0.5}
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label label={data.label} sublabel={data.sublabel} color={color} nodeId={id} />
      </div>
    </div>
  );
}

function Cylinder({ id, data, selected, backplates, isDark }: { id: string; data: ShapeNodeData; selected: boolean; backplates: { offset: number; color: string }[]; isDark: boolean }) {
  const color = data.accentColor ?? data.color ?? '#6B7280';
  const W = data.nodeWidth ?? 140;
  const H = data.nodeHeight ?? 90;
  const RY = 14;
  const stroke = selected ? color : `${color}50`;
  const strokeW = selected ? 2 : 0.5;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50% / 15%', transform: `translate(${layer.offset}px, ${layer.offset}px)`, background: layer.color, zIndex: -1 }} />
      ))}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: selected ? `drop-shadow(0 0 10px ${color}40)` : 'none' }}>
        <defs>
          <linearGradient id={`cyl-body-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={isDark ? `${color}35` : `${color}25`} />
            <stop offset="12%" stopColor={isDark ? `${color}12` : `${color}08`} />
            <stop offset="85%" stopColor={isDark ? `${color}12` : `${color}06`} />
            <stop offset="100%" stopColor={isDark ? `${color}40` : `${color}30`} />
          </linearGradient>
          <linearGradient id={`cyl-top-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDark ? `${color}50` : `${color}40`} />
            <stop offset="100%" stopColor={isDark ? `${color}25` : `${color}15`} />
          </linearGradient>
          <linearGradient id={`cyl-bot-${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={isDark ? `${color}40` : `${color}30`} />
            <stop offset="100%" stopColor={isDark ? `${color}15` : `${color}08`} />
          </linearGradient>
        </defs>
        <rect x={2} y={RY} width={W - 4} height={H - RY * 2} fill={`url(#cyl-body-${id})`} stroke={stroke} strokeWidth={strokeW} />
        <ellipse cx={W / 2} cy={H - RY} rx={(W - 4) / 2} ry={RY} fill={`url(#cyl-bot-${id})`} stroke={stroke} strokeWidth={strokeW} />
        <ellipse cx={W / 2} cy={RY} rx={(W - 4) / 2} ry={RY} fill={`url(#cyl-top-${id})`} stroke={stroke} strokeWidth={strokeW} />
        <rect x={W * 0.12} y={RY + 3} width={W * 0.28} height={H - RY * 2 - 6} rx={2} fill="white" opacity={isDark ? 0.04 : 0.12} />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label label={data.label} sublabel={data.sublabel} color={color} nodeId={id} />
      </div>
    </div>
  );
}

function Circle({ id, data, selected, backplates, isDark }: { id: string; data: ShapeNodeData; selected: boolean; backplates: { offset: number; color: string }[]; isDark: boolean }) {
  const color = data.accentColor ?? data.color ?? '#6B7280';
  const W = data.nodeWidth ?? 100;
  const H = data.nodeHeight ?? 100;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <Backplates layers={backplates} borderRadius="50%" />
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, filter: selected ? `drop-shadow(0 0 8px ${color}40)` : 'none' }}>
        <defs>
          <radialGradient id={`circle-grad-${id}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={isDark ? `${color}40` : `${color}30`} />
            <stop offset="100%" stopColor={isDark ? `${color}12` : `${color}08`} />
          </radialGradient>
        </defs>
        <ellipse
          cx={W / 2} cy={H / 2} rx={W / 2 - 2} ry={H / 2 - 2}
          fill={`url(#circle-grad-${id})`}
          stroke={selected ? color : `${color}50`}
          strokeWidth={selected ? 2 : 0.5}
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label label={data.label} sublabel={data.sublabel} color={color} nodeId={id} />
      </div>
    </div>
  );
}

function Parallelogram({ id, data, selected, backplates, isDark }: { id: string; data: ShapeNodeData; selected: boolean; backplates: { offset: number; color: string }[]; isDark: boolean }) {
  const color = data.accentColor ?? data.color ?? '#6B7280';
  const W = data.nodeWidth ?? 150;
  const H = data.nodeHeight ?? 70;
  const SKEW = 20;
  const pts = `${SKEW},2 ${W - 2},2 ${W - SKEW - 2},${H - 2} 2,${H - 2}`;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
       {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={pts} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: selected ? `drop-shadow(0 0 8px ${color}40)` : 'none' }}>
        <defs>
          <linearGradient id={`para-grad-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`${color}25`} />
            <stop offset="100%" stopColor={`${color}08`} />
          </linearGradient>
        </defs>
        <polygon
          points={pts}
          fill={`url(#para-grad-${id})`}
          stroke={selected ? color : `${color}50`}
          strokeWidth={selected ? 2 : 0.5}
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label label={data.label} sublabel={data.sublabel} color={color} nodeId={id} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function ShapeNodeComponent({ id, data, selected }: NodeProps<ShapeNodeData>) {
  const { isDark } = useCanvasTheme();
  const styles = isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES;
  const backplates = styles.backplates;

  const renderShape = () => {
    switch (data.shape) {
      case 'diamond':          return <Diamond id={id} data={data} selected={!!selected} backplates={backplates} isDark={isDark} />;
      case 'cylinder':         return <Cylinder id={id} data={data} selected={!!selected} backplates={backplates} isDark={isDark} />;
      case 'circle':           return <Circle id={id} data={data} selected={!!selected} backplates={backplates} isDark={isDark} />;
      case 'parallelogram':    return <Parallelogram id={id} data={data} selected={!!selected} backplates={backplates} isDark={isDark} />;
      case 'rounded-rectangle': return <Rectangle id={id} data={data} selected={!!selected} rounded backplates={backplates} isDark={isDark} styles={styles} />;
      default:                 return <Rectangle id={id} data={data} selected={!!selected} rounded={false} backplates={backplates} isDark={isDark} styles={styles} />;
    }
  };

  return renderShape();
}

export const ShapeNode = memo(ShapeNodeComponent);
