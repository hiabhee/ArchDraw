import type { Node, Edge } from 'reactflow';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type PhaseName = 'context' | 'intro' | 'teaching' | 'action' | 'connecting' | 'celebration';

export interface PhaseContent {
  heading: string;
  body: string;
  highlightNodeIds?: string[];
  /**
   * "Without this component, X breaks." — shown as a callout in teaching phase.
   * Answers: why does this component exist?
   */
  whyItMatters?: string;
  /**
   * The key architectural tradeoff or decision point for this component.
   * e.g. "Redis gives O(1) reads but loses data on restart without AOF."
   */
  tradeoff?: string;
}

export type ValidationRule =
  | { type: 'node_exists'; nodeType: string; label?: string }
  | { type: 'edge_exists'; source: string; target: string }
  | { type: 'node_count'; nodeType: string; min: number }
  | { type: 'edge_from_type'; sourceType: string; targetType: string }
  | { type: 'all_of'; rules: ValidationRule[] }
  | { type: 'any_of'; rules: ValidationRule[] };

export interface TutorialStep {
  id: string;
  title: string;
  phases: {
    context: PhaseContent;
    intro: PhaseContent;
    teaching: PhaseContent;
    action: PhaseContent;
    connecting: PhaseContent;
    celebration: PhaseContent;
  };
  validation: ValidationRule[];
  hints: string[];
  continueAfterMs?: number;
  /**
   * Phases to skip automatically. The engine will advance past these
   * without user interaction.
   * Example: ['connecting'] for noConnect steps.
   */
  skipPhases?: PhaseName[];
}

export interface TutorialLevel {
  id: string;
  title: string;
  description?: string;
  steps: TutorialStep[];
}

export interface TutorialDefinition {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  levels: TutorialLevel[];
  tags?: string[];
  icon?: string;
  color?: string;
  category?: string;
}

export interface TutorialSession {
  tutorialId: string;
  levelIndex: number;
  stepIndex: number;
  phase: PhaseName;
  completedStepIds: string[];
  completedLevelIds: string[];
  canvasSnapshot: { nodes: Node[]; edges: Edge[] };
  startedAt: number;
  lastActivityAt: number;
}

export interface ValidationResult {
  passed: boolean;
  unmetRules: ValidationRule[];
}

export function createDefaultPhaseContent(heading: string, body: string): PhaseContent {
  return { heading, body };
}

export const PHASE_ORDER: PhaseName[] = ['context', 'intro', 'teaching', 'action', 'connecting', 'celebration'];

export function getNextPhase(current: PhaseName): PhaseName | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx === PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}
