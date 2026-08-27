import type { ShapeFit } from '@/lib/utils/nodeSizing';

/** CSS clip-path inset matching ShapeNode diamond polygon (4px inset). */
export function diamondClipPath(width: number, height: number, inset = 4): string {
  const cx = width / 2;
  const cy = height / 2;
  return `polygon(${cx}px ${inset}px, ${width - inset}px ${cy}px, ${cx}px ${height - inset}px, ${inset}px ${cy}px)`;
}

/**
 * Max label width inside a shape silhouette. Diamonds/circles are narrower at
 * the bottom — subtitles get a tighter band than titles. Tapered semantic
 * shapes (hexagon, shield) use their mid-band too. Stays aligned with
 * `nodeSizing.SHAPE_TEXT_BAND`.
 */
export function getShapeLabelMaxWidth(
  shape: ShapeFit | string | undefined,
  width: number,
  row: 'title' | 'subtitle' = 'title',
): number {
  const bandFor: Record<string, { title: number; subtitle: number }> = {
    diamond: { title: 0.42, subtitle: 0.34 },
    circle: { title: 0.42, subtitle: 0.34 },
    parallelogram: { title: 0.68, subtitle: 0.6 },
    hexagon: { title: 0.52, subtitle: 0.42 },
    shield: { title: 0.6, subtitle: 0.5 },
    monitor: { title: 0.72, subtitle: 0.62 },
    mobile: { title: 0.56, subtitle: 0.48 },
    cloud: { title: 0.8, subtitle: 0.68 },
    // New architecture-native shapes
    queue: { title: 0.78, subtitle: 0.68 },
    cache: { title: 0.7, subtitle: 0.6 },
    function: { title: 0.68, subtitle: 0.58 },
    container: { title: 0.76, subtitle: 0.66 },
    bucket: { title: 0.72, subtitle: 0.62 },
  };
  const band = shape ? bandFor[String(shape)] : undefined;
  if (band) {
    return Math.max(56, Math.round(width * band[row]));
  }
  return Math.max(72, Math.round(width * 0.88));
}

/** Nudge stacked icon+title+sublabel upward so lower lines stay in the wide mid-band. */
export function getDiamondLabelNudge(
  shape: ShapeFit | string | undefined,
  hasIcon: boolean,
  hasSublabel: boolean,
): number {
  if (shape !== 'diamond') return 0;
  if (hasIcon && hasSublabel) return -10;
  if (hasSublabel) return -6;
  if (hasIcon) return -4;
  return 0;
}
