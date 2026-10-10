'use client';

import { useMemo } from 'react';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { useCanvasTheme } from '@/lib/theme/appTheme';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles';

/**
 * Resolved render-style tokens for canvas consumers (nodes, edges, groups,
 * labels). Recomputes only when render style, color theme, or light/dark change.
 */
export function useDiagramAesthetics() {
  const { renderStyleId, colorThemeId } = useCanvasView();
  const { isDark } = useCanvasTheme();

  return useMemo(
    () => resolveCanvasTokens({ renderStyleId, colorThemeId, isDark }),
    [renderStyleId, colorThemeId, isDark],
  );
}
