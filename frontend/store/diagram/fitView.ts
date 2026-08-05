import type { FitViewOptions } from './types';

let fitViewCallback: ((opts?: FitViewOptions) => void) | null = null;

/** Register fit-view callback from Canvas on mount — avoids circular imports. */
export function registerFitViewCallback(fn: (opts?: FitViewOptions) => void) {
  fitViewCallback = fn;
}

export function invokeFitView(options?: FitViewOptions) {
  fitViewCallback?.(options);
}
