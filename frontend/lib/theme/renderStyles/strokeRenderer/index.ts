import type { StrokeEngineId } from '../types';
import type { StrokeRenderer } from './types';
import { CrispStrokeRenderer } from './crispRenderer';
import { RoughStrokeRenderer } from './roughRenderer';
import { BrutalistStrokeRenderer } from './brutalistRenderer';
import { SKETCH_ROUGH_OPTIONS } from '../sketch';

export type { StrokeRenderer } from './types';

const crispSingleton = new CrispStrokeRenderer();
let roughSingleton: RoughStrokeRenderer | null = null;
let brutalistSingleton: BrutalistStrokeRenderer | null = null;

export function getStrokeRenderer(engine: StrokeEngineId): StrokeRenderer {
  if (engine === 'rough') {
    if (!roughSingleton) roughSingleton = new RoughStrokeRenderer(SKETCH_ROUGH_OPTIONS);
    return roughSingleton;
  }
  if (engine === 'brutalist') {
    if (!brutalistSingleton) brutalistSingleton = new BrutalistStrokeRenderer();
    return brutalistSingleton;
  }
  return crispSingleton;
}
