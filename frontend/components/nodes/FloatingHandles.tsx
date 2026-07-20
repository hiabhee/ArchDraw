'use client';

import { Handle, Position } from 'reactflow';
import { INCOMING_OUTGOING_GAP } from '@/lib/utils/simpleFloatingEdge';
import { useDiagramStore } from '@/store/diagramStore';

type Side = 'left' | 'right' | 'top' | 'bottom';
const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];
const TYPES = ['target', 'source'] as const;

function sideToPosition(side: Side): Position {
  if (side === 'left') return Position.Left;
  if (side === 'right') return Position.Right;
  if (side === 'top') return Position.Top;
  return Position.Bottom;
}

interface FloatingHandleProps {
  side: Side;
  type: 'source' | 'target';
  /** Offset along the side tangent from the midpoint (px). */
  slotOffset: number;
}

function SingleFloatingHandle({ side, type, slotOffset }: FloatingHandleProps) {
  const id = `${type}-${side}`;
  const pos = sideToPosition(side);

  return (
    <Handle
      type={type}
      position={pos}
      id={id}
      className={`rh rh--${side} rh--${type}`}
      style={{
        // Tangential slot; applied via CSS var + !important to beat RF defaults.
        ['--rh-slot' as string]: `${slotOffset}px`,
        opacity: 0,
        width: 1,
        height: 1,
        minWidth: 1,
        minHeight: 1,
        border: 'none',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    />
  );
}

function useCenteredSides(nodeId?: string): Set<Position> {
  const edges = useDiagramStore((s) => s.edges);
  const centered = new Set<Position>();
  if (!nodeId) return centered;

  const sides: Position[] = [Position.Left, Position.Right, Position.Top, Position.Bottom];
  for (const side of sides) {
    let hasIncoming = false;
    let hasOutgoing = false;
    for (const e of edges) {
      if (e.source !== nodeId && e.target !== nodeId) continue;
      if (e.target === nodeId) hasIncoming = true;
      else hasOutgoing = true;
      if (hasIncoming && hasOutgoing) break;
    }
    if (!hasIncoming || !hasOutgoing) centered.add(side);
  }
  return centered;
}

interface FloatingHandlesProps {
  nodeId?: string;
}

/**
 * 8 handles: 2 per side.
 * - source-*  (outgoing) at −GAP
 * - target-*  (incoming) at +GAP
 * When a side has only incoming or only outgoing edges, both handles
 * sit at the midpoint (offset 0).
 */
export function FloatingHandles({ nodeId }: FloatingHandlesProps) {
  const sourceOffset = -INCOMING_OUTGOING_GAP;
  const targetOffset = INCOMING_OUTGOING_GAP;
  const centeredSides = useCenteredSides(nodeId);

  return (
    <>
      {SIDES.map((side) => {
        const pos = sideToPosition(side);
        const centered = centeredSides.has(pos);
        return TYPES.map((type) => (
          <SingleFloatingHandle
            key={`${type}-${side}`}
            side={side}
            type={type}
            slotOffset={centered ? 0 : type === 'source' ? sourceOffset : targetOffset}
          />
        ));
      })}
    </>
  );
}
