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

interface NodeHandlesProps {
  handleStyle?: React.CSSProperties;
  sides?: Side[];
  nodeId?: string;
}

/**
 * Exactly 2 handles per side: source (outgoing, −GAP) and target (incoming, +GAP).
 * When a side has only incoming or only outgoing edges, both handles are
 * placed at the midpoint (offset 0).
 */
export function NodeHandles({ handleStyle, sides = SIDES, nodeId }: NodeHandlesProps) {
  const sourceOffset = -INCOMING_OUTGOING_GAP;
  const targetOffset = INCOMING_OUTGOING_GAP;
  const centeredSides = useCenteredSides(nodeId);

  return (
    <>
      {sides.map((side) => {
        const pos = sideToPosition(side);
        const centered = centeredSides.has(pos);
        return TYPES.map((type) => (
          <SingleHandle
            key={`${type}-${side}`}
            side={side}
            type={type}
            slotOffset={centered ? 0 : type === 'source' ? sourceOffset : targetOffset}
            style={handleStyle}
          />
        ));
      })}
    </>
  );
}
