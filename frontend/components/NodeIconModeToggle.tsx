'use client';

import { Image } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import type { NodeIconMode } from '@/lib/utils/nodeIconVisibility';

/** Icons are visible in "all" and "normal" modes; only "off" hides them. */
function isOn(mode: NodeIconMode): boolean {
  return mode === 'all' || mode === 'normal';
}

/**
 * Compact On / Off control for node icons. 'On' maps to All (every icon),
 * 'Off' hides every icon; the finer All / Normal / Off choice lives in
 * Settings. The image glyph hints that this controls node icons.
 */
export function NodeIconModeToggle() {
  const iconMode = useDiagramStore((s) => s.iconMode);
  const setIconMode = useDiagramStore((s) => s.setIconMode);
  const on = isOn(iconMode);

  return (
    <div
      className="flex items-center rounded-md border border-border/60 bg-muted/60 p-0.5"
      role="group"
      aria-label="Node icons"
    >
      <Image className="w-3.5 h-3.5 mx-1 text-muted-foreground" aria-hidden="true" />
      {(
        [
          { value: 'all', label: 'On' },
          { value: 'off', label: 'Off' },
        ] as const
      ).map((option) => {
        const active = (option.value === 'all' && on) || (option.value === 'off' && !on);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setIconMode(option.value)}
            aria-pressed={active}
            title={option.value === 'all' ? 'Show node icons' : 'Hide node icons'}
            className={`cursor-pointer rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
