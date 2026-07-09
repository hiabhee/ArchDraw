import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import { buildFallbackRepoProfile } from './repo-deep-classifier';
import type { RepoSnapshot, RepoProfile, RepoType, ArchitecturePattern } from '@/lib/types/repo-diagram';

function normalizeProfile(parsed: Record<string, unknown>): RepoProfile {
  const primaryStack = (parsed.primaryStack as Record<string, unknown>) || {};
  const extractionStrategy = (parsed.extractionStrategy as Record<string, unknown>) || {};

  return {
    repoType: (parsed.repoType as RepoType) || 'unknown',
    architecturePattern: (parsed.architecturePattern as ArchitecturePattern) || 'unknown',
    primaryStack: {
      framework: (primaryStack.framework as string | null) ?? null,
      language: (primaryStack.language as string) || 'unknown',
      runtime: (primaryStack.runtime as string) || 'unknown',
    },
    applicationDomain: (parsed.applicationDomain as string) || '',
    coreCapabilities: Array.isArray(parsed.coreCapabilities) ? (parsed.coreCapabilities as string[]) : [],
    primaryUserFlows: Array.isArray(parsed.primaryUserFlows) ? (parsed.primaryUserFlows as string[]) : [],
    confidence: (parsed.confidence as RepoProfile['confidence']) || 'medium',
    reasoning: (parsed.reasoning as string) || 'Classified from repository analysis.',
    extractionStrategy: {
      keyDirectories: Array.isArray(extractionStrategy.keyDirectories) ? (extractionStrategy.keyDirectories as string[]) : [],
      entryPoints: Array.isArray(extractionStrategy.entryPoints) ? (extractionStrategy.entryPoints as string[]) : [],
      moduleStructure: (extractionStrategy.moduleStructure as string) || '',
      focusAreas: Array.isArray(extractionStrategy.focusAreas) ? (extractionStrategy.focusAreas as string[]) : [],
    },
  };
}

export async function classifyRepository(
  snapshot: RepoSnapshot,
  staticDetectionReport: string,
  summaries?: string[]
): Promise<RepoProfile> {
  const fileTreeOverview = snapshot.fileTree.slice(0, 100).join('\n');
  const summariesBlock = summaries?.length
    ? `\nSUBSYSTEM SUMMARIES:\n${summaries.join('\n\n')}\n`
    : '';

  const prompt = `Classify this repository architecture.

STATIC DETECTION:
${staticDetectionReport}

FILE TREE OVERVIEW (first 100 paths):
${fileTreeOverview}${summariesBlock}

${JSON_OUTPUT_REMINDER}
Required shape: {
  "repoType": "documentation | static_site | library | framework | cli_tool | frontend_only | backend_only | fullstack_monolith | fullstack_separated | microservices | monorepo | mobile | data_ml | devops_config | unknown",
  "architecturePattern": "mvc | layered | clean_architecture | hexagonal | event_driven | serverless | jamstack | microservices | monolithic | pipeline | unknown",
  "primaryStack": { "framework": "string or null", "language": "string", "runtime": "string" },
  "applicationDomain": "one sentence describing the application's purpose",
  "coreCapabilities": ["3-6 functional capabilities"],
  "primaryUserFlows": ["1-3 key user journeys"],
  "confidence": "high | medium | low",
  "reasoning": "two sentences explaining why you classified it this way",
  "extractionStrategy": { "keyDirectories": [], "entryPoints": [], "moduleStructure": "string", "focusAreas": [] }
}`;

  console.log(`[Classifier] Calling LLM (~${Math.ceil(prompt.length / 4)} est tokens)...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert software architect. Classify the repository based on the provided detection report and file tree.
Reply with a single JSON object only. No markdown fences. Keep it concise.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      })
    );

    try {
      const parsed = parseLlmJson<Record<string, unknown>>(result, 'Classifier');
      return normalizeProfile(parsed);
    } catch (parseErr) {
      console.warn('[Classifier] JSON parse failed:', parseErr instanceof Error ? parseErr.message : parseErr);
      return buildFallbackRepoProfile(snapshot);
    }
  } catch (err) {
    console.error('[Classifier] LLM call failed:', err);
    return buildFallbackRepoProfile(snapshot);
  }
}
