import type { StrokeEngineId } from '../types';
import type { StrokeRenderer } from './types';
import { CrispStrokeRenderer } from './crispRenderer';
import { RoughStrokeRenderer } from './roughRenderer';
import { SKETCH_ROUGH_OPTIONS } from '../sketch';

export type { StrokeRenderer } from './types';

const crispSingleton = new CrispStrokeRenderer();
let roughSingleton: RoughStrokeRenderer | null = null;

export function getStrokeRenderer(engine: StrokeEngineId): StrokeRenderer {
  if (engine === 'rough') {
    if (!roughSingleton) roughSingleton = new RoughStrokeRenderer(SKETCH_ROUGH_OPTIONS);
    return roughSingleton;
  }
  return crispSingleton;
}
