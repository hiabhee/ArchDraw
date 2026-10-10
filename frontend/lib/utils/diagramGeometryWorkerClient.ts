import type { Edge, Node } from 'reactflow';
import { computeDiagramGeometryPlan, type DiagramGeometryOptions, type DiagramGeometryPlan } from './diagramGeometry';

type WorkerResponse = { id: number; plan?: DiagramGeometryPlan; error?: string };
let worker: Worker | null = null;
let nextId = 1;
class ObsoleteGeometryRequest extends Error { constructor() { super('Geometry request was superseded'); this.name = 'ObsoleteGeometryRequest'; } }
const pending = new Map<number, { resolve: (plan: DiagramGeometryPlan) => void; reject: (error: Error) => void }>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./diagramGeometry.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if (event.data.plan) job.resolve(event.data.plan);
      else job.reject(new Error(event.data.error ?? 'Geometry worker failed'));
    });
    worker.addEventListener('error', () => {
      worker?.terminate(); worker = null;
      for (const job of pending.values()) job.reject(new Error('Geometry worker failed'));
      pending.clear();
    });
    return worker;
  } catch {
    worker = null;
    return null;
  }
}

export function computeDiagramGeometryInWorker(nodes: Node[], edges: Edge[], options: DiagramGeometryOptions): Promise<DiagramGeometryPlan> {
  if (pending.size) {
    for (const job of pending.values()) job.reject(new ObsoleteGeometryRequest());
    pending.clear();
    worker?.terminate(); worker = null;
  }
  const activeWorker = getWorker();
  if (!activeWorker) return Promise.resolve(computeDiagramGeometryPlan(nodes, edges, options));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try { activeWorker.postMessage({ id, nodes, edges, options }); }
    catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error('Could not send geometry to worker'));
    }
  });
}
