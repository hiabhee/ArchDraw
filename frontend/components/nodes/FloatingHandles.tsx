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
  hidden?: boolean;
}

function SingleFloatingHandle({ side, type, slotOffset, handleTransition, hidden }: FloatingHandleProps) {
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
        transition: handleTransition,
        ...(hidden ? { visibility: 'hidden', pointerEvents: 'none' as const } : {}),
      }}
    />
  );
}

interface FloatingHandlesProps {
  nodeId?: string;
}

/**
 * Floating handles for SystemNode. Strict per-side visibility:
 * - only outgoing on side → only source handle centered
 * - only incoming on side → only target handle centered
 * - both → two handles offset ±16 (aligned with edge anchors)
 * - empty side → both overlapping at 0 (preserve creation affordance)
 */
export function FloatingHandles({ nodeId }: FloatingHandlesProps) {
  const { getSlotOffset, shouldRenderHandle, handleTransition } = useHandleSlotLayout(nodeId);

  return (
    <>
      {SIDES.map((side) => {
        const pos = sideToPosition(side);
        return TYPES.map((type) => {
          const active = shouldRenderHandle(pos, type);
          return (
            <SingleFloatingHandle
              key={`${type}-${side}`}
              side={side}
              type={type}
              slotOffset={getSlotOffset(pos, type)}
              handleTransition={handleTransition}
              hidden={!active}
            />
          );
        });
      })}
    </>
  );
}
