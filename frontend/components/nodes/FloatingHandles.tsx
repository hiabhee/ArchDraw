'use client';

import { Handle, Position, useNodeId, useStore, type ReactFlowState } from 'reactflow';
import { getHandleSlotLayout, INCOMING_OUTGOING_GAP } from '@/lib/utils/simpleFloatingEdge';

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

export function FloatingHandles() {
  const nodeId = useNodeId();
  const edges = useStore((s: ReactFlowState) => s.edges);
  const nodeInternals = useStore((s: ReactFlowState) => s.nodeInternals);

  const slots = SIDES.map((side) => {
    if (!nodeId) {
      return {
        side,
        sourceOffset: -INCOMING_OUTGOING_GAP,
        targetOffset: INCOMING_OUTGOING_GAP,
      };
    }
    const layout = getHandleSlotLayout(
      nodeId,
      sideToPosition(side),
      edges,
      nodeInternals,
    );
    return { side, ...layout };
  });

  return (
    <>
      {slots.map(({ side, sourceOffset, targetOffset }) =>
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
