import { createHash } from 'crypto';
import type { ExplainPhase } from '@/lib/tutorial/explainQuota';

export function buildExplainCacheHash(
  tutorialId: string,
  stepId: string,
  phase: ExplainPhase,
  variantIndex: number
): string {
  return createHash('sha256')
    .update(`${tutorialId}|${stepId}|${phase}|${variantIndex}`)
    .digest('hex');
}
