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

interface NodeHandleProps {
  side: Side;
  type: 'source' | 'target';
  slotOffset: number;
  style?: React.CSSProperties;
}

function SingleHandle({ side, type, slotOffset, style }: NodeHandleProps) {
  const id = `${type}-${side}`;
  const isHorizontal = side === 'left' || side === 'right';
  const pos = sideToPosition(side);

  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    ...(isHorizontal
      ? {
          left: side === 'left' ? -4 : undefined,
          right: side === 'right' ? -4 : undefined,
          top: `calc(50% + ${slotOffset}px)`,
          transform: 'translateY(-50%)',
        }
      : {
          top: side === 'top' ? -4 : undefined,
          bottom: side === 'bottom' ? -4 : undefined,
          left: `calc(50% + ${slotOffset}px)`,
          transform: 'translateX(-50%)',
        }),
    ...style,
  };

  return <Handle type={type} position={pos} id={id} style={base} />;
}

interface NodeHandlesProps {
  handleStyle?: React.CSSProperties;
  sides?: Side[];
}

/**
 * Exactly 2 handles per side: source (outgoing, −GAP) and target (incoming, +GAP).
 */
export function NodeHandles({ handleStyle, sides = SIDES }: NodeHandlesProps) {
  const sourceOffset = -INCOMING_OUTGOING_GAP;
  const targetOffset = INCOMING_OUTGOING_GAP;

  return (
    <>
      {sides.map((side) =>
        TYPES.map((type) => (
          <SingleHandle
            key={`${type}-${side}`}
            side={side}
            type={type}
            slotOffset={type === 'source' ? sourceOffset : targetOffset}
            style={handleStyle}
          />
        ))
      )}
    </>
  );
}
