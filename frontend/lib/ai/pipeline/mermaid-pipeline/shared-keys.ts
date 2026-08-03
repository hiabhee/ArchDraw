import { sharedKey } from '@/lib/pipeline-core';
import type { ConceptDetectionOutput } from './stages/ConceptDetectionStage';
import type { ArchitecturePlan } from './stages/ArchitecturePlanningStage';

export type AiSharedData = {
  conceptDetection?: ConceptDetectionOutput;
  plan?: ArchitecturePlan;
  parseWarnings?: string[];
  useFallback?: boolean;
};

/** Typed shared-data keys for the AI Mermaid pipeline. */
export const AI_SHARED = {
  conceptDetection: sharedKey<ConceptDetectionOutput>('conceptDetection'),
  plan: sharedKey<ArchitecturePlan>('plan'),
  parseWarnings: sharedKey<string[]>('parseWarnings'),
  useFallback: sharedKey<boolean>('useFallback'),
} as const;
