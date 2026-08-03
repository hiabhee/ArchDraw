import { sharedKey } from '@/lib/pipeline-core';

export type MermaidSharedData = {
  parseWarnings?: string[];
  layoutMetadata?: {
    direction: 'TB' | 'BT' | 'LR' | 'RL';
    compound: boolean;
  };
};

/** Typed shared-data keys for the Mermaid pipeline. */
export const MERMAID_SHARED = {
  parseWarnings: sharedKey<string[]>('parseWarnings'),
  layoutMetadata: sharedKey<MermaidSharedData['layoutMetadata']>('layoutMetadata'),
} as const;
