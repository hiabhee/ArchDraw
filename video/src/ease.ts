import { Easing, interpolate, useCurrentFrame } from "remotion";
import { SCALE } from "./timing";

/** The two curves of the product's motion: travel and arrival. */
export const travel = Easing.bezier(0.45, 0, 0.1, 1);
export const arrive = Easing.bezier(0.25, 0.8, 0.25, 1);

export const ramp = (frame: number, from: number, to: number, ease = arrive) =>
  interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The current frame on the 30 fps authoring timeline (fractional at 60 fps). */
export const useT = () => useCurrentFrame() / SCALE;

/** Critically damped settle, 0 -> 1: zero velocity at the start, no overshoot, ~99% by `dur`. */
export const settle = (t: number, start: number, dur: number) => {
  const x = t - start;
  if (x <= 0) return 0;
  const w = 6.6 / dur;
  return 1 - (1 + w * x) * Math.exp(-w * x);
};
