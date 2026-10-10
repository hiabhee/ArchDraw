'use client';

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, useState, type ReactNode } from 'react';
import { useStore, type Edge, type Node, type ReactFlowState } from 'reactflow';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { computeDiagramGeometryPreview, computeDiagramGeometryPlan, geometrySnapshotKey, type DiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry';
import { computeDiagramGeometryInWorker } from '@/lib/diagram/geometry/diagramGeometryWorkerClient';
import type { EdgeRouteHandleAnchors } from '@/lib/diagram/edges/edgeRouteBuilder';

type EdgeGeometrySnapshot = { route?: DiagramGeometryPlan['routes'] extends ReadonlyMap<string, infer R> ? R : never; label?: DiagramGeometryPlan['labels'] extends ReadonlyMap<string, infer L> ? L : never; provisional: boolean };
const emptyEdgeGeometry: EdgeGeometrySnapshot = Object.freeze({ provisional: true });
class DiagramGeometryStore {
  plan: DiagramGeometryPlan | null = null;
  edges = new Map<string, EdgeGeometrySnapshot>();
  allListeners = new Set<() => void>();
  edgeListeners = new Map<string, Set<() => void>>();
  subscribeAll = (listener: () => void) => { this.allListeners.add(listener); return () => this.allListeners.delete(listener); };
  subscribeEdge = (id: string, listener: () => void) => {
    const listeners = this.edgeListeners.get(id) ?? new Set<() => void>(); listeners.add(listener); this.edgeListeners.set(id, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.edgeListeners.delete(id); };
  };
  set(plan: DiagramGeometryPlan) {
    const wasProvisional = this.plan?.provisional ?? true;
    this.plan = plan;
    const ids = new Set([...plan.routes.keys(), ...plan.labels.keys(), ...this.edges.keys()]);
    for (const id of ids) {
      const prior = this.edges.get(id) ?? emptyEdgeGeometry;
      const route = plan.routes.get(id), label = plan.labels.get(id);
      if (prior.route === route && prior.label === label && wasProvisional === Boolean(plan.provisional)) continue;
      const next = route || label || plan.provisional ? { route, label, provisional: Boolean(plan.provisional) } : emptyEdgeGeometry;
      if (next === emptyEdgeGeometry) this.edges.delete(id); else this.edges.set(id, next);
      this.edgeListeners.get(id)?.forEach(listener => listener());
    }
    this.allListeners.forEach(listener => listener());
  }
  getEdge = (id: string) => this.edges.get(id) ?? emptyEdgeGeometry;
}
const geometryStore = new DiagramGeometryStore();
const DiagramGeometryContext = createContext(geometryStore);
const settledPlans = new Map<string, DiagramGeometryPlan>();
const settledPlanListeners = new Map<string, Set<() => void>>();
function subscribeToSettledPlan(key: string, listener: () => void): () => void {
  const listeners = settledPlanListeners.get(key) ?? new Set<() => void>();
  listeners.add(listener);
  settledPlanListeners.set(key, listeners);
  return () => { listeners.delete(listener); if (listeners.size === 0) settledPlanListeners.delete(key); };
}
function publishSettledPlan(key: string, plan: DiagramGeometryPlan): void {
  if (settledPlans.get(key) === plan) return;
  settledPlans.set(key, plan);
  if (settledPlans.size > 16) settledPlans.delete(settledPlans.keys().next().value!);
  geometryStore.set(plan);
  settledPlanListeners.get(key)?.forEach(listener => listener());
}

export function DiagramGeometryProvider({
  nodes,
  edges,
  children,
}: {
  nodes: Node[];
  edges: Edge[];
  children: ReactNode;
}) {
  const { direction, planKey: planStoreKey, renderStyleId, iconMode } = useCanvasView();
  const [workerPlan, setWorkerPlan] = useState<DiagramGeometryPlan | null>(null);
  const settledPlan = useSyncExternalStore(
    (listener) => subscribeToSettledPlan(planStoreKey, listener),
    () => settledPlans.get(planStoreKey) ?? null,
    () => null,
  );
  const nodeInternals = useStore((state: ReactFlowState) => state.nodeInternals);
  const measuredNodes = useMemo(() => {
    const internal = Array.from(nodeInternals.values()) as Node[];
    return internal.length ? internal : nodes;
  }, [nodeInternals, nodes]);
  const handleAnchors = useMemo(() => {
    const result = new Map<string, EdgeRouteHandleAnchors>();
    const byId = new Map(measuredNodes.map((node) => [node.id, node as Node & {
      positionAbsolute?: { x: number; y: number };
      handleBounds?: Record<string, Array<{ id?: string; x: number; y: number; width: number; height: number }>>;
    }]));
    for (const edge of edges) {
      const source = byId.get(edge.source), target = byId.get(edge.target);
      const sourceHandle = source?.handleBounds?.source?.find((handle) => handle.id === edge.sourceHandle);
      const targetHandle = target?.handleBounds?.target?.find((handle) => handle.id === edge.targetHandle);
      if (!source || !target || !sourceHandle || !targetHandle) continue;
      const sourcePosition = source.positionAbsolute ?? source.position;
      const targetPosition = target.positionAbsolute ?? target.position;
      result.set(edge.id, {
        source: { x: sourcePosition.x + sourceHandle.x + sourceHandle.width / 2, y: sourcePosition.y + sourceHandle.y + sourceHandle.height / 2 },
        target: { x: targetPosition.x + targetHandle.x + targetHandle.width / 2, y: targetPosition.y + targetHandle.y + targetHandle.height / 2 },
      });
    }
    return result;
  }, [measuredNodes, edges]);
  const isDragging = nodes.some((node) => (node as Node & { dragging?: boolean }).dragging === true);
  const options = useMemo(() => ({ direction, renderStyleId, iconMode, handleAnchors }), [direction, renderStyleId, iconMode, handleAnchors]);
  const geometryKey = useMemo(() => geometrySnapshotKey(measuredNodes, edges, options), [measuredNodes, edges, options]);
  useEffect(() => {
    if (isDragging) return;
    const currentKey = geometryKey;
    if (settledPlans.get(planStoreKey)?.key === currentKey) return;
    const timer = setTimeout(() => {
      void computeDiagramGeometryInWorker(measuredNodes, edges, options).then((next) => {
        if (next.key !== currentKey) return;
        setWorkerPlan(next);
        publishSettledPlan(planStoreKey, next);
      }).catch((error: unknown) => {
        if (error instanceof Error && error.name === 'ObsoleteGeometryRequest') return;
        // The worker may be unavailable in older browser/test hosts.
        const next = computeDiagramGeometryPlan(measuredNodes, edges, options);
        if (next.key === currentKey) { setWorkerPlan(next); publishSettledPlan(planStoreKey, next); }
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [isDragging, geometryKey, measuredNodes, edges, options, planStoreKey]);

  const plan = useMemo(() => {
    if (workerPlan?.key === geometryKey) return workerPlan;
    if (settledPlan?.key === geometryKey) return settledPlan;
    // A moving node invalidates the snapshot continuously; don't pollute the
    // settled-plan LRU with pointer-move states. Drag-stop publishes one cached
    // final snapshot once React Flow clears its dragging flag.
    if (isDragging && settledPlan) {
      return computeDiagramGeometryPreview(settledPlan, measuredNodes, edges, options);
    }
    // Let the canvas paint nodes immediately while the route plan is built in
    // a worker. Edges use their existing deterministic route fallback.
    return {
      key: geometryKey, status: 'degraded' as const, routes: new Map(), paths: new Map(), labels: new Map(),
      sourceSides: new Map(), targetSides: new Map(), bounds: new Map(), violations: [],
      quality: { hardViolations: 0, crossings: 0, weightedCrossings: 0, unexplainedPrivateOverlapLength: 0,
        criticalPathDisconnectCount: 0, bendCount: 0, totalPathLength: 0, area: 0 }, provisional: true,
    };
  }, [measuredNodes, edges, options, isDragging, settledPlan, workerPlan, geometryKey]);

  useEffect(() => { geometryStore.set(plan); }, [plan]);

  const hardIssueCount = plan.violations.filter((issue) => issue.severity === 'hard').length;
  const softIssueCount = plan.violations.filter((issue) => issue.severity === 'soft').length;
  const issueCount = hardIssueCount + softIssueCount;
  return (
    <DiagramGeometryContext.Provider value={geometryStore}>
      {children}
      {!plan.provisional && issueCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-3 left-3 z-20 max-w-xs rounded-md border border-amber-500/40 bg-background/95 px-3 py-2 text-xs text-foreground shadow-sm"
          title={plan.violations.map((issue) => issue.code).join(', ')}
        >
          {hardIssueCount > 0
            ? `${hardIssueCount} hard geometry issue${hardIssueCount === 1 ? '' : 's'} need attention. Move a node or try another layout.`
            : `${softIssueCount} route overlap${softIssueCount === 1 ? '' : 's'} may make the flow harder to follow. Try another layout.`}
        </div>
      )}
    </DiagramGeometryContext.Provider>
  );
}

export function useDiagramGeometryPlan(): DiagramGeometryPlan | null {
  const store = useContext(DiagramGeometryContext);
  return useSyncExternalStore(store.subscribeAll, () => store.plan, () => null);
}

export function useDiagramGeometryEdge(edgeId: string): EdgeGeometrySnapshot {
  const store = useContext(DiagramGeometryContext);
  return useSyncExternalStore(
    (listener) => store.subscribeEdge(edgeId, listener),
    () => store.getEdge(edgeId),
    () => emptyEdgeGeometry,
  );
}
