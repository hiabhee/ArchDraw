'use client';

import { getShapePrimitives } from '@/lib/theme/shapeGeometry';
import { diamondClipPath } from '@/lib/utils/shapeTextLayout';
import {
  Backplates,
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

export function Rectangle({ id, data, selected, rounded, backplates, isDark, styles, width, height, labelMaxWidth, sketch, brutal }: ShapeShellProps & { rounded: boolean }) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  const r = getShapePrimitives(rounded ? 'rounded-rectangle' : 'rectangle', width, height)[0].rx ?? 6;
  if (sketch) {
    return (
      <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
        {backplates.length > 0 && <Backplates layers={backplates} borderRadius={r} />}
        <SketchBody shape={rounded ? 'rounded-rectangle' : 'rectangle'} width={width} height={height} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={width} height={height} maxWidth={labelMaxWidth} shape={data.shape} sketch />
        </div>
        <Handles color={color} nodeId={id} />
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
        {backplates.length > 0 && <Backplates layers={backplates} borderRadius={r} />}
        <BrutalBody shape={rounded ? 'rounded-rectangle' : 'rectangle'} width={width} height={height} surface={surface} isDark={isDark} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={width} height={height} maxWidth={labelMaxWidth} shape={data.shape} brutal />
        </div>
        <Handles color={color} nodeId={id} />
      </div>
    );
  }
  return (
    <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
      {backplates.length > 0 && <Backplates layers={backplates} borderRadius={r} />}
      <div
        style={{
          width,
          height,
          borderRadius: r,
          border: `${surface.strokeWidth}px solid ${surface.stroke}`,
          background: surface.fill,
          boxShadow: surface.boxShadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        }}
      >
        <Label data={data} color={color} nodeId={id} width={width} height={height} maxWidth={labelMaxWidth} shape={data.shape} />
      </div>
      <Handles color={color} nodeId={id} />
    </div>
  );
}

export function Diamond({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="diamond" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: diamondClipPath(W, H) }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="diamond" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="diamond" width={W} height={H} surface={surface} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: diamondClipPath(W, H) }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="diamond" brutal />
        </div>
      </div>
    );
  }
  const primitives = getShapePrimitives('diamond', W, H);
  const points = primitives[0].points ?? '';
  const body = renderPrimitivesSvg(primitives, surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={points} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          clipPath: diamondClipPath(W, H),
        }}
      >
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="diamond" />
      </div>
    </div>
  );
}

export function Circle({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    // Scale up the rough.js body so the circle looks bigger in sketch mode.
    const sketchScale = 1.3;
    const sW = Math.round(W * sketchScale);
    const sH = Math.round(H * sketchScale);
    const offsetX = Math.round((sW - W) / 2);
    const offsetY = Math.round((sH - H) / 2);
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        {backplates.length > 0 && <Backplates layers={backplates} borderRadius="50%" />}
        <div style={{ position: 'absolute', top: -offsetY, left: -offsetX, width: sW, height: sH, pointerEvents: 'none' }}>
          <SketchBody shape="circle" width={sW} height={sH} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        </div>
        <Handles color={color} nodeId={id} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            clipPath: `ellipse(${(W / 2) - 4}px ${(H / 2) - 4}px at ${W / 2}px ${H / 2}px)`,
          }}
        >
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="circle" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        {backplates.length > 0 && <Backplates layers={backplates} borderRadius="50%" />}
        <BrutalBody shape="circle" width={W} height={H} surface={surface} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            clipPath: `ellipse(${(W / 2) - 4}px ${(H / 2) - 4}px at ${W / 2}px ${H / 2}px)`,
          }}
        >
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="circle" brutal />
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('circle', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.length > 0 && <Backplates layers={backplates} borderRadius="50%" />}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          clipPath: `ellipse(${(W / 2) - 4}px ${(H / 2) - 4}px at ${W / 2}px ${H / 2}px)`,
        }}
      >
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="circle" />
      </div>
    </div>
  );
}

export function Parallelogram({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch, brutal }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch, brutal);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="parallelogram" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="parallelogram" sketch />
        </div>
      </div>
    );
  }
  if (brutal) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <BrutalBody shape="parallelogram" width={W} height={H} surface={surface} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="parallelogram" brutal />
        </div>
      </div>
    );
  }
  const SKEW = Math.min(20, Math.round(W * 0.08));
  const pts = `${SKEW},2 ${W - 2},2 ${W - SKEW - 2},${H - 2} 2,${H - 2}`;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
       {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={pts} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <polygon
          points={pts}
          fill={surface.fill}
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="parallelogram" />
      </div>
    </div>
  );
}
