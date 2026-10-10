import type { EdgeStrokeOpts, Point, ShapePrimitive } from '../types';
import type { StrokeRenderer } from './types';
import { BRUTAL_SHADOW_FILTER_ID } from '../neubrutalism';

function num(value: number | undefined): string {
  return value == null ? '' : String(Math.round(value * 100) / 100);
}

function esc(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Brutalist stroke renderer — crisp SVG with heavy strokes and hard
 * drop-shadow filter support. No rough.js dependency.
 */
export class BrutalistStrokeRenderer implements StrokeRenderer {
  readonly engine = 'brutalist' as const;

  seedFor(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private common(primitive: ShapePrimitive): string {
    const attrs: string[] = [];
    if (primitive.fill !== undefined) attrs.push(`fill="${esc(primitive.fill)}"`);
    if (primitive.stroke !== undefined) attrs.push(`stroke="${esc(primitive.stroke)}"`);
    if (primitive.strokeWidth !== undefined) attrs.push(`stroke-width="${num(primitive.strokeWidth)}"`);
    if (primitive.strokeLinejoin) attrs.push(`stroke-linejoin="${primitive.strokeLinejoin}"`);
    if (primitive.strokeLinecap) attrs.push(`stroke-linecap="${primitive.strokeLinecap}"`);
    if (primitive.dasharray) attrs.push(`stroke-dasharray="${esc(primitive.dasharray)}"`);
    if (primitive.opacity !== undefined && primitive.opacity !== 1) attrs.push(`opacity="${primitive.opacity}"`);
    return attrs.join(' ');
  }

  renderPrimitive(primitive: ShapePrimitive, _seed: number): string {
    const { bounds, rx } = primitive;
    const common = this.common(primitive);
    const filter = primitive.fillable ? ` filter="url(#${BRUTAL_SHADOW_FILTER_ID})"` : '';

    switch (primitive.kind) {
      case 'rect':
      case 'rounded-rect': {
        const rxAttr = rx ? ` rx="${num(rx)}" ry="${num(rx)}"` : '';
        return `<rect x="${num(bounds.x)}" y="${num(bounds.y)}" width="${num(bounds.width)}" height="${num(bounds.height)}"${rxAttr} ${common}${filter} />`;
      }
      case 'ellipse': {
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        return `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(bounds.width / 2)}" ry="${num(bounds.height / 2)}" ${common}${filter} />`;
      }
      case 'polygon':
        return `<polygon points="${esc(primitive.points)}" ${common}${filter} />`;
      case 'polyline':
        return `<polyline points="${esc(primitive.points)}" ${common} />`;
      case 'path':
        return `<path d="${esc(primitive.d)}" ${common}${filter} />`;
      case 'line':
        return `<line x1="${num(primitive.x1)}" y1="${num(primitive.y1)}" x2="${num(primitive.x2)}" y2="${num(primitive.y2)}" ${common} />`;
      default:
        return '';
    }
  }

  renderEdgePath(d: string, opts: EdgeStrokeOpts, _seed: number): string {
    const attrs: string[] = [
      `d="${esc(d)}"`,
      `fill="none"`,
      `stroke="${esc(opts.stroke)}"`,
      `stroke-width="${num(opts.strokeWidth)}"`,
      `stroke-linecap="square"`,
    ];
    if (opts.dasharray) attrs.push(`stroke-dasharray="${esc(opts.dasharray)}"`);
    if (opts.opacity !== undefined && opts.opacity !== 1) attrs.push(`opacity="${opts.opacity}"`);
    return `<path ${attrs.join(' ')} />`;
  }

  renderArrowhead(tip: Point, angle: number, color: string, _seed: number): string {
    const size = 12;
    const spread = 7;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const backX = tip.x - size * cos;
    const backY = tip.y - size * sin;
    const side = (dir: number) => {
      const bx = backX - sin * spread * dir;
      const by = backY + cos * spread * dir;
      return `${num(bx)},${num(by)}`;
    };
    const points = `${num(tip.x)},${num(tip.y)} ${side(1)} ${side(-1)}`;
    return `<polygon points="${points}" fill="${esc(color)}" />`;
  }
}
