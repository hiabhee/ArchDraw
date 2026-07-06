export interface FormatConfig {
  format: 'mermaid';
  diagramType: 'graph TD' | 'graph LR' | 'erDiagram' | 'sequenceDiagram' | 'C4Context' | 'C4Container';
  optionalVariants: string[];
}

export interface StyleConfig {
  primaryColor: string;
  secondaryColor: string;
  background: string;
  backgroundColor?: string;
  fontFamily: string;
  theme: string;
  nodeTypeStyles?: Record<string, string>;
}

export interface InventoryConfig {
  nodes: string[];
  groups: string[];
  nodeCount: number;
  splitMode?: boolean;
  bidirectionalEdgeCount?: number;
}

export interface EdgeConfig {
  edges: Array<{
    from: string;
    to: string;
    label: string;
    bidirectional: boolean;
  }>;
  edgeCount: number;
}

export interface PipelineState {
  userIntent: UserIntent;
  rawNodes: unknown[];
  enrichedNodes: unknown[];
  edges: unknown[];
  reactFlowNodes: unknown[];
  graph: null;
  score: number;
  iteration: number;
  history: unknown[];
  errors: Array<{ message?: string }>;
  useAWS: boolean;
  systemIntent: Record<string, unknown>;
  pipelineDiagnostics?: PipelineDiagnostics;
}

import type { UserIntent } from '../../types';
import type { PipelineDiagnostics } from '../types';

export interface PipelineResult {
  success: boolean;
  nodes: unknown[];
  edges: unknown[];
  state: PipelineState;
  score: number;
  error?: 'generation_failed';
  diagramScore?: { grade?: string; score?: number };
  diagnostics?: PipelineDiagnostics;
  diagramType?: string;
}
