'use client';

import { getShapePrimitives } from '@/lib/theme/shapeGeometry';
import {
  BrutalBody,
  Handles,
  Label,
  SVG_SURFACE_STYLE,
  SketchBody,
  renderPrimitivesSvg,
  resolveShapeSurface,
  sketchSeed,
  type ShapeShellProps,
} from './shapeShell';

/** Flat-top hexagon — ingress / load balancers / gateways. */
export function Hexagon({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="hexagon" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="hexagon" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="hexagon" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="hexagon" brutal />
        </div>
      </div>
    );
  }
  const inset = 2;
  const qx = Math.max(10, Math.round(W * 0.22));
  const pts = [
    `${qx},${inset}`,
    `${W - qx},${inset}`,
    `${W - inset},${H / 2}`,
    `${W - qx},${H - inset}`,
    `${qx},${H - inset}`,
    `${inset},${H / 2}`,
  ].join(' ');
  const clip = `polygon(${pts})`;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={pts} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <polygon points={pts} fill={surface.fill} stroke={surface.stroke} strokeWidth={surface.strokeWidth} strokeLinejoin="round" />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: clip }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="hexagon" />
      </div>
    </div>
  );
}

/** Queue — message-lane horizontal shape for Event Buses / queues. */
export function Queue({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  const pillStyle: React.CSSProperties = isDark
    ? { background: 'rgba(30, 41, 59, 0.72)', backdropFilter: 'blur(2px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 8px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }
    : { background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(2px)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 6, padding: '3px 8px', boxShadow: '0 1px 2px rgba(15,23,42,0.08)' };
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="queue" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="queue" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="queue" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...pillStyle, maxWidth: 'calc(100% - 16px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="queue" brutal />
          </div>
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('queue', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: 14, transform: `translate(${layer.offset}px, ${layer.offset}px)`, background: layer.color, zIndex: -1 }} />
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...pillStyle, maxWidth: 'calc(100% - 16px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="queue" />
        </div>
      </div>
    </div>
  );
}

export function Cache({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="cache" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cache" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="cache" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cache" brutal />
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('cache', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cache" />
      </div>
    </div>
  );
}

export function FunctionShape({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="function" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="function" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="function" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="function" brutal />
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('function', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="function" />
      </div>
    </div>
  );
}

export function Container({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="container" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="container" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="container" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="container" brutal />
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('container', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="container" />
      </div>
    </div>
  );
}

export function Bucket({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="bucket" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="bucket" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="bucket" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="bucket" brutal />
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('bucket', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="bucket" />
      </div>
    </div>
  );
}

/**
 * Soft cloud outline — external / SaaS / third-party. Bumps scaled uniformly
 * from a 200×110 reference so arcs stay round across the 200–240 grid.
 */
function cloudSilhouette(W: number): string {
  const s = W / 200;
  const pt = (x: number, y: number) => `${(x * s).toFixed(1)} ${(y * s).toFixed(1)}`;
  const R = (r: number) => (r * s).toFixed(1);
  return [
    `M ${pt(44, 102)}`,
    `A ${R(26)} ${R(26)} 0 0 1 ${pt(34, 68)}`,
    `A ${R(30)} ${R(30)} 0 0 1 ${pt(82, 34)}`,
    `A ${R(34)} ${R(34)} 0 0 1 ${pt(148, 42)}`,
    `A ${R(30)} ${R(30)} 0 0 1 ${pt(170, 78)}`,
    `A ${R(24)} ${R(24)} 0 0 1 ${pt(156, 102)}`,
    'Z',
  ].join(' ');
}

export function Cloud({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#57534e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="cloud" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cloud" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="cloud" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cloud" brutal />
        </div>
      </div>
    );
  }
  const d = cloudSilhouette(W);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <path d={d} fill={surface.fill} stroke={surface.stroke} strokeWidth={surface.strokeWidth} strokeLinejoin="round" />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cloud" />
      </div>
    </div>
  );
}

/** Person glyph — end users / actors. Two-part head + body, no outer container. */
export function Actor({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#475569';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="actor" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="actor" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="actor" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="actor" brutal />
        </div>
      </div>
    );
  }
  // Mirror actorPrimitives — round head + rounded-shoulder body touching at
  // seam, drawn inside a fixed-ratio "person box" so the glyph is never
  // stretched by the node's W:H proportions.
  const RATIO = 0.62;
  const ph = Math.min(H, W / RATIO);
  const pw = ph * RATIO;
  const px0 = Math.round((W - pw) / 2);
  const py0 = Math.round((H - ph) / 2);

  const topPad = Math.max(4, Math.round(ph * 0.05));
  const headW = Math.max(18, Math.round(ph * 0.30));
  const gap = Math.max(1, Math.round(ph * 0.02));
  const bodyH = Math.max(18, Math.round(ph * 0.34));

  const headX = Math.round(px0 + (pw - headW) / 2);
  const headY = py0 + topPad;

  const bodyW = Math.max(30, Math.round(pw * 0.60));
  const bodyX = Math.round(px0 + (pw - bodyW) / 2);
  const bodyY = Math.round(headY + headW + gap);
  const r = Math.min(14, Math.round(bodyH * 0.50), Math.round(bodyW * 0.16));

  const bodyPath = [
    `M ${bodyX} ${bodyY + bodyH}`,
    `L ${bodyX} ${bodyY + r}`,
    `Q ${bodyX} ${bodyY} ${bodyX + r} ${bodyY}`,
    `L ${bodyX + bodyW - r} ${bodyY}`,
    `Q ${bodyX + bodyW} ${bodyY} ${bodyX + bodyW} ${bodyY + r}`,
    `L ${bodyX + bodyW} ${bodyY + bodyH}`,
    'Z',
  ].join(' ');

  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <ellipse cx={headX + headW / 2} cy={headY + headW / 2} rx={headW / 2} ry={headW / 2} fill={surface.fill} stroke={surface.stroke} strokeWidth={surface.strokeWidth} />
        <path d={bodyPath} fill={surface.fill} stroke={surface.stroke} strokeWidth={surface.strokeWidth} strokeLinejoin="round" />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="actor" />
      </div>
    </div>
  );
}

/** Minimal monitor — web / desktop clients. Rounded screen + stand notch. */
export function Monitor({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#2563eb';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="monitor" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="monitor" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="monitor" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="monitor" brutal />
        </div>
      </div>
    );
  }
  const inset = 2;
  const screenH = H - 20;
  const screenR = 6;
  const screen: React.SVGProps<SVGPathElement> = {
    d: `M ${inset} ${inset + screenR} Q ${inset} ${inset} ${inset + screenR} ${inset} L ${W - inset - screenR} ${inset} Q ${W - inset} ${inset} ${W - inset} ${inset + screenR} L ${W - inset} ${inset + screenH} Q ${W - inset} ${inset + screenH} ${W - inset - 4} ${inset + screenH} L ${inset + 4} ${inset + screenH} Q ${inset} ${inset + screenH} ${inset} ${inset + screenH} Z`,
    fill: surface.fill,
    stroke: surface.stroke,
    strokeWidth: surface.strokeWidth,
    strokeLinejoin: 'round',
  };
  const neckY = inset + screenH;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <path {...screen} />
        <line x1={W / 2} y1={neckY} x2={W / 2} y2={neckY + 6} stroke={surface.stroke} strokeWidth={surface.strokeWidth} />
        <rect x={W / 2 - Math.round(W * 0.16)} y={neckY + 6} width={Math.round(W * 0.32)} height={3} rx={1.5} fill={surface.stroke} />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="monitor" />
      </div>
    </div>
  );
}

/** Tall phone — mobile clients. Rounded rect + speaker notch. */
export function Mobile({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#2563eb';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="mobile" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="mobile" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="mobile" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="mobile" brutal />
        </div>
      </div>
    );
  }
  const inset = 2;
  const r = Math.max(6, Math.round(W * 0.09));
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <rect x={inset} y={inset} width={W - inset * 2} height={H - inset * 2} rx={r} fill={surface.fill} stroke={surface.stroke} strokeWidth={surface.strokeWidth} />
        <rect x={W / 2 - 8} y={Math.round(H * 0.1)} width={16} height={3} rx={1.5} fill={surface.stroke} opacity={0.7} />
        <line x1={W / 2} y1={H - Math.round(H * 0.12)} x2={W / 2} y2={H - Math.round(H * 0.05)} stroke={surface.stroke} strokeWidth={2} strokeLinecap="round" />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="mobile" />
      </div>
    </div>
  );
}

/** Out-of-system / optional scope — dashed border, near-transparent fill. */
export function DashedRectangle({ id, data, selected, isDark, styles, width, height, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#64748b';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="dashed-rectangle" width={width} height={height} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={width} height={height} maxWidth={labelMaxWidth} shape="dashed-rectangle" sketch />
        </div>
        <Handles color={color} nodeId={id} />
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="dashed-rectangle" width={width} height={height} surface={surface} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={width} height={height} maxWidth={labelMaxWidth} shape="dashed-rectangle" brutal />
        </div>
        <Handles color={color} nodeId={id} />
      </div>
    );
  }
  const r = 10;
  return (
    <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
      <div
        style={{
          width,
          height,
          borderRadius: r,
          border: `${surface.strokeWidth}px dashed ${surface.stroke}`,
          background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        }}
      >
        <Label data={data} color={color} nodeId={id} width={width} height={height} maxWidth={labelMaxWidth} shape="dashed-rectangle" />
      </div>
      <Handles color={color} nodeId={id} />
    </div>
  );
}

// ── document (single document with folded corner) ────────────────────────────

/** Document with folded corner — files, reports, configs. */
export function Document({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="document" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="document" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="document" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="document" brutal />
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('document', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="document" />
      </div>
    </div>
  );
}

// ── documents (stacked multiple documents) ────────────────────────────────────

/** Multiple stacked documents — document collections, file sets. */
export function Documents({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="documents" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="documents" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="documents" width={W} height={H} surface={surface} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="documents" brutal />
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('documents', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="documents" />
      </div>
    </div>
  );
}
