import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { JSON_OUTPUT_REMINDER, formatSourceFilesForPrompt } from './repo-prompt-utils';
import { buildFallbackRepoProfile } from './repo-deep-classifier';
import { REPO_LLM_MODEL, CLASSIFIER_MAX_TOKENS } from '@/lib/ai/utils/repoModels';
import logger from '@/lib/logger';
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
  // Phase 4.3: feed the classifier real source-file evidence (file tree up to 500
  // paths + key source files via formatSourceFilesForPrompt). cheap after Phase 2.
  // Prompt capped at ~36k chars (~9.5k tokens) so prompt + max_tokens stays under
  // the 12K TPM ceiling of llama-3.3-70b-versatile on the Groq free tier.
  const PROMPT_CHAR_CAP = 36_000;

  let sourceFilesBlock = formatSourceFilesForPrompt([
    ...snapshot.phase1Files,
    ...snapshot.phase2Files,
  ]);
  const summariesBlock = summaries?.length
    ? `\nSUBSYSTEM SUMMARIES:\n${summaries.join('\n\n')}\n`
    : '';

  let fileTreeOverview = snapshot.fileTree.slice(0, 500).join('\n');

  // Shrink source files (the bulkiest section) if the full prompt would exceed budget.
  const templatePrefix = `Classify this repository architecture.\n\nSTATIC DETECTION:\n${staticDetectionReport}\n\nFILE TREE OVERVIEW (first 500 paths):\n`;
  const templateSuffix = `\n\nSOURCE FILES (architectural evidence):\n\n${JSON_OUTPUT_REMINDER}\nRequired shape: ...}`;
  const fixedOverhead = templatePrefix.length + templateSuffix.length + summariesBlock.length;
  while (sourceFilesBlock.length + fileTreeOverview.length + fixedOverhead > PROMPT_CHAR_CAP) {
    if (sourceFilesBlock.length > 2000) {
      sourceFilesBlock = sourceFilesBlock.slice(0, Math.floor(sourceFilesBlock.length * 0.7)) + '\n... [truncated to fit token budget]';
    } else if (fileTreeOverview.length > 500) {
      const half = Math.floor(fileTreeOverview.length * 0.4);
      fileTreeOverview = fileTreeOverview.slice(0, half) + '\n... (truncated)\n' + fileTreeOverview.slice(-half);
    } else break;
  }

  const prompt = `Classify this repository architecture.

STATIC DETECTION:
${staticDetectionReport}

FILE TREE OVERVIEW (first 800 paths):
${fileTreeOverview}${summariesBlock}

SOURCE FILES (architectural evidence):
${sourceFilesBlock}

${JSON_OUTPUT_REMINDER}
Required shape: {
  "repoType": "documentation | static_site | library | framework | cli_tool | frontend_only | backend_only | fullstack_monolith | fullstack_separated | microservices | monorepo | mobile | data_ml | devops_config | unknown",
  "architecturePattern": "mvc | layered | clean_architecture | hexagonal | event_driven | serverless | jamstack | microservices | monolithic | pipeline | unknown",
  "primaryStack": { "framework": "string or null", "language": "string", "runtime": "string" },
  "applicationDomain": "one sentence describing the application's purpose",
  "coreCapabilities": ["5-8 specific functional capabilities based on detected technologies"],
  "primaryUserFlows": ["2-4 key user journeys based on routes and architecture"],
  "confidence": "high | medium | low",
  "reasoning": "two sentences explaining why you classified it this way",
  "extractionStrategy": { "keyDirectories": ["specific directories that contain architectural significance"], "entryPoints": ["main entry points like main.py, index.ts, app.py"], "moduleStructure": "describe the modular organization", "focusAreas": ["specific architectural patterns to focus on"] }
}

Be thorough in your analysis. Use the static detection and source files to make an informed classification. The extractionStrategy should guide component extraction to focus on the most architecturally significant parts of the codebase.`;

  logger.log(`[Classifier] Calling LLM (~${Math.ceil(prompt.length / 4)} est tokens)...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: REPO_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an expert software architect. Classify the repository based on the provided detection report, file tree, and source-file evidence.
Reply with a single JSON object only. No markdown fences. Keep it concise.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: CLASSIFIER_MAX_TOKENS,
      })
    );

    try {
      const parsed = parseLlmJson<Record<string, unknown>>(result, 'Classifier');
      return normalizeProfile(parsed);
    } catch (parseErr) {
      logger.warn('[Classifier] JSON parse failed:', parseErr instanceof Error ? parseErr.message : parseErr);
      return buildFallbackRepoProfile(snapshot);
    }
  } catch (err) {
    console.error('[Classifier] LLM call failed:', err);
    return buildFallbackRepoProfile(snapshot);
  }
}
