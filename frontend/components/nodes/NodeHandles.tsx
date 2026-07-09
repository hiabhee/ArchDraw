'use client';

import { Handle, Position } from 'reactflow';

type Side = 'left' | 'right' | 'top' | 'bottom';
const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];
const TYPES = ['target', 'source'] as const; // target = incoming, source = output

interface NodeHandleProps {
  side: Side;
  type: 'source' | 'target';
  style?: React.CSSProperties;
}

function SingleHandle({ side, type, style }: NodeHandleProps) {
  const id = `${type}-${side}`;
  
  // 1 handle for incoming request (target) at -12px, 
  // 1 handle for output request (source) at +12px
  const offset = type === 'target' ? 'calc(50% - 12px)' : 'calc(50% + 12px)';

  const isHorizontal = side === 'left' || side === 'right';
  const pos = side === 'left' ? Position.Left : side === 'right' ? Position.Right : side === 'top' ? Position.Top : Position.Bottom;

  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    ...(isHorizontal
      ? {
          left: side === 'left' ? -4 : undefined,
          right: side === 'right' ? -4 : undefined,
          top: offset,
          transform: 'translateY(-50%)',
        }
      : {
          top: side === 'top' ? -4 : undefined,
          bottom: side === 'bottom' ? -4 : undefined,
          left: offset,
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

export function NodeHandles({ handleStyle, sides = SIDES }: NodeHandlesProps) {
  return (
    <>
      {sides.map((side) =>
        TYPES.map((type) => (
          <SingleHandle
            key={`${type}-${side}`}
            side={side}
            type={type}
            style={handleStyle}
          />
        ))
      )}
    </>
  );
}
