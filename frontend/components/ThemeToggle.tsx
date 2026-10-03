'use client';

import { ChevronDown, Pencil } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles';

const RENDER_STYLES: { id: DiagramRenderStyleId; label: string }[] = [
  { id: 'precision', label: 'Precision' },
  { id: 'sketch', label: 'Sketch' },
  { id: 'neubrutalism', label: 'Neubrutalism' },
  { id: 'studio-minimal', label: 'Studio Minimal' },
] as const;

const selectClassName =
  'h-8 w-10 sm:w-[126px] appearance-none rounded-lg border border-border bg-background px-2 pr-7 text-transparent sm:text-xs sm:text-foreground outline-none transition-colors hover:bg-muted focus:ring-2 focus:ring-ring';

export function ThemeToggle() {
  const diagramRenderStyle = useDiagramStore((s) => s.diagramRenderStyle);
  const setDiagramRenderStyle = useDiagramStore((s) => s.setDiagramRenderStyle);

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="diagram-render-style">Drawing style</label>
      <select
        id="diagram-render-style"
        aria-label="Drawing style"
        value={diagramRenderStyle}
        onChange={(event) => {
          const style = RENDER_STYLES.find((item) => item.id === event.target.value);
          if (style) setDiagramRenderStyle(style.id);
        }}
        className={selectClassName}
        title="Choose how diagram shapes are drawn"
      >
        {RENDER_STYLES.map((style) => (
          <option key={style.id} value={style.id} className="bg-background text-foreground">
            {style.label}
          </option>
        ))}
      </select>
      <Pencil className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground sm:hidden" aria-hidden="true" />
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
