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
 * Renders exactly 2 handles per side (one source/outgoing, one target/incoming).
 * Slot positions swap dynamically based on connected peers to reduce edge crossover.
 */
export function NodeHandles({ handleStyle, sides = SIDES }: NodeHandlesProps) {
  const nodeId = useNodeId();
  const edges = useStore((s: ReactFlowState) => s.edges);
  const nodeInternals = useStore((s: ReactFlowState) => s.nodeInternals);

  return (
    <>
      {sides.map((side) => {
        const layout =
          nodeId
            ? getHandleSlotLayout(nodeId, sideToPosition(side), edges, nodeInternals)
            : {
                sourceOffset: -INCOMING_OUTGOING_GAP,
                targetOffset: INCOMING_OUTGOING_GAP,
              };

        return TYPES.map((type) => (
          <SingleHandle
            key={`${type}-${side}`}
            side={side}
            type={type}
            slotOffset={type === 'source' ? layout.sourceOffset : layout.targetOffset}
            style={handleStyle}
          />
        ));
      })}
    </>
  );
}
