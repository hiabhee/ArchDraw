'use client';

import { Box, PencilLine, Shapes } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { ensureRenderStyleFontLoaded } from '@/lib/theme/renderStyles';
import { analytics } from '@/lib/analytics';
import { Button } from '@/components/ui/button';

const ORDER = ['precision', 'sketch', 'neubrutalism'] as const;

const META = {
  precision: {
    icon: Shapes,
    label: 'Precision',
    title: 'Render style: Precision (click for Sketch)',
    active: false,
  },
  sketch: {
    icon: PencilLine,
    label: 'Sketch',
    title: 'Render style: Sketch (click for Neubrutalism)',
    active: true,
  },
  neubrutalism: {
    icon: Box,
    label: 'Neubrutalism',
    title: 'Render style: Neubrutalism (click for Precision)',
    active: true,
  },
} as const;

export function RenderStyleToggle() {
  const diagramRenderStyle = useDiagramStore((s) => s.diagramRenderStyle);
  const setDiagramRenderStyle = useDiagramStore((s) => s.setDiagramRenderStyle);

  const handleToggle = () => {
    const idx = ORDER.indexOf(diagramRenderStyle as (typeof ORDER)[number]);
    const next = ORDER[(idx + 1) % ORDER.length];
    setDiagramRenderStyle(next);
    ensureRenderStyleFontLoaded(next);
    analytics.track({
      event_type: 'click',
      event_name: 'render_style_toggle',
      page_path: typeof window !== 'undefined' ? window.location.pathname : '',
      payload: { style: next },
    });
  };

  const meta = META[diagramRenderStyle as (typeof ORDER)[number]] ?? META.precision;
  const Icon = meta.icon;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className={`!w-8 sm:!w-9 !h-8 sm:!h-9 ${
        meta.active
          ? 'text-primary bg-primary/15 dark:bg-primary/25 ring-1 ring-primary/40'
          : ''
      }`}
      title={meta.title}
    >
      <Icon className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
    </Button>
  );
}
