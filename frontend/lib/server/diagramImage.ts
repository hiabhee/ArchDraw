import path from 'node:path';
import type { Edge, Node } from 'reactflow';
import { generatePureSVG } from '@/lib/diagram/export/svgExport';
import { resolveCanvasTokens, type DiagramRenderStyleId } from '@/lib/theme/renderStyles';

/**
 * A diagram as an image people can share: the same SVG the editor exports, in the hand-drawn
 * (sketch) look by default, as SVG or as a PNG for places that do not show SVG (chat apps,
 * documents, slides).
 */
export const IMAGE_STYLES = ['sketch', 'studio', 'studio-metallic', 'neubrutalism', 'precision'] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];
export type ImageTheme = 'light' | 'dark';
export type ImageFormat = 'png' | 'svg';

export interface ImageOptions {
  style: ImageStyle;
  theme: ImageTheme;
  format: ImageFormat;
  /** PNG pixels per canvas pixel (1 to 3). */
  scale: number;
  /** Colour theme id (`default`, `slate`, …) as in the editor; `studio` styles default to `studio-minimal`. */
  colorTheme?: string;
  /** The editor's default line grid behind the diagram (default on, as in the editor). */
  grid?: boolean;
}

const STYLE_IDS: Record<ImageStyle, DiagramRenderStyleId> = {
  sketch: 'sketch',
  studio: 'studio-minimal',
  'studio-metallic': 'studio-metallic',
  neubrutalism: 'neubrutalism',
  precision: 'precision',
};

/** The widest PNG produced, in pixels. */
export const MAX_PNG_WIDTH = 4096;

export function renderDiagramSvg(nodes: unknown[], edges: unknown[], options: Pick<ImageOptions, 'style' | 'theme' | 'colorTheme' | 'grid'>): string {
  const studio = options.style === 'studio' || options.style === 'studio-metallic';
  const isDark = options.theme === 'dark';
  const colorTheme = options.colorTheme ?? (studio ? 'studio-minimal' : 'default');
  // The canvas's own background token, so the image sits on the colour the editor draws.
  const tokens = resolveCanvasTokens({ renderStyleId: STYLE_IDS[options.style], colorThemeId: colorTheme, isDark }).cssVars;
  const grid = options.grid !== false;
  // The same default grid the editor draws and its export bakes in (24px lines in the theme's grid colour).
  const canvasBackground = grid
    ? { variant: 'lines' as const, bgColor: null, patternColor: tokens['--arch-canvas-grid'] || (isDark ? '#475569' : '#e5e7eb'), gap: 24, size: 1, showGrid: true }
    : undefined;
  return generatePureSVG(nodes as Node[], edges as Edge[], isDark, tokens['--arch-canvas-bg'], 'LR', STYLE_IDS[options.style], colorTheme, 'all', canvasBackground);
}

export interface RenderedImage {
  body: Buffer | string;
  contentType: string;
  width?: number;
}

export class ImageUnavailableError extends Error {}

/** TTFs bundled with the app (SIL OFL), so PNG text uses each style's own faces on any server. */
const FONT_FILES = [
  'Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold', 'Inter_700Bold',
  'PatrickHand_400Regular', 'Caveat_500Medium', 'Caveat_700Bold',
  'SpaceGrotesk_400Regular', 'SpaceGrotesk_500Medium', 'SpaceGrotesk_600SemiBold', 'SpaceGrotesk_700Bold',
  'JetBrainsMono_500Medium', 'JetBrainsMono_600SemiBold',
].map((name) => path.join(process.cwd(), 'assets', 'fonts', `${name}.ttf`));

export async function renderDiagramImage(nodes: unknown[], edges: unknown[], options: ImageOptions): Promise<RenderedImage> {
  const svg = renderDiagramSvg(nodes, edges, options);
  if (options.format === 'svg') return { body: svg, contentType: 'image/svg+xml; charset=utf-8' };

  let Resvg: typeof import('@resvg/resvg-js').Resvg;
  try {
    ({ Resvg } = await import('@resvg/resvg-js'));
  } catch {
    throw new ImageUnavailableError('PNG rendering is not available on this server; use format=svg.');
  }
  const svgWidth = Number(/<svg[^>]*\swidth="([\d.]+)"/.exec(svg)?.[1] ?? 1000);
  const scale = Math.max(0.25, Math.min(options.scale, MAX_PNG_WIDTH / Math.max(1, svgWidth)));
  const png = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    shapeRendering: 2,
    textRendering: 1,
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Inter' },
  }).render().asPng();
  return { body: Buffer.from(png), contentType: 'image/png', width: Math.round(svgWidth * scale) };
}
