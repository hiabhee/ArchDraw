import React from "react";
import { W, H } from "../theme";
import { Diagram, DNode } from "../data/types";
import { DIAGRAMS } from "../data/types";

export type Cam = { cx: number; cy: number; scale: number };
export type P = { x: number; y: number };

/** Diagram point -> screen point. */
export const project = (cam: Cam, p: P): P => ({ x: W / 2 + (p.x - cam.cx) * cam.scale, y: H / 2 + (p.y - cam.cy) * cam.scale });

const GRID = "rgba(100,116,139,0.34)";

type Props = {
  diagram: Diagram;
  cam: Cam;
  /** 0..1 for each node/group; missing = fully shown. */
  nodeP?: (n: DNode, i: number) => number;
  /** 0..1 for each edge; missing = fully drawn. */
  edgeP?: (id: string, i: number) => number;
  /** Extra marks in diagram space, drawn above the nodes (rings, plots). */
  children?: React.ReactNode;
  opacity?: number;
  /** Draw only the diagram, on top of another canvas. */
  bare?: boolean;
};

/**
 * The product's own canvas: every node, group and edge is the SVG the app's
 * renderer draws (exported per element), so only their reveal is animated here.
 */
export const MapCanvas: React.FC<Props> = ({ diagram, cam, nodeP, edgeP, children, opacity = 1, bare }) => {
  const s = cam.scale;
  const tx = W / 2 - cam.cx * s;
  const ty = H / 2 - cam.cy * s;
  const gap = 24 * s;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, opacity }}>
      <defs dangerouslySetInnerHTML={{ __html: diagram.defs.replace(/^<defs>|<\/defs>$/g, "") }} />
      <defs>
        <pattern id="dots" x={tx % gap} y={ty % gap} width={gap} height={gap} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={Math.max(0.8, 1.1 * s)} fill={GRID} />
        </pattern>
      </defs>
      {bare ? null : <rect width={W} height={H} fill={DIAGRAMS.tokens.bg} />}
      {bare ? null : <rect width={W} height={H} fill="url(#dots)" opacity={0.5} />}
      <g transform={`translate(${tx} ${ty}) scale(${s})`}>
        <g>
          {diagram.edges.map((e, i) => {
            const p = edgeP ? edgeP(e.id, i) : 1;
            if (p <= 0) return null;
            return (
              <g key={e.id}>
                <path
                  d={e.d}
                  fill="none"
                  stroke={e.stroke}
                  strokeWidth={e.width}
                  pathLength={1}
                  strokeDasharray={e.dash ?? "1 1"}
                  strokeDashoffset={e.dash ? 0 : 1 - p}
                  opacity={e.dash ? p : 1}
                  style={e.glow ? { filter: e.glow } : undefined}
                />
                {e.markerD ? <path d={e.markerD} fill={e.markerFill} stroke={e.markerFill} strokeWidth={0} opacity={Math.max(0, (p - 0.9) * 10)} /> : null}
                {e.labelSvg ? <g opacity={Math.max(0, (p - 0.85) / 0.15)} dangerouslySetInnerHTML={{ __html: e.labelSvg }} /> : null}
              </g>
            );
          })}
        </g>
        <g>
          {diagram.nodes.map((n, i) => {
            const p = nodeP ? nodeP(n, i) : 1;
            if (p <= 0) return null;
            const k = n.group ? 1 : 0.93 + 0.07 * p;
            const dy = n.group ? 0 : (1 - p) * 10;
            return (
              <g
                key={n.id}
                opacity={p}
                style={!n.group && p < 1 ? { filter: `blur(${(1 - p) * 5}px)` } : undefined}
                transform={`translate(${n.x + n.w / 2} ${n.y + n.h / 2 + dy}) scale(${k}) translate(${-n.w / 2} ${-n.h / 2})`}
                dangerouslySetInnerHTML={{ __html: n.inner }}
              />
            );
          })}
        </g>
        {children}
      </g>
    </svg>
  );
};

/** Two slow lights drifting behind the map: ambient motion that never stops. */
export const Ambient: React.FC<{ t: number; strength?: number }> = ({ t, strength = 1 }) => (
  <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: strength }}>
    <div
      style={{
        position: "absolute",
        width: 1100,
        height: 1100,
        left: 260 + Math.sin(t / 170) * 140,
        top: -380 + Math.cos(t / 210) * 90,
        background: "radial-gradient(circle, rgba(37,99,235,0.07), rgba(37,99,235,0) 62%)",
      }}
    />
    <div
      style={{
        position: "absolute",
        width: 900,
        height: 900,
        left: 1020 + Math.cos(t / 190) * 120,
        top: 360 + Math.sin(t / 160) * 100,
        background: "radial-gradient(circle, rgba(245,158,11,0.06), rgba(245,158,11,0) 62%)",
      }}
    />
  </div>
);
