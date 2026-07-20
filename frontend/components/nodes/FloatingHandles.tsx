'use client';

import { Handle, Position } from 'reactflow';

type Side = 'left' | 'right' | 'top' | 'bottom';
const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];
const TYPES = ['target', 'source'] as const;

interface FloatingHandleProps {
  side: Side;
  type: 'source' | 'target';
}

function SingleFloatingHandle({ side, type }: FloatingHandleProps) {
  const id = `${type}-${side}`;
  const pos = side === 'left' ? Position.Left : side === 'right' ? Position.Right : side === 'top' ? Position.Top : Position.Bottom;

  return (
    <Handle
      type={type}
      position={pos}
      id={id}
      className={`rh rh--${side}`}
      style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent', pointerEvents: 'none' }}
    />
  );
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
