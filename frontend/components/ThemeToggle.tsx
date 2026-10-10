'use client';

import { ChevronDown } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';

const OPTIONS = [
  { id: 'normal', label: 'Normal', renderStyle: 'precision', diagramTheme: 'default' },
  { id: 'sketchy', label: 'Sketchy', renderStyle: 'sketch', diagramTheme: 'default' },
  { id: 'neobrutalism', label: 'Neobrutalism', renderStyle: 'neubrutalism', diagramTheme: 'default' },
  { id: 'studio-minimal', label: 'Studio Minimal', renderStyle: 'studio-minimal', diagramTheme: 'studio-minimal' },
] as const;

export function ThemeToggle() {
  const diagramStyleTheme = useDiagramStore((s) => s.diagramStyleTheme);
  const diagramRenderStyle = useDiagramStore((s) => s.diagramRenderStyle);
  const setDiagramStyleTheme = useDiagramStore((s) => s.setDiagramStyleTheme);
  const setDiagramRenderStyle = useDiagramStore((s) => s.setDiagramRenderStyle);
  const selectedId = OPTIONS.find(
    (option) => option.diagramTheme === diagramStyleTheme && option.renderStyle === diagramRenderStyle,
  )?.id ?? 'normal';

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="diagram-theme">Diagram theme</label>
      <select
        id="diagram-theme"
        value={selectedId}
        onChange={(event) => {
          const option = OPTIONS.find((item) => item.id === event.target.value);
          if (!option) return;
          setDiagramStyleTheme(option.diagramTheme);
          setDiagramRenderStyle(option.renderStyle);
        }}
        className="h-8 w-9 sm:w-[120px] appearance-none rounded-lg border border-border bg-background px-2 pr-7 text-xs text-foreground outline-none transition-colors hover:bg-muted focus:ring-2 focus:ring-ring"
        title="Choose diagram appearance"
      >
        {OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
