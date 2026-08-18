'use client';

import { toast } from 'sonner';
import { ArrowDownToLine, ArrowRightToLine } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { layoutDiagramViaMermaid } from '@/lib/mermaid/relayout';
import { Button } from '@/components/ui/button';

export function LayoutToggleButton() {
  const activeLayoutPresetId = useDiagramStore((s) => s.activeLayoutPresetId);

  const isVertical = activeLayoutPresetId === 'layered-tb';
  const nextLabel = isVertical ? 'Left → Right' : 'Top → Bottom';
  const nextDirection = isVertical ? 'LR' : 'TD';

  const handleToggle = async () => {
    const store = useDiagramStore.getState();
    const { nodes, edges, activeCanvasId, canvases } = store;
    const canvasName = canvases.find((c) => c.id === activeCanvasId)?.name;

    try {
      const { nodes: layoutedNodes, edges: layoutedEdges, success, warnings } =
        await layoutDiagramViaMermaid(nodes, edges, nextDirection, { title: canvasName });
      if (!success) {
        toast.error(`Layout toggle failed: ${warnings.join('; ') || 'unknown error'}`);
        return;
      }

      store.importDiagram(layoutedNodes, layoutedEdges);
      store.setActiveLayoutPresetId(nextDirection === 'LR' ? 'layered-lr' : 'layered-tb');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Layout toggle failed');
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
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
