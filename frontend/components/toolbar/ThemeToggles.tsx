'use client';

import { PencilLine, Shapes } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { ensureSketchFontLoaded } from '@/lib/theme/renderStyles';
import { analytics } from '@/lib/analytics';
import { Button } from '@/components/ui/button';

export function RenderStyleToggle() {
  const diagramRenderStyle = useDiagramStore((s) => s.diagramRenderStyle);
  const setDiagramRenderStyle = useDiagramStore((s) => s.setDiagramRenderStyle);

  const isSketch = diagramRenderStyle === 'sketch';

  const handleToggle = () => {
    const next = isSketch ? 'precision' : 'sketch';
    setDiagramRenderStyle(next);
    if (next === 'sketch') ensureSketchFontLoaded();
    analytics.track({
      event_type: 'click',
      event_name: 'render_style_toggle',
      page_path: typeof window !== 'undefined' ? window.location.pathname : '',
      payload: { style: isSketch ? 'precision' : 'sketch' },
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className={`!w-8 sm:!w-9 !h-8 sm:!h-9 ${
        isSketch
          ? 'text-primary bg-primary/15 dark:bg-primary/25 ring-1 ring-primary/40'
          : ''
      }`}
      title={isSketch ? 'Render style: Sketch (click for Precision)' : 'Render style: Precision (click for Sketch)'}
    >
      {isSketch ? (
        <PencilLine className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
      ) : (
        <Shapes className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
      )}
    </Button>
  );
}
