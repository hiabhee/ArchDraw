'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowRightToLine } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { layoutDiagramViaMermaid, presetIdFromDirection } from '@/lib/mermaid/relayout';
import { Button } from '@/components/ui/button';

export function LayoutToggleButton() {
  const activeLayoutPresetId = useDiagramStore((s) => s.activeLayoutPresetId);
  // Latest-request guard: relayout is async and unguarded writes let a slow
  // stale toggle clobber a newer one (or an in-flight AI generation).
  const latestRequestRef = useRef(0);
  const [pending, setPending] = useState(false);

  const isVertical = activeLayoutPresetId === 'layered-tb';
  const nextLabel = isVertical ? 'Left → Right' : 'Top → Bottom';
  const nextDirection = isVertical ? 'LR' : 'TD';

  const handleToggle = async () => {
    const requestId = ++latestRequestRef.current;
    setPending(true);
    try {
      const store = useDiagramStore.getState();
      const { nodes, edges, activeCanvasId, canvases } = store;
      const canvasName = canvases.find((c) => c.id === activeCanvasId)?.name;

      const { nodes: layoutedNodes, edges: layoutedEdges, success, warnings } =
        await layoutDiagramViaMermaid(nodes, edges, nextDirection, { title: canvasName });

      if (requestId !== latestRequestRef.current) return;
      if (!success) {
        toast.error(`Layout toggle failed: ${warnings.join('; ') || 'unknown error'}`);
        return;
      }

      store.importDiagram(layoutedNodes, layoutedEdges);
      store.setActiveLayoutPresetId(presetIdFromDirection(nextDirection));
    } catch (err) {
      if (requestId === latestRequestRef.current) {
        toast.error(err instanceof Error ? err.message : 'Layout toggle failed');
      }
    } finally {
      if (requestId === latestRequestRef.current) setPending(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={pending}
      className="!w-8 sm:!w-9 !h-8 sm:!h-9"
      title={`Layout: ${isVertical ? 'Top → Bottom' : 'Left → Right'} (click for ${nextLabel})`}
    >
      {isVertical ? (
        <ArrowDownToLine className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
      ) : (
        <ArrowRightToLine className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
      )}
    </Button>
  );
}
