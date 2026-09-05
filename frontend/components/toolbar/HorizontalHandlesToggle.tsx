'use client';

import { ArrowLeftRight } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function HorizontalHandlesToggle() {
  const horizontalOnly = useDiagramStore((s) => s.horizontalOnlyHandles);
  const toggle = useDiagramStore((s) => s.toggleHorizontalOnlyHandles);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        toggle();
        const next = !horizontalOnly;
        toast.success(next ? 'Horizontal-only handles enabled' : 'All sides enabled', {
          description: next
            ? 'Edges will only use left/right handles. Top/bottom connections are redirected.'
            : 'Edges may use any side.',
        });
      }}
      className={`!w-8 sm:!w-9 !h-8 sm:!h-9 ${horizontalOnly ? 'text-primary bg-primary/15 dark:bg-primary/25 ring-1 ring-primary/40' : ''}`}
      title={horizontalOnly ? 'Horizontal-only: click to allow all sides' : 'Allow only left/right handles'}
      aria-label={horizontalOnly ? 'Disable horizontal-only handles' : 'Enable horizontal-only handles'}
      aria-pressed={horizontalOnly}
    >
      <ArrowLeftRight className="w-3.5 sm:w-4 h-3.5 sm:h-4" aria-hidden="true" />
    </Button>
  );
}
