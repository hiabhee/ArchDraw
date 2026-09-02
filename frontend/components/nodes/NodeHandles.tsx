'use client';

import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
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

  // Stick out from the node — handle center sits 12px outside the border
  // (edge tip also 12px, so arrow feels connected to handle).
  const OUTSIDE = 12;
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    transition: handleTransition,
    ...(isHorizontal
      ? {
          left: side === 'left' ? -OUTSIDE : 'auto',
          right: side === 'right' ? -OUTSIDE : 'auto',
          top: `calc(50% + ${axisOffset}px)`,
          transform: side === 'left' ? 'translate(-50%, -50%)' : 'translate(50%, -50%)',
        }
      : {
          top: side === 'top' ? -OUTSIDE : 'auto',
          bottom: side === 'bottom' ? -OUTSIDE : 'auto',
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
 * Strict per-side handle visibility:
 * - side with only outgoing → only source handle (centered)
 * - side with only incoming → only target handle (centered)
 * - side with both → two handles offset ±16
 * - empty side → both handles overlapping at 0 (preserve creation affordance)
 * Slots center dynamically per side when only one direction exists.
 */
export function NodeHandles({ handleStyle, sides = SIDES, nodeId }: NodeHandlesProps) {
  const { getSlotOffset, shouldRenderHandle, handleTransition, centeredSides, dynamicOffsets } = useHandleSlotLayout(nodeId);
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    if (nodeId) updateNodeInternals(nodeId);
  }, [nodeId, centeredSides, dynamicOffsets, updateNodeInternals]);

  return (
    <>
      {sides.map((side) => {
        const pos = sideToPosition(side);
        return TYPES.map((type) => {
          const active = shouldRenderHandle(pos, type);
          return (
            <SingleHandle
              key={`${type}-${side}`}
              side={side}
              type={type}
              slotOffset={getSlotOffset(pos, type)}
              handleTransition={handleTransition}
              style={{
                ...handleStyle,
                visibility: active ? 'visible' : 'hidden',
                pointerEvents: active ? 'all' : 'none',
              }}
            />
          );
        });
      })}
    </>
  );
}
