'use client';

import { Background, BackgroundVariant, useViewport } from 'reactflow';
import type { CanvasBackgroundConfig } from '@/store/diagram/types';

export function CanvasGrid({ background, isDark, gridColor, transparent, opacity }: {
  background: CanvasBackgroundConfig;
  isDark: boolean;
  gridColor?: string;
  transparent?: boolean;
  opacity?: number;
}) {
  const { x, y, zoom } = useViewport();
  const { variant, gap, size, patternColor } = background;

  if (variant === 'dots') {
    return <Background
      variant={BackgroundVariant.Dots}
      gap={gap}
      size={size}
      color={patternColor ?? gridColor ?? (isDark ? '#94a3b8' : '#e2e8f0')}
      className={transparent ? 'archdraw-export-grid-transparent' : undefined}
      style={{ opacity: opacity ?? (isDark ? 0.35 : 0.5) }}
    />;
  }

  const color = patternColor ?? gridColor ?? (isDark ? 'hsl(var(--grid-color))' : '#e5e7eb');
  return <div
    className="archdraw-lines-background"
    style={{
      position: 'absolute',
      inset: 0,
      zIndex: 0,
      backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
      backgroundSize: `${gap * zoom}px ${gap * zoom}px`,
      backgroundPosition: `${x}px ${y}px`,
      opacity: opacity ?? (isDark ? 0.25 : 1),
      pointerEvents: 'none',
    }}
  />;
}
