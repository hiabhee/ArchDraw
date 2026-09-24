import type { RenderStylePack } from './types';

/**
 * Studio Minimal — a deliberately quieter crisp renderer.
 *
 * It keeps the canonical geometry and routing engine, but gives cards the
 * larger, softer corners and lighter visual weight of the Studio reference.
 */
export const STUDIO_MINIMAL_RENDER_STYLE: RenderStylePack = {
  id: 'studio-minimal',
  label: 'Studio Minimal',
  description: 'Airy editorial cards, hairline structure, and restrained depth.',
  strokeEngine: 'crisp',
  fonts: {
    title: 'Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif',
    subtitle: 'Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif',
    edgeLabel: 'Inter, system-ui, -apple-system, sans-serif',
    annotation: 'Inter, system-ui, -apple-system, sans-serif',
  },
  geometry: {
    borderRadiusScale: 1.6,
    strokeWidthScale: 0.9,
    labelPaddingX: 0,
    labelPaddingY: 0,
    sizeGridNudge: 0,
    dropShadow: 'soft',
  },
  edges: {
    pathStyle: 'orthogonal',
    arrowheadStyle: 'triangle',
    labelBackground: 'pill',
    animatedAsync: true,
  },
  groups: {
    borderStyle: 'solid',
    labelStyle: 'tag',
    fillOpacity: 1,
  },
  icons: {
    mode: 'sharp',
  },
};
