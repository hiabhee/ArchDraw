import type { EdgeStrokeOpts, Point, ShapePrimitive, StrokeEngineId } from '../types';

/**
 * StrokeRenderer — the core canvas/export parity abstraction.
 * All primitives flow through one interface so canvas and export stay aligned.
 */
export interface StrokeRenderer {
  readonly engine: StrokeEngineId;

  /** Stable seed derived from node/edge id — wobble stays consistent across re-renders. */
  seedFor(id: string): number;

  /** Render a single shape primitive → inner SVG markup. */
  renderPrimitive(primitive: ShapePrimitive, seed: number): string;

  /** Render an edge path (absolute-coordinate `d` string) → SVG markup. */
  renderEdgePath(d: string, opts: EdgeStrokeOpts, seed: number): string;

  /** Render an arrowhead at `tip` pointing in `angle` radians → SVG markup. */
  renderArrowhead(tip: Point, angle: number, color: string, seed: number): string;
}
