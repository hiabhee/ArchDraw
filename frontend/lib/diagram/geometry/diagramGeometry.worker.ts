import type { Edge, Node } from 'reactflow';
import { computeDiagramGeometryPlan, type DiagramGeometryOptions } from './diagramGeometry';

type Request = { id: number; nodes: Node[]; edges: Edge[]; options: DiagramGeometryOptions };
self.addEventListener('message', (event: MessageEvent<Request>) => {
  const { id, nodes, edges, options } = event.data;
  try {
    const plan = computeDiagramGeometryPlan(nodes, edges, options);
    self.postMessage({ id, plan });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Geometry calculation failed' });
  }
});
// Tells the client the module graph loaded; a worker that throws while
// importing never answers and would otherwise leave every request pending.
self.postMessage({ ready: true });
