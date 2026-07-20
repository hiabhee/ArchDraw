'use client';

import { Handle, Position } from 'reactflow';
import { INCOMING_OUTGOING_GAP } from '@/lib/utils/simpleFloatingEdge';

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

/**
 * 8 handles: 2 per side.
 * - source-*  (outgoing) at −GAP
 * - target-*  (incoming) at +GAP
 * Edges of each role merge onto that dedicated tip.
 */
export function FloatingHandles() {
  const sourceOffset = -INCOMING_OUTGOING_GAP;
  const targetOffset = INCOMING_OUTGOING_GAP;

  return (
    <>
      {SIDES.map((side) =>
        TYPES.map((type) => (
          <SingleFloatingHandle
            key={`${type}-${side}`}
            side={side}
            type={type}
            slotOffset={type === 'source' ? sourceOffset : targetOffset}
          />
        ))
      )}
    </>
  );
}
