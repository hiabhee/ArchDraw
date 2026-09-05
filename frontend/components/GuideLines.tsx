'use client';

import { useReactFlow, useStore, type ReactFlowState } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { getEffectiveNodeDimensions } from '@/lib/utils/shapeNodeDimensions';

const GUIDE_COLOR = '#3b82f6';
const ARROW_SIZE = 6;
const GUIDE_NODE_CLEARANCE = 50;

/** Converts a flow-coordinate position to a screen pixel offset within the canvas container */
function flowToScreen(pos: number, vpOffset: number, zoom: number): number {
  return pos * zoom + vpOffset;
}

/** Collect expanded node rects in flow coordinates (absolute). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getExpandedNodeRects(nodes: Map<string, any>): Array<{ x: number; y: number; w: number; h: number }> {
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const n of nodes.values()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pos = (n as any).positionAbsolute ?? (n as any).position ?? { x: 0, y: 0 };
    let ax = pos.x ?? 0;
    let ay = pos.y ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(n as any).positionAbsolute && (n as any).parentId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all = useDiagramStore.getState().nodes as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = new Map(all.map((m: any) => [m.id, m]));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cur: any = n as any;
        while (cur?.parentId || cur?.parentNode) {
          const pid = cur.parentId || cur.parentNode;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p: any = map.get(pid);
          if (!p) break;
          ax += p.position?.x ?? 0;
          ay += p.position?.y ?? 0;
          cur = p;
        }
      } catch {}
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { width, height } = getEffectiveNodeDimensions(n as any);
    rects.push({
      x: ax - GUIDE_NODE_CLEARANCE,
      y: ay - GUIDE_NODE_CLEARANCE,
      w: width + GUIDE_NODE_CLEARANCE * 2,
      h: height + GUIDE_NODE_CLEARANCE * 2,
    });
  }
  return rects;
}

function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return [];
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const cur = intervals[i];
    if (cur[0] <= last[1]) {
      last[1] = Math.max(last[1], cur[1]);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

/**
 * SVG overlay that renders alignment / spacing guide lines on top of the canvas.
 * Absolutely positioned, pointer-events none, full width/height.
 * Guide segments keep 30px clearance from any node (expanded rect), so they
 * never cut through handles (which sit 12px outside the node).
 */
export function GuideLines() {
  const guideLines = useDiagramStore((s) => s.guideLines);
  const { getViewport } = useReactFlow();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeInternals = useStore((s: ReactFlowState) => (s as unknown as { nodeInternals: Map<string, any> }).nodeInternals as Map<string, any>);

  if (guideLines.length === 0) return null;

  const vp = getViewport();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const flowLeft = (0 - vp.x) / vp.zoom;
  const flowRight = (w - vp.x) / vp.zoom;
  const flowTop = (0 - vp.y) / vp.zoom;
  const flowBottom = (h - vp.y) / vp.zoom;

  const expandedRects =
    nodeInternals && nodeInternals.size > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? getExpandedNodeRects(nodeInternals as unknown as Map<string, any>)
      : [];

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      {guideLines.map((guide, i) => {
        if (guide.orientation === 'h') {
          const screenY = flowToScreen(guide.position, vp.y, vp.zoom);
          const intervals: Array<[number, number]> = [];
          for (const r of expandedRects) {
            if (guide.position >= r.y && guide.position <= r.y + r.h) {
              intervals.push([r.x, r.x + r.w]);
            }
          }
          const merged = mergeIntervals(intervals);
          const segments: Array<[number, number]> = [];
          let cur = flowLeft;
          for (const [a, b] of merged) {
            if (a > cur) segments.push([cur, Math.min(a, flowRight)]);
            cur = Math.max(cur, b);
            if (cur >= flowRight) break;
          }
          if (cur < flowRight) segments.push([cur, flowRight]);
          const flowSegments = merged.length === 0 ? [[flowLeft, flowRight] as [number, number]] : segments;

          return (
            <g key={i}>
              {flowSegments.map(([fs, fe], idx) => {
                const x1 = flowToScreen(fs, vp.x, vp.zoom);
                const x2 = flowToScreen(fe, vp.x, vp.zoom);
                if (x2 - x1 < 2) return null;
                return (
                  <line
                    key={idx}
                    x1={Math.max(0, x1)}
                    y1={screenY}
                    x2={Math.min(w, x2)}
                    y2={screenY}
                    stroke={GUIDE_COLOR}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                );
              })}
              {guide.spacingArrows && (
                <SpacingArrows
                  orientation="h"
                  fixedScreen={screenY}
                  fromScreen={flowToScreen(guide.spacingArrows.from, vp.y, vp.zoom)}
                  toScreen={flowToScreen(guide.spacingArrows.to, vp.y, vp.zoom)}
                />
              )}
            </g>
          );
        } else {
          const screenX = flowToScreen(guide.position, vp.x, vp.zoom);
          const intervals: Array<[number, number]> = [];
          for (const r of expandedRects) {
            if (guide.position >= r.x && guide.position <= r.x + r.w) {
              intervals.push([r.y, r.y + r.h]);
            }
          }
          const merged = mergeIntervals(intervals);
          const segments: Array<[number, number]> = [];
          let cur = flowTop;
          for (const [a, b] of merged) {
            if (a > cur) segments.push([cur, Math.min(a, flowBottom)]);
            cur = Math.max(cur, b);
            if (cur >= flowBottom) break;
          }
          if (cur < flowBottom) segments.push([cur, flowBottom]);
          const flowSegments = merged.length === 0 ? [[flowTop, flowBottom] as [number, number]] : segments;

          return (
            <g key={i}>
              {flowSegments.map(([fs, fe], idx) => {
                const y1 = flowToScreen(fs, vp.y, vp.zoom);
                const y2 = flowToScreen(fe, vp.y, vp.zoom);
                if (y2 - y1 < 2) return null;
                return (
                  <line
                    key={idx}
                    x1={screenX}
                    y1={Math.max(0, y1)}
                    x2={screenX}
                    y2={Math.min(h, y2)}
                    stroke={GUIDE_COLOR}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                );
              })}
              {guide.spacingArrows && (
                <SpacingArrows
                  orientation="v"
                  fixedScreen={screenX}
                  fromScreen={flowToScreen(guide.spacingArrows.from, vp.x, vp.zoom)}
                  toScreen={flowToScreen(guide.spacingArrows.to, vp.x, vp.zoom)}
                />
              )}
            </g>
          );
        }
      })}
    </svg>
  );
}

/** Renders a double-headed arrow between two points to indicate equal spacing */
function SpacingArrows({
  orientation,
  fixedScreen,
  fromScreen,
  toScreen,
}: {
  orientation: 'h' | 'v';
  fixedScreen: number;
  fromScreen: number;
  toScreen: number;
}) {
  const mid = (fromScreen + toScreen) / 2;

  if (orientation === 'h') {
    return (
      <g>
        <line x1={fromScreen} y1={fixedScreen} x2={toScreen} y2={fixedScreen} stroke={GUIDE_COLOR} strokeWidth={1.5} />
        <polygon
          points={`${fromScreen},${fixedScreen} ${fromScreen + ARROW_SIZE},${fixedScreen - ARROW_SIZE / 2} ${fromScreen + ARROW_SIZE},${fixedScreen + ARROW_SIZE / 2}`}
          fill={GUIDE_COLOR}
        />
        <polygon
          points={`${toScreen},${fixedScreen} ${toScreen - ARROW_SIZE},${fixedScreen - ARROW_SIZE / 2} ${toScreen - ARROW_SIZE},${fixedScreen + ARROW_SIZE / 2}`}
          fill={GUIDE_COLOR}
        />
        <circle cx={mid} cy={fixedScreen} r={2.5} fill={GUIDE_COLOR} />
      </g>
    );
  } else {
    return (
      <g>
        <line x1={fixedScreen} y1={fromScreen} x2={fixedScreen} y2={toScreen} stroke={GUIDE_COLOR} strokeWidth={1.5} />
        <polygon
          points={`${fixedScreen},${fromScreen} ${fixedScreen - ARROW_SIZE / 2},${fromScreen + ARROW_SIZE} ${fixedScreen + ARROW_SIZE / 2},${fromScreen + ARROW_SIZE}`}
          fill={GUIDE_COLOR}
        />
        <polygon
          points={`${fixedScreen},${toScreen} ${fixedScreen - ARROW_SIZE / 2},${toScreen - ARROW_SIZE} ${fixedScreen + ARROW_SIZE / 2},${toScreen - ARROW_SIZE}`}
          fill={GUIDE_COLOR}
        />
        <circle cx={fixedScreen} cy={mid} r={2.5} fill={GUIDE_COLOR} />
      </g>
    );
  }
}
