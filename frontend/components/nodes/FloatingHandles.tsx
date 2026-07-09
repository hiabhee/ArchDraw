'use client';

import { Handle, Position } from 'reactflow';

type Side = 'left' | 'right' | 'top' | 'bottom';
const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];
const TYPES = ['target', 'source'] as const;

const ghost: React.CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  border: 'none',
  background: 'transparent',
  pointerEvents: 'none',
  minWidth: 0,
  minHeight: 0,
  position: 'absolute',
};

interface FloatingHandleProps {
  side: Side;
  type: 'source' | 'target';
}

function SingleFloatingHandle({ side, type }: FloatingHandleProps) {
  const id = `${type}-${side}`;
  const offset = type === 'target' ? 'calc(50% - 12px)' : 'calc(50% + 12px)';

  const isHorizontal = side === 'left' || side === 'right';
  const pos = side === 'left' ? Position.Left : side === 'right' ? Position.Right : side === 'top' ? Position.Top : Position.Bottom;

  const style: React.CSSProperties = {
    ...ghost,
    ...(isHorizontal
      ? {
          left: side === 'left' ? 0 : undefined,
          right: side === 'right' ? 0 : undefined,
          top: offset,
          transform: 'translateY(-50%)',
        }
      : {
          top: side === 'top' ? 0 : undefined,
          bottom: side === 'bottom' ? 0 : undefined,
          left: offset,
          transform: 'translateX(-50%)',
        }),
  };

  return <Handle type={type} position={pos} id={id} style={style} />;
}

export function FloatingHandles() {
  return (
    <>
      {SIDES.map((side) =>
        TYPES.map((type) => (
          <SingleFloatingHandle
            key={`${type}-${side}`}
            side={side}
            type={type}
          />
        ))
      )}
    </>
  );
}
