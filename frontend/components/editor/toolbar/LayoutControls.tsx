'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowRightToLine, Orbit, Rows3 } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { layoutDiagramViaMermaid, presetIdFromDirection } from '@/lib/diagram/mermaid/relayout';
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
        await layoutDiagramViaMermaid(nodes, edges, nextDirection, {
          title: canvasName,
          renderStyleId: store.diagramRenderStyle,
          layoutStyle: store.diagramLayoutStyle,
        });

      if (requestId !== latestRequestRef.current) return;
      const liveStore = useDiagramStore.getState();
      if (liveStore.activeCanvasId !== activeCanvasId || liveStore.nodes !== nodes || liveStore.edges !== edges) {
        return;
      }
      if (!success) {
        toast.error(`Layout toggle failed: ${warnings.join('; ') || 'unknown error'}`);
        return;
      }

      liveStore.importDiagram(layoutedNodes, layoutedEdges);
      liveStore.setActiveLayoutPresetId(presetIdFromDirection(nextDirection));
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

/**
 * Switches between rank columns (`flow`) and the hub-and-zones layout, which
 * puts the most connected component in the middle with clients, data and
 * pipelines around it. Re-lays out the open diagram; falls back to the flow
 * layout on its own when a diagram has no central component.
 */
export function LayoutStyleButton() {
  const layoutStyle = useDiagramStore((s) => s.diagramLayoutStyle);
  const latestRequestRef = useRef(0);
  const [pending, setPending] = useState(false);
  const zones = layoutStyle === 'zones';
  const nextStyle = zones ? 'flow' : 'zones';

  const handleToggle = async () => {
    const requestId = ++latestRequestRef.current;
    setPending(true);
    try {
      const store = useDiagramStore.getState();
      const { nodes, edges, activeCanvasId, canvases, activeLayoutPresetId } = store;
      const canvasName = canvases.find((c) => c.id === activeCanvasId)?.name;
      const direction = activeLayoutPresetId === 'layered-tb' ? 'TD' : 'LR';

      const { nodes: layoutedNodes, edges: layoutedEdges, success, warnings } =
        await layoutDiagramViaMermaid(nodes, edges, direction, {
          title: canvasName,
          renderStyleId: store.diagramRenderStyle,
          layoutStyle: nextStyle,
        });

      if (requestId !== latestRequestRef.current) return;
      const liveStore = useDiagramStore.getState();
      if (liveStore.activeCanvasId !== activeCanvasId || liveStore.nodes !== nodes || liveStore.edges !== edges) return;
      if (!success) {
        toast.error(`Layout change failed: ${warnings.join('; ') || 'unknown error'}`);
        return;
      }

      liveStore.setDiagramLayoutStyle(nextStyle);
      liveStore.importDiagram(layoutedNodes, layoutedEdges);
    } catch (err) {
      if (requestId === latestRequestRef.current) {
        toast.error(err instanceof Error ? err.message : 'Layout change failed');
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
      aria-pressed={zones}
      className="!w-8 sm:!w-9 !h-8 sm:!h-9"
      title={zones ? 'Layout style: hub and zones (click for flow columns)' : 'Layout style: flow columns (click for hub and zones)'}
    >
      {zones ? <Orbit className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> : <Rows3 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
    </Button>
  );
}
