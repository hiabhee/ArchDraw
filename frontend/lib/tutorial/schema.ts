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
  | {
      type: 'edge_exists';
      source: string;
      target: string;
      /**
       * Component types that also count as the source / target (the types the parent
       * step and this step add). `defineTutorial` fills them in: a parent is named by
       * its title ("Mobile Client"), but the node added from search has the registry's
       * type and label (`client_mobile`, "Mobile").
       */
      sourceTypes?: string[];
      targetTypes?: string[];
    }
  | { type: 'node_count'; nodeType: string; min: number }
  | { type: 'edge_from_type'; sourceType: string; targetType: string }
  | { type: 'all_of'; rules: ValidationRule[] }
  | { type: 'any_of'; rules: ValidationRule[] };

export interface TutorialStep {
  id: string;
  title: string;
  /** The component this step adds (set by `step()`); the written guide names it. */
  component?: string;
  /** Components it connects from in the finished design (set by `step()` when it auto-connects). */
  connectsFrom?: string[];
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
  /** Funnel position for the catalog "Start here" section (1, 2, 3, …). */
  recommendedOrder?: number;
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
