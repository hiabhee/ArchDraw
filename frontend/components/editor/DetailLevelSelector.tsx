'use client';

import { useDiagramStore } from '@/store/diagramStore';

export function DetailLevelSelector() {
  const { detailLevel, setDetailLevel } = useDiagramStore();

  return (
    <div 
      className="flex items-center gap-0.5 bg-accent/25 border border-border/30 p-0.5 rounded-lg text-xs" 
      title="Detail Level: toggles progressive disclosure of diagram complexity"
    >
      <button
        onClick={() => setDetailLevel(1)}
        className={`px-2 py-0.5 rounded-md transition-all font-semibold text-[10px] sm:text-[11px] ${
          detailLevel === 1
            ? 'bg-popover text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
        }`}
        title="Level 1: Main Spine Only"
      >
        L1
      </button>
      <button
        onClick={() => setDetailLevel(2)}
        className={`px-2 py-0.5 rounded-md transition-all font-semibold text-[10px] sm:text-[11px] ${
          detailLevel === 2
            ? 'bg-popover text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
        }`}
        title="Level 2: Core Components"
      >
        L2
      </button>
      <button
        onClick={() => setDetailLevel(3)}
        className={`px-2 py-0.5 rounded-md transition-all font-semibold text-[10px] sm:text-[11px] ${
          detailLevel === 3
            ? 'bg-popover text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
        }`}
        title="Level 3: All Details"
      >
        L3
      </button>
    </div>
  );
}
