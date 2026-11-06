import type { SketchEdgeInk } from '@/lib/theme/renderStyles';

/**
 * Which theme colour each kind of connector is inked with. The canvas (`useEdgeColors`) and the SVG
 * export both read it, so an edge cannot be one colour on screen and another in an exported image.
 */
export function edgeThemeInk(colors: { edgePrimary: string; edgeDefault: string; edgeAsync: string }): Partial<SketchEdgeInk> {
  return {
    primary: colors.edgePrimary,
    default: colors.edgeDefault,
    supporting: colors.edgeDefault,
    dep: colors.edgeDefault,
    async: colors.edgeAsync,
    stream: colors.edgePrimary,
    event: colors.edgePrimary,
  };
}
