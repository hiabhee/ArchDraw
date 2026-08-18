import type { RenderStylePack } from './types';

/**
 * Precision render style — maps current canvas behavior 1:1.
 * This is the regression baseline: default `strokeEngine: 'crisp'`,
 * Inter typography, crisp 1.25px strokes, soft shadows.
 */
export const PRECISION_RENDER_STYLE: RenderStylePack = {
  id: 'precision',
  label: 'Precision',
  description: 'Clean, crisp diagramming — the current default look.',
  strokeEngine: 'crisp',

  fonts: {
    title: 'Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif',
    subtitle: 'Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif',
    edgeLabel: 'Inter, system-ui, -apple-system, sans-serif',
    annotation: 'Inter, system-ui, -apple-system, sans-serif',
  },

  geometry: {
    borderRadiusScale: 1,
    strokeWidthScale: 1,
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
