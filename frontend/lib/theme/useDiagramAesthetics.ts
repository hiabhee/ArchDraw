'use client';

import { useMemo } from 'react';
import { useDiagramStore } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles';

/**
 * Resolved render-style tokens for canvas consumers (nodes, edges, groups,
 * labels). Recomputes only when render style, color theme, or light/dark change.
 */
export function useDiagramAesthetics() {
  const renderStyleId = useDiagramStore((s) => s.diagramRenderStyle);
  const colorThemeId = useDiagramStore((s) => s.diagramStyleTheme);
  const { isDark } = useCanvasTheme();

  return useMemo(
    () => resolveCanvasTokens({ renderStyleId, colorThemeId, isDark }),
    [renderStyleId, colorThemeId, isDark],
  );
}
