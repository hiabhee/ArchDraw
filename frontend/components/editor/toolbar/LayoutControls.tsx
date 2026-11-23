'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Orbit, Rows3 } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { relayoutInWorker } from '@/lib/diagram/mermaid/relayoutWorkerClient';
import { Button } from '@/components/ui/button';

/**
 * Switches between rank columns (`flow`) and the hub-and-zones layout, which
 * puts the most connected component in the middle with clients, data and
 * pipelines around it. Re-lays out the open diagram; falls back to the flow
 * layout on its own when a diagram has no central component.
 */
export function LayoutStyleButton() {
  const layoutStyle = useDiagramStore((s) => s.diagramLayoutStyle);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);
  const [pending, setPending] = useState(false);
  const zones = layoutStyle === 'zones';
  const nextStyle = zones ? 'flow' : 'zones';

  const handleToggle = async () => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setPending(true);
    let unsubscribe: (() => void) | undefined;
    try {
      const store = useDiagramStore.getState();
      const { nodes, edges, activeCanvasId, canvases, activeLayoutPresetId } = store;
      const canvasName = canvases.find((c) => c.id === activeCanvasId)?.name;
      const direction = activeLayoutPresetId === 'layered-tb' ? 'TD' : 'LR';
      const matches = (current: typeof store) =>
        current.activeCanvasId === activeCanvasId && current.nodes === nodes && current.edges === edges;
      unsubscribe = useDiagramStore.subscribe(current => {
        if (!matches(current)) request.abort();
      });

      const { nodes: layoutedNodes, edges: layoutedEdges, success, warnings, geometrySummary } =
        await relayoutInWorker([nodes, edges, direction, {
          title: canvasName,
          renderStyleId: store.diagramRenderStyle,
          iconMode: store.iconMode,
          layoutStyle: nextStyle,
        }], request.signal);

      if (request.signal.aborted) return;
      const liveStore = useDiagramStore.getState();
      if (!matches(liveStore)) return;
      unsubscribe();
      unsubscribe = undefined;
      if (!success) {
        toast.error(`Layout change failed: ${warnings.join('; ') || 'unknown error'}`);
        return;
      }

      liveStore.setDiagramLayoutStyle(nextStyle);
      liveStore.importDiagram(layoutedNodes, layoutedEdges, { preserveLayout: true });
      if (geometrySummary?.hardViolations || geometrySummary?.criticalPathDisconnectCount) {
        toast.warning('Layout applied with unresolved diagram geometry issues.');
      }
    } catch (err) {
      if (!request.signal.aborted) {
        toast.error(err instanceof Error ? err.message : 'Layout change failed');
      }
    } finally {
      unsubscribe?.();
      if (requestRef.current === request) {
        requestRef.current = null;
        setPending(false);
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={pending}
      aria-busy={pending}
      aria-pressed={zones}
      className="!w-8 sm:!w-9 !h-8 sm:!h-9"
      title={zones ? 'Layout style: hub and zones (click for flow columns)' : 'Layout style: flow columns (click for hub and zones)'}
    >
      {zones ? <Orbit className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> : <Rows3 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
    </Button>
  );
}
