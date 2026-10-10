import { performance } from 'node:perf_hooks';
import type { Edge, Node } from 'reactflow';
import { computeDiagramGeometryPlan, computeDiagramGeometryPreview } from '@/lib/diagram/geometry/diagramGeometry';
import { optimizeEdgeRoutes } from '@/lib/diagram/edges/edgeRouteOptimizer';

interface Measurement {
  optimizerMs: number;
  geometryMs: number;
  previewMs: number;
  candidateRoutes: number;
  expandedStates: number;
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? 0;
}

function fixture(size: number, dense: boolean): { nodes: Node[]; edges: Edge[] } {
  const columns = Math.ceil(Math.sqrt(size));
  const nodes = Array.from({ length: size }, (_, index) => ({
    id: `node-${String(index).padStart(3, '0')}`,
    type: 'systemNode',
    position: { x: (index % columns) * 260, y: Math.floor(index / columns) * 190 },
    width: 200,
    height: 100,
    data: { label: `Service ${index}` },
  } as Node));
  const offsets = dense ? [1, 2, columns, columns + 1] : [1, columns];
  const edges: Edge[] = [];
  for (let source = 0; source < size; source++) {
    for (const offset of offsets) {
      const target = source + offset;
      if (target >= size || (offset === 1 && Math.floor(source / columns) !== Math.floor(target / columns))) continue;
      edges.push({
        id: `edge-${String(source).padStart(3, '0')}-${String(target).padStart(3, '0')}`,
        source: nodes[source].id,
        target: nodes[target].id,
        data: { importance: offset === 1 ? 'primary' : 'supporting' },
      } as Edge);
    }
  }
  return { nodes, edges };
}

function measure(size: number, dense: boolean, runs: number): Record<string, unknown> {
  const { nodes, edges } = fixture(size, dense);
  const options = { direction: 'LR' as const };
  const movedNodes = nodes.map((node, index) => index === nodes.length - 1
    ? { ...node, position: { x: node.position.x + 16, y: node.position.y + 12 }, dragging: true } as Node
    : node);
  const heapBefore = process.memoryUsage().heapUsed;
  const measurements: Measurement[] = [];

  for (let run = 0; run < runs + 1; run++) {
    const optimizeStart = performance.now();
    const optimized = optimizeEdgeRoutes({ nodes, edges, ...options });
    const optimizerMs = performance.now() - optimizeStart;

    const geometryStart = performance.now();
    const plan = computeDiagramGeometryPlan(nodes, edges, options);
    const geometryMs = performance.now() - geometryStart;

    const previewStart = performance.now();
    computeDiagramGeometryPreview(plan, movedNodes, edges, options);
    const previewMs = performance.now() - previewStart;

    if (run > 0) measurements.push({
      optimizerMs,
      geometryMs,
      previewMs,
      candidateRoutes: optimized.stats.candidateRoutes,
      expandedStates: optimized.stats.expandedStates,
    });
  }

  const heapAfter = process.memoryUsage().heapUsed;
  return {
    nodes: size,
    edges: edges.length,
    density: dense ? 'dense' : 'sparse',
    runs,
    optimizerMs: { p50: percentile(measurements.map(row => row.optimizerMs), 0.5), p95: percentile(measurements.map(row => row.optimizerMs), 0.95) },
    geometryPlanMs: { p50: percentile(measurements.map(row => row.geometryMs), 0.5), p95: percentile(measurements.map(row => row.geometryMs), 0.95) },
    dragPreviewMs: { p50: percentile(measurements.map(row => row.previewMs), 0.5), p95: percentile(measurements.map(row => row.previewMs), 0.95) },
    routeCandidates: measurements[0]?.candidateRoutes ?? 0,
    astarExpandedStates: measurements[0]?.expandedStates ?? 0,
    heapDeltaBytes: heapAfter - heapBefore,
  };
}

const runs = Math.max(3, Number(process.env.DIAGRAM_GEOMETRY_RUNS ?? 5));
const sizes = (process.env.DIAGRAM_GEOMETRY_SIZES ?? '20,50,150')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(value => Number.isInteger(value) && value > 1);

const report = {
  generatedAt: new Date().toISOString(),
  runtime: process.version,
  platform: `${process.platform}-${process.arch}`,
  host: process.env.HOSTNAME ?? process.env.COMPUTERNAME ?? 'unknown',
  warmupRuns: 1,
  timings: 'milliseconds; p50/p95 across deterministic synthetic graph fixtures',
  results: sizes.flatMap(size => [measure(size, false, runs), measure(size, true, runs)]),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
