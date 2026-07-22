'use client';

import { Handle, Position } from 'reactflow';
import { useHandleSlotLayout } from '@/hooks/useHandleSlotLayout';

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
  slotOffset: number;
  handleTransition: string;
}

function SingleFloatingHandle({ side, type, slotOffset, handleTransition }: FloatingHandleProps) {
  const id = `${type}-${side}`;
  const pos = sideToPosition(side);

  return (
    <Handle
      type={type}
      position={pos}
      id={id}
      className={`rh rh--${side} rh--${type}`}
      style={{
        ['--rh-slot' as string]: `${slotOffset}px`,
        opacity: 0,
        width: 1,
        height: 1,
        minWidth: 1,
        minHeight: 1,
        border: 'none',
        background: 'transparent',
        pointerEvents: 'none',
        transition: handleTransition,
      }}
    />
  );
}

interface FloatingHandlesProps {
  nodeId?: string;
}

/**
 * Invisible floating handles for SystemNode. Slot offsets follow per-side
 * edge direction so incoming-from-above uses a centered top target handle.
 */
export function FloatingHandles({ nodeId }: FloatingHandlesProps) {
  const { getSlotOffset, handleTransition } = useHandleSlotLayout(nodeId);

  return (
    <>
      {SIDES.map((side) => {
        const pos = sideToPosition(side);
        return TYPES.map((type) => (
          <SingleFloatingHandle
            key={`${type}-${side}`}
            side={side}
            type={type}
            slotOffset={getSlotOffset(pos, type)}
            handleTransition={handleTransition}
          />
        ));
      })}
    </>
  );
}
