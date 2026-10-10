// React-free edge position values.
// Used by modules that must run on the server (e.g. lib/svgExport.ts), where
// importing `reactflow` as a value is unsafe: reactflow calls React.createContext
// at module scope, which is unavailable in the production server bundle
// (react-rsc stub). We keep reactflow only as a type-only import (erased at
// compile time) and provide the enum values locally, typed as the real enum.

import type { Position as RFPosition } from 'reactflow';

export const Position: Record<'Left' | 'Top' | 'Right' | 'Bottom', RFPosition> = {
  Left: 'left' as RFPosition,
  Top: 'top' as RFPosition,
  Right: 'right' as RFPosition,
  Bottom: 'bottom' as RFPosition,
};

export type Position = RFPosition;
