import rough from 'roughjs';
import type { EdgeStrokeOpts, Point, ShapePrimitive, SketchRoughOptions } from '../types';
import type { StrokeRenderer } from './types';

interface RoughPathInfo {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
}

/**
 * Node borders read best as ink in sketch: surfaces resolve from low-alpha
 * theme tokens (e.g. rgba(15,23,42,0.14)) that look crisp as 1.25px CSS
 * borders in `precision` but wash out as rough.js wobble. Boost the stroke
 * alpha so hand-drawn outlines stay visible on paper and dark canvases.
 * Edges and selected/accent strokes (already opaque) are left untouched.
 */
function darkenSketchStroke(stroke?: string): string | undefined {
  if (!stroke) return stroke;
  // Warm ink — keep hue, boost alpha so wobble reads on eggshell / dark warm paper.
  const m = stroke.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i);
  if (!m) return stroke;
  const [, rs, gs, bs, as] = m;
  const alpha = as === undefined ? 1 : Math.min(1, parseFloat(as));
  if (alpha >= 0.88) return stroke;
  const r = Number(rs);
  const g = Number(gs);
  const b = Number(bs);
  const lightInk = r + g + b > 420; // warm cream ink → dark canvas
  return `rgba(${r}, ${g}, ${b}, ${lightInk ? 0.68 : 0.62})`;
}

/**
 * Rough stroke renderer — hand-drawn strokes via rough.js.
 * Deterministic per id (seed), usable in browser and Node (export).
 */
export class RoughStrokeRenderer implements StrokeRenderer {
  readonly engine = 'rough' as const;

  private options: SketchRoughOptions;

  constructor(options: SketchRoughOptions) {
    this.options = options;
  }

  seedFor(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return hash || 1;
  }

  private roughOptions(primitive: ShapePrimitive, seed: number): Record<string, unknown> {
    const opts: Record<string, unknown> = {
      seed,
      roughness: this.options.roughness,
      bowing: this.options.bowing,
      stroke: darkenSketchStroke(primitive.stroke),
      strokeWidth: primitive.strokeWidth,
      fill: primitive.fill,
      fillStyle: primitive.fillStyle ?? this.options.fillStyle,
      fillWeight: this.options.fillWeight,
      hachureAngle: this.options.hachureAngle,
      hachureGap: this.options.hachureGap,
      disableMultiStroke: this.options.disableMultiStroke,
      preserveVertices: this.options.preserveVertices,
      strokeLinejoin: primitive.strokeLinejoin,
      strokeLinecap: primitive.strokeLinecap,
    };
    if (primitive.dasharray) {
      opts.dashOffset = 2;
      opts.dashGap = 4;
    }
    return opts;
  }

  private toMarkup(drawable: RoughPathInfo[], opacity?: number, dasharray?: string): string {
    return drawable
      .map((p) => {
        const attrs: string[] = [
          `d="${p.d}"`,
          `fill="${p.fill ?? 'none'}"`,
          `stroke="${p.stroke}"`,
          `stroke-width="${p.strokeWidth}"`,
        ];
        if (opacity !== undefined && opacity !== 1) attrs.push(`opacity="${opacity}"`);
        if (dasharray) attrs.push(`stroke-dasharray="${dasharray}"`);
        return `<path ${attrs.join(' ')} />`;
      })
      .join('\n');
  }

  renderPrimitive(primitive: ShapePrimitive, seed: number): string {
    const gen = rough.generator();
    const { bounds } = primitive;
    const opts = this.roughOptions(primitive, seed);

    let drawable: RoughPathInfo[];
    switch (primitive.kind) {
      case 'rect':
      case 'rounded-rect':
        if (primitive.rx) {
          const { x, y, width, height } = bounds;
          const rx = primitive.rx;
          const r = Math.min(rx, width / 2, height / 2);
          const d = [
            `M ${x + r} ${y}`,
            `L ${x + width - r} ${y}`,
            `Q ${x + width} ${y} ${x + width} ${y + r}`,
            `L ${x + width} ${y + height - r}`,
            `Q ${x + width} ${y + height} ${x + width - r} ${y + height}`,
            `L ${x + r} ${y + height}`,
            `Q ${x} ${y + height} ${x} ${y + height - r}`,
            `L ${x} ${y + r}`,
            `Q ${x} ${y} ${x + r} ${y}`,
            'Z',
          ].join(' ');
          drawable = gen.toPaths(gen.path(d, opts));
        } else {
          drawable = gen.toPaths(gen.rectangle(bounds.x, bounds.y, bounds.width, bounds.height, opts));
        }
        break;
      case 'ellipse':
        drawable = gen.toPaths(
          gen.ellipse(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.width / 2, bounds.height / 2, opts),
        );
        break;
      case 'polygon':
        drawable = gen.toPaths(gen.polygon(parsePoints(primitive.points), opts));
        break;
      case 'polyline':
        drawable = gen.toPaths(gen.linearPath(parsePoints(primitive.points), opts));
        break;
      case 'path':
        drawable = gen.toPaths(gen.path(primitive.d || '', opts));
        break;
      case 'line':
        drawable = gen.toPaths(
          gen.line(primitive.x1 ?? 0, primitive.y1 ?? 0, primitive.x2 ?? 0, primitive.y2 ?? 0, opts),
        );
        break;
      default:
        return '';
    }
    return this.toMarkup(drawable, primitive.opacity);
  }

  renderEdgePath(d: string, opts: EdgeStrokeOpts, seed: number): string {
    const gen = rough.generator();
    const dasharray = opts.dasharray;
    // Sketch edges: stronger wobble than before (1.8 roughness), slight bowing
    // so straight orthogonal runs feel hand-drawn. Keep single-stroke on edges
    // to avoid double lines at arrow tips, but let bowing show.
    const roughOpts: Record<string, unknown> = {
      seed,
      roughness: dasharray
        ? Math.min(this.options.roughness, 1.2)
        : Math.min(this.options.roughness, 1.85),
      bowing: Math.min(this.options.bowing, 0.95),
      stroke: opts.stroke,
      strokeWidth: dasharray ? opts.strokeWidth * 1.18 : opts.strokeWidth * 1.05,
      disableMultiStroke: true,
      // Slight hand pressure variation — preserve vertices so orthogonal bends
      // stay sharp while the straight runs wobble.
      preserveVertices: true,
    };
    if (dasharray) {
      roughOpts.dashGap = 0;
    }
    const drawable = gen.toPaths(gen.path(d, roughOpts));
    return this.toMarkup(drawable, opts.opacity, dasharray);
  }

  renderArrowhead(tip: Point, angle: number, color: string, seed: number): string {
    const gen = rough.generator();
    // Hand-drawn arrowhead — slightly larger & wobbly via rough polygon
    const size = 12;
    const spread = 6.5;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const backX = tip.x - size * cos;
    const backY = tip.y - size * sin;
    const normalX = -sin;
    const normalY = cos;

    const leftX = backX + normalX * spread;
    const leftY = backY + normalY * spread;
    const rightX = backX - normalX * spread;
    const rightY = backY - normalY * spread;

    // Hand-drawn triangle via rough polygon — single wobble, solid fill.
    // Using rough polygon gives the sketchy offset border instead of perfect geometry.
    try {
      const pts: [number, number][] = [
        [tip.x, tip.y],
        [leftX, leftY],
        [rightX, rightY],
      ];
      const opts: Record<string, unknown> = {
        seed,
        roughness: 1.75,
        bowing: 1.2,
        stroke: color,
        strokeWidth: 1.35,
        fill: color,
        fillStyle: 'solid',
        fillWeight: 1,
        disableMultiStroke: true,
      };
      const drawable = gen.toPaths(gen.polygon(pts, opts));
      if (drawable.length > 0) {
        return this.toMarkup(drawable);
      }
    } catch {
      // fall through to crisp fallback
    }
    const points = `${tip.x},${tip.y} ${leftX},${leftY} ${rightX},${rightY}`;
    return `<polygon points="${points}" fill="${color}" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" />`;
  }
}

function parsePoints(points?: string): [number, number][] {
  return (points ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return [x, y];
    });
}
