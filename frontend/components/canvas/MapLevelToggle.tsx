'use client';

import type { MapLevel } from '@/lib/diagram/projects/liveActivity';

/**
 * Overview | Detailed switch for a live project. The overview (HLD) is the
 * project canvas; the detailed map shows each component as a box of its
 * modules and files. Used in the editor toolbar and on the watch page.
 */
export function MapLevelToggle({
  level,
  onChange,
  hasDetail,
  className = '',
}: {
  level: MapLevel;
  onChange: (level: MapLevel) => void;
  hasDetail: boolean;
  className?: string;
}) {
  const option = (value: MapLevel, label: string, title: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={level === value}
      onClick={() => onChange(value)}
      title={title}
      className={`h-6 rounded-md px-2.5 text-xs font-medium transition-colors ${
        level === value
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div
      role="radiogroup"
      aria-label="Map detail level"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/60 p-0.5 ${className}`}
    >
      {option('overview', 'Overview', 'High-level design: the main components and how they connect')}
      {option(
        'detail',
        'Detailed',
        hasDetail
          ? 'Each component opened up into its modules and files (view only)'
          : 'Not drawn yet: run npx archdraw-live --detail in your repository',
      )}
    </div>
  );
}

/** Shown in the detailed view while no detailed map exists yet. */
export function DetailMapEmpty() {
  return (
    <div className="pointer-events-auto mx-4 max-w-sm rounded-2xl border border-border/70 bg-background/95 p-5 text-sm shadow-xl backdrop-blur">
      <p className="font-semibold text-foreground">No detailed map yet</p>
      <p className="mt-1.5 text-muted-foreground">
        Claude draws it from your code, right after the overview. To draw it now, run this in your repository:
      </p>
      <code className="mt-3 block rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">npx archdraw-live --detail</code>
    </div>
  );
}
