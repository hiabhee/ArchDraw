'use client';

import { useReactFlow } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';

const GUIDE_COLOR = '#3b82f6';
const GUIDE_COLOR_SOFT = 'rgba(59,130,246,0.12)';
const ARROW_SIZE = 6;

/** Converts a flow-coordinate position to a screen pixel offset within the canvas container */
function flowToScreen(pos: number, vpOffset: number, zoom: number): number {
  return pos * zoom + vpOffset;
}

/**
 * SVG overlay that renders alignment / spacing guide lines on top of the canvas.
 * Absolutely positioned, pointer-events none, full width/height.
 */
export function GuideLines() {
  const guideLines = useDiagramStore((s) => s.guideLines);
  const { getViewport } = useReactFlow();

  if (guideLines.length === 0) return null;

  const vp = getViewport();
  const w = window.innerWidth;
  const h = window.innerHeight;

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
          // Horizontal line — fixed y, spans full width
          const screenY = flowToScreen(guide.position, vp.y, vp.zoom);
          return (
            <g key={i}>
              <line
                x1={0}
                y1={screenY}
                x2={w}
                y2={screenY}
                stroke={GUIDE_COLOR}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
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
          // Vertical line — fixed x, spans full height
          const screenX = flowToScreen(guide.position, vp.x, vp.zoom);
          return (
            <g key={i}>
              <line
                x1={screenX}
                y1={0}
                x2={screenX}
                y2={h}
                stroke={GUIDE_COLOR}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
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
    // Arrow along x axis at y = fixedScreen
    return (
      <g>
        <line x1={fromScreen} y1={fixedScreen} x2={toScreen} y2={fixedScreen} stroke={GUIDE_COLOR} strokeWidth={1.5} />
        {/* Left arrowhead */}
        <polygon
          points={`${fromScreen},${fixedScreen} ${fromScreen + ARROW_SIZE},${fixedScreen - ARROW_SIZE / 2} ${fromScreen + ARROW_SIZE},${fixedScreen + ARROW_SIZE / 2}`}
          fill={GUIDE_COLOR}
        />
        {/* Right arrowhead */}
        <polygon
          points={`${toScreen},${fixedScreen} ${toScreen - ARROW_SIZE},${fixedScreen - ARROW_SIZE / 2} ${toScreen - ARROW_SIZE},${fixedScreen + ARROW_SIZE / 2}`}
          fill={GUIDE_COLOR}
        />
        {/* Mid dot */}
        <circle cx={mid} cy={fixedScreen} r={2.5} fill={GUIDE_COLOR} />
      </g>
    );
  } else {
    // Arrow along y axis at x = fixedScreen
    return (
      <g>
        <line x1={fixedScreen} y1={fromScreen} x2={fixedScreen} y2={toScreen} stroke={GUIDE_COLOR} strokeWidth={1.5} />
        {/* Top arrowhead */}
        <polygon
          points={`${fixedScreen},${fromScreen} ${fixedScreen - ARROW_SIZE / 2},${fromScreen + ARROW_SIZE} ${fixedScreen + ARROW_SIZE / 2},${fromScreen + ARROW_SIZE}`}
          fill={GUIDE_COLOR}
        />
        {/* Bottom arrowhead */}
        <polygon
          points={`${fixedScreen},${toScreen} ${fixedScreen - ARROW_SIZE / 2},${toScreen - ARROW_SIZE} ${fixedScreen + ARROW_SIZE / 2},${toScreen - ARROW_SIZE}`}
          fill={GUIDE_COLOR}
        />
        {/* Mid dot */}
        <circle cx={fixedScreen} cy={mid} r={2.5} fill={GUIDE_COLOR} />
      </g>
    );
  }
}
