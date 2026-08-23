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

interface NodeHandleProps {
  side: Side;
  type: 'source' | 'target';
  slotOffset: number;
  handleTransition: string;
  style?: React.CSSProperties;
}

function SingleHandle({ side, type, slotOffset, handleTransition, style }: NodeHandleProps) {
  const id = `${type}-${side}`;
  const isHorizontal = side === 'left' || side === 'right';
  const pos = sideToPosition(side);

  const axisOffset = slotOffset;
  const crossOffset = slotOffset;

  // Pin to side midpoint — center handle exactly on the border.
  // left/top need -50% (move inward), right/bottom need +50% (move outward) so the
  // 10px circle’s center sits on the node edge, not 5px inside.
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    transition: handleTransition,
    ...(isHorizontal
      ? {
          left: side === 'left' ? 0 : 'auto',
          right: side === 'right' ? 0 : 'auto',
          top: `calc(50% + ${axisOffset}px)`,
          transform: side === 'left' ? 'translate(-50%, -50%)' : 'translate(50%, -50%)',
        }
      : {
          top: side === 'top' ? 0 : 'auto',
          bottom: side === 'bottom' ? 0 : 'auto',
          left: `calc(50% + ${crossOffset}px)`,
          transform: side === 'top' ? 'translate(-50%, -50%)' : 'translate(-50%, 50%)',
        }),
    ...style,
  };

  return <Handle type={type} position={pos} id={id} style={base} />;
}

interface NodeHandlesProps {
  handleStyle?: React.CSSProperties;
  sides?: Side[];
  nodeId?: string;
}

/**
 * Two handles per side (source / target). Slots center dynamically per side:
 * when only incoming or only outgoing edges use a side, the active handle
 * moves to the midpoint for a straight attachment.
 */
export function NodeHandles({ handleStyle, sides = SIDES, nodeId }: NodeHandlesProps) {
  const { getSlotOffset, handleTransition } = useHandleSlotLayout(nodeId);

  return (
    <>
      {sides.map((side) => {
        const pos = sideToPosition(side);
        return TYPES.map((type) => (
          <SingleHandle
            key={`${type}-${side}`}
            side={side}
            type={type}
            slotOffset={getSlotOffset(pos, type)}
            handleTransition={handleTransition}
            style={handleStyle}
          />
        ));
      })}
    </>
  );
}
