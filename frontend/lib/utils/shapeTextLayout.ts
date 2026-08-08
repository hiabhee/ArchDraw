import type { ShapeFit } from '@/lib/utils/nodeSizing';

/** CSS clip-path inset matching ShapeNode diamond polygon (4px inset). */
export function diamondClipPath(width: number, height: number, inset = 4): string {
  const cx = width / 2;
  const cy = height / 2;
  return `polygon(${cx}px ${inset}px, ${width - inset}px ${cy}px, ${cx}px ${height - inset}px, ${inset}px ${cy}px)`;
}

/**
 * Max label width inside a shape silhouette. Diamonds/circles are narrower at
 * the bottom — subtitles get a tighter band than titles.
 */
export function getShapeLabelMaxWidth(
  shape: ShapeFit | string | undefined,
  width: number,
  row: 'title' | 'subtitle' = 'title',
): number {
  const isTapered = shape === 'diamond' || shape === 'circle';
  if (isTapered) {
    const band = row === 'subtitle' ? 0.34 : 0.42;
    return Math.max(56, Math.round(width * band));
  }
  if (shape === 'parallelogram') {
    return Math.max(72, Math.round(width * 0.68));
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
