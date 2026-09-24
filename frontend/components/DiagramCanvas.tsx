'use client';

import { useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@/components/nodes/nodeStyles.css';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { isDomainSuccess } from '@/lib/pipeline-core';
import { NODE_TYPES, EDGE_TYPES } from '@/lib/constants/canvasTypes';
import { SVGEdgeMarkerDefs } from '@/lib/utils/edgeColorUtils';
import { Maximize2, X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

type GraphState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  nodes: Node[];
  edges: Edge[];
  message?: string;
};

const EMPTY: GraphState = { status: 'idle', nodes: [], edges: [] };

function useGraphLoader(code: string): GraphState {
  const [state, setState] = useState<GraphState>(EMPTY);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setState({ status: 'loading', nodes: [], edges: [] });
    });
    void runMermaidPipeline(code)
      .then((result) => {
        if (cancelled) return;
        if (!isDomainSuccess(result)) {
          setState({
            status: 'error',
            nodes: [],
            edges: [],
            message: result.warnings?.[0] ?? 'The Mermaid pipeline rejected this diagram.',
          });
          return;
        }
        setState({
          status: 'ready',
          nodes: result.data.nodes as Node[],
          edges: result.data.edges as Edge[],
          message: result.data.warnings?.[0],
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: 'error',
          nodes: [],
          edges: [],
          message: err instanceof Error ? err.message : 'The diagram could not be rendered.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  return state;
}

function AutoFitCanvas({ state }: { state: GraphState }) {
  const { fitView } = useReactFlow();
  const fitted = useRef(false);

  useEffect(() => {
    if (state.status !== 'ready' || state.nodes.length === 0 || fitted.current) return;
    fitted.current = true;
    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.3, maxZoom: 1.4 });
    });
    return () => cancelAnimationFrame(frame);
  }, [state.status, state.nodes.length, fitView]);

  return (
    <ReactFlow
      nodes={state.nodes}
      edges={state.edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      minZoom={0.1}
      maxZoom={3}
      fitView={false}
      onInit={(instance) => {
        if (state.nodes.length > 0) instance.fitView({ padding: 0.3, maxZoom: 1.4 });
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable position="bottom-right" maskColor="rgba(2,6,23,0.12)" nodeColor="#94a3b8" />
      <SVGEdgeMarkerDefs />
    </ReactFlow>
  );
}

function DiagramBody({ state }: { state: GraphState }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return <div className="h-full animate-pulse bg-text-muted/10" aria-hidden="true" />;
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="flex h-full items-center p-5 text-xs leading-5 text-destructive">
        {state.message ?? 'This diagram could not be rendered.'}
      </div>
    );
  }

  if (state.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-5 text-xs text-text-muted">
        This wireframe produced no nodes.
      </div>
    );
  }

  return (
    <>
      <AutoFitCanvas state={state} />
      {state.message ? (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-surface-panel/90 px-2 py-0.5 text-[10px] text-text-muted">
          {state.message}
        </div>
      ) : null}
    </>
  );
}

function DiagramThread({
  keyCode,
  label,
  onExpand,
  state,
}: {
  keyCode: string;
  label: string;
  onExpand: () => void;
  state: GraphState;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">{label}</p>
        <button
          type="button"
          onClick={onExpand}
          aria-label="Open diagram in fullscreen"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-page px-2.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-brand hover:text-brand"
        >
          <Maximize2 className="size-3.5" aria-hidden="true" />
          Fullscreen
        </button>
      </div>
      <div className="relative mt-3 h-[340px] overflow-hidden rounded-xl border border-border-default bg-white sm:h-[420px]">
        <ReactFlowProvider key={keyCode}>
          <DiagramBody state={state} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export function DiagramStage({
  code,
  label,
  patternLabel,
}: {
  code: string;
  label: string;
  patternLabel?: string;
}) {
  const state = useGraphLoader(code);
  const [fullscreen, setFullscreen] = useState(false);
  useBodyScrollLock(fullscreen);

  return (
    <>
      {!fullscreen ? (
        <section className="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-panel p-5 shadow-1">
          <DiagramThread keyCode={code} label={label} onExpand={() => setFullscreen(true)} state={state} />
          {patternLabel ? (
            <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-bg px-2.5 py-1 text-xs font-medium capitalize text-brand">
              {patternLabel}
            </div>
          ) : null}
        </section>
      ) : null}

      {fullscreen ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-surface-page p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${label} — fullscreen diagram`}
        >
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-panel shadow-2">
            <header className="flex items-center justify-between gap-3 border-b border-border-default px-5 py-3.5">
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">{label}</p>
                {patternLabel ? (
                  <span className="rounded-full bg-brand-bg px-2.5 py-1 text-xs font-medium capitalize text-brand">
                    {patternLabel}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                aria-label="Close fullscreen diagram"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-page px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-destructive hover:text-destructive"
              >
                <X className="size-3.5" aria-hidden="true" />
                Close
              </button>
            </header>
            <div className="relative min-h-0 flex-1 bg-white p-3 sm:p-4">
              <ReactFlowProvider key={`fs-${code}`}>
                <DiagramBody state={state} />
              </ReactFlowProvider>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}