import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { ReactFlowEdge, ReactFlowNode } from '../types/index.js';

export interface PreviewQuality {
  status: 'ok' | 'degraded' | 'invalid' | 'failed';
  hardViolations: number;
  crossings: number;
  labelCollisions: number;
  criticalPathDisconnectCount: number;
  unexplainedPrivateOverlapLength: number;
}

interface PipelineGraph {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  direction?: 'LR' | 'RL' | 'TD' | 'BT';
  warnings?: string[];
  geometrySummary?: PreviewQuality;
}

interface DiagramPipeline {
  prepareMcpResult(nodes: ReactFlowNode[], edges: ReactFlowEdge[], direction?: 'LR' | 'TD'): Promise<{
    nodes: ReactFlowNode[];
    direction: 'LR' | 'TD';
    collisions: string[][];
  }>;
  runMcpMermaidPipeline?(mermaid: string, autoDirection: boolean): Promise<
    { success: true; data: PipelineGraph } | { success: false; warnings?: string[] }
  >;
}

const layoutModule = new URL('../ui/recover-mcp-layout.cjs', import.meta.url);
export const diagramPipeline: DiagramPipeline | undefined = existsSync(layoutModule)
  ? createRequire(import.meta.url)(fileURLToPath(layoutModule)) as DiagramPipeline
  : undefined;
