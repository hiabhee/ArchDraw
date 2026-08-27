'use client';

import type { NodeStyleConfig } from '@/lib/theme/stylingConstants';
import {
  Handles,
  Label,
  SVG_SURFACE_STYLE,
  SketchBody,
  resolveShapeSurface,
  sketchSeed,
  type ShapeShellProps,
} from './shapeShell';

export function Cylinder({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  // Cylinder is ONLY for vertical drums (databases)
  // For horizontal pipes/queues, use shape='queue' instead
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);

  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="cylinder" width={W} height={H} surface={surface} seed={sketchSeed(id)} axis="vertical" isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cylinder" sketch />
        </div>
      </div>
    );
  }

  return (
    <VerticalDrumCylinder
      id={id}
      data={data}
      selected={selected}
      backplates={backplates}
      isDark={isDark}
      styles={styles}
      width={W}
      height={H}
      labelMaxWidth={labelMaxWidth}
    />
  );
}

function cylinderShades(isDark: boolean, styles: NodeStyleConfig) {
  const topHighlight = isDark ? '#2a3040' : '#ffffff';
  const bodyShade = isDark ? styles.background : '#f1f5f9';
  const sideShade = isDark ? '#161922' : '#e8edf2';
  const sideEdge = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(15, 23, 42, 0.22)';
  const hiddenEdge = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(148, 163, 184, 0.55)';
  return { topHighlight, bodyShade, sideShade, sideEdge, hiddenEdge };
}

function VerticalDrumCylinder({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch = false }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  const { topHighlight, bodyShade, sideShade, sideEdge, hiddenEdge } = cylinderShades(isDark, styles);
  const RY = Math.max(10, Math.round(H * 0.12));
  const rx = (W - 4) / 2;
  const cx = W / 2;
  const left = 2;
  const right = W - 2;
  const topY = RY;
  const bottomY = H - RY;
  const silhouette = [
    `M ${left} ${topY}`,
    `L ${left} ${bottomY}`,
    `A ${rx} ${RY} 0 0 0 ${right} ${bottomY}`,
    `L ${right} ${topY}`,
    `A ${rx} ${RY} 0 0 1 ${left} ${topY}`,
    'Z',
  ].join(' ');
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50% / 15%', transform: `translate(${layer.offset}px, ${layer.offset}px)`, background: layer.color, zIndex: -1 }} />
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <defs>
          <linearGradient id={`cyl-body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={topHighlight} />
            <stop offset="100%" stopColor={bodyShade} />
          </linearGradient>
          <linearGradient id={`cyl-sides-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={sideShade} />
            <stop offset="14%" stopColor={bodyShade} />
            <stop offset="86%" stopColor={bodyShade} />
            <stop offset="100%" stopColor={sideShade} />
          </linearGradient>
          <linearGradient id={`cyl-cap-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={topHighlight} />
            <stop offset="100%" stopColor={isDark ? '#1c2030' : '#f1f5f9'} />
          </linearGradient>
        </defs>
        <path d={silhouette} fill={bodyShade} stroke="none" opacity={isDark ? 0.98 : 0.94} />
        <rect x={left} y={topY} width={W - 4} height={bottomY - topY} fill={`url(#cyl-body-${id})`} stroke="none" opacity={0.85} />
        <ellipse cx={cx} cy={bottomY} rx={rx} ry={RY} fill={sideShade} stroke="none" />
        {/* Back rim (upper arc, hidden behind body) — dashed; front rim (lower arc) — solid */}
        <path
          d={`M ${left} ${bottomY} A ${rx} ${RY} 0 0 1 ${right} ${bottomY}`}
          fill="none"
          stroke={hiddenEdge}
          strokeWidth={surface.strokeWidth}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <path
          d={`M ${left} ${bottomY} A ${rx} ${RY} 0 0 0 ${right} ${bottomY}`}
          fill="none"
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
          strokeLinecap="round"
        />
        <line x1={left} y1={topY} x2={left} y2={bottomY} stroke={sideEdge} strokeWidth={surface.strokeWidth} strokeLinecap="round" />
        <line x1={right} y1={topY} x2={right} y2={bottomY} stroke={sideEdge} strokeWidth={surface.strokeWidth} strokeLinecap="round" />
        <ellipse
          cx={cx}
          cy={topY}
          rx={rx}
          ry={RY}
          fill={`url(#cyl-cap-${id})`}
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
        />
        <path
          d={silhouette}
          fill="none"
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
          strokeLinejoin="round"
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cylinder" />
      </div>
    </div>
  );
}

// Legacy: HorizontalPipeCylinder kept for backward compatibility with old diagrams
// New diagrams should use shape='queue' instead of shape='cylinder' with cylinderAxis='horizontal'
export function HorizontalPipeCylinder({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch = false }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);

  // Sketch: hand-drawn capsule via rough.js — ensures queue nodes match other shapes in sketch theme
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="cylinder" width={W} height={H} surface={surface} seed={sketchSeed(id)} axis="horizontal" isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: Math.max(8, Math.round(W * 0.14)), paddingRight: Math.round(W * 0.10) }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="queue" sketch />
        </div>
      </div>
    );
  }

  const { topHighlight, bodyShade, sideShade, sideEdge, hiddenEdge } = cylinderShades(isDark, styles);
  const inset = 2;
  const R = Math.max(8, Math.round((H - inset * 2) / 2));
  const midY = H / 2;
  const leftCx = inset + R;
  const rightCx = W - inset - R;
  const bodyTop = midY - R;
  const bodyBot = midY + R;
  const bodyW = Math.max(0, rightCx - leftCx);

  const silhouette = [
    `M ${leftCx - R} ${midY}`,
    `A ${R} ${R} 0 0 1 ${leftCx} ${bodyTop}`,
    `L ${rightCx} ${bodyTop}`,
    `A ${R} ${R} 0 0 1 ${rightCx} ${bodyBot}`,
    `L ${leftCx} ${bodyBot}`,
    `A ${R} ${R} 0 0 1 ${leftCx - R} ${midY}`,
    'Z',
  ].join(' ');

  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: 999, transform: `translate(${layer.offset}px, ${layer.offset}px)`, background: layer.color, zIndex: -1 }} />
      ))}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <defs>
          <linearGradient id={`pipe-body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={topHighlight} />
            <stop offset="55%" stopColor={bodyShade} />
            <stop offset="100%" stopColor={sideShade} />
          </linearGradient>
          <radialGradient id={`pipe-cap-${id}`} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor={topHighlight} />
            <stop offset="100%" stopColor={bodyShade} />
          </radialGradient>
        </defs>

        {/* Fill entire capsule so right semicircular cap is not transparent — mirrors vertical drum */}
        <path d={silhouette} fill={surface.fill} stroke="none" />

        {/* Tube body — rectangle only, no solid disc on the far end */}
        {bodyW > 0 && (
          <rect
            x={leftCx}
            y={bodyTop}
            width={bodyW}
            height={R * 2}
            fill={`url(#pipe-body-${id})`}
            stroke="none"
          />
        )}

        {/* Side wall lines */}
        <line x1={leftCx} y1={bodyTop} x2={rightCx} y2={bodyTop} stroke={sideEdge} strokeWidth={surface.strokeWidth} strokeLinecap="round" />
        <line x1={leftCx} y1={bodyBot} x2={rightCx} y2={bodyBot} stroke={sideEdge} strokeWidth={surface.strokeWidth} strokeLinecap="round" />

        {/* Far opening: back rim dashed, front rim solid — no filled end cap */}
        <path
          d={`M ${rightCx} ${bodyTop} A ${R} ${R} 0 0 0 ${rightCx} ${bodyBot}`}
          fill="none"
          stroke={hiddenEdge}
          strokeWidth={surface.strokeWidth}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <path
          d={`M ${rightCx} ${bodyTop} A ${R} ${R} 0 0 1 ${rightCx} ${bodyBot}`}
          fill="none"
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
          strokeLinecap="round"
        />

        {/* Near opening — solid face disc (looking into the pipe) */}
        <ellipse
          cx={leftCx}
          cy={midY}
          rx={R}
          ry={R}
          fill={`url(#pipe-cap-${id})`}
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
        />

        {/* Outer silhouette */}
        <path
          d={silhouette}
          fill="none"
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
          strokeLinejoin="round"
        />
      </svg>
      <Handles color={color} nodeId={id} shape="queue" />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: R + 6, paddingRight: R + 10 }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cylinder" />
      </div>
    </div>
  );
}
