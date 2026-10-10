import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { JSON_OUTPUT_REMINDER, formatSourceFilesForPrompt, formatSubsystemSummariesForPrompt } from './repo-prompt-utils';
import { buildFallbackRepoProfile } from './repo-deep-classifier';
import { REPO_LLM_MODEL, CLASSIFIER_MAX_TOKENS, CLASSIFIER_PROMPT_CHARS, REPO_LLM_REQUEST_OPTIONS } from '@/lib/ai/utils/repoModels';
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

export function buildClassifierPrompt(
  snapshot: RepoSnapshot,
  staticDetectionReport: string,
  summaries?: string[],
  promptCharCap = CLASSIFIER_PROMPT_CHARS,
): string {
  // Keep a reserve for the detailed JSON schema/instructions below. The compact
  // `templateSuffix` is only used for sizing and is intentionally not repeated.
  const contentBudget = Math.max(1_000, promptCharCap - 4_000);
  // Feed the classifier real source-file evidence (file tree + key source files
  // via formatSourceFilesForPrompt). Budget sized for gpt-oss-120b's context window.
  // README is primary domain context, but it must share the same hard budget as
  // every other prompt section. Previously it was omitted from `fixedOverhead`,
  // allowing large READMEs to turn a nominally capped request into an HTTP 413.
  const readmeFiles = [...snapshot.phase1Files, ...snapshot.phase2Files]
    .filter((f) => /README\.md$/i.test(f.path));
  let readmeBlock = readmeFiles.length
    ? `README CONTEXT (primary — use to infer purpose, features, and domain workflows):\n${readmeFiles.map((f) => `### ${f.path}\n${f.content.slice(0, 15000)}`).join('\n\n')}\n`
    : '';

  let sourceFilesBlock = formatSourceFilesForPrompt([
    ...snapshot.phase1Files,
    ...snapshot.phase2Files,
  ]);
  const summaryContext = formatSubsystemSummariesForPrompt(summaries, Math.floor(contentBudget * 0.25));
  const summariesBlock = summaryContext
    ? `\nSUBSYSTEM SUMMARIES:\n${summaryContext}\n`
    : '';

  let fileTreeOverview = snapshot.fileTree.slice(0, 1500).join('\n');

  // Shrink source files (the bulkiest section) if the full prompt would exceed budget.
  const templatePrefix = `Classify this repository architecture.\n\n${readmeBlock}STATIC DETECTION:\n${staticDetectionReport}\n\nFILE TREE OVERVIEW (first 1500 paths):\n`;
  const templateSuffix = `\n\nSOURCE FILES (architectural evidence):\n\n${JSON_OUTPUT_REMINDER}\nRequired shape: ...}`;
  let fixedOverhead = templatePrefix.length + templateSuffix.length + summariesBlock.length;
  while (sourceFilesBlock.length + fileTreeOverview.length + fixedOverhead > contentBudget) {
    if (sourceFilesBlock.length > 2000) {
      sourceFilesBlock = sourceFilesBlock.slice(0, Math.floor(sourceFilesBlock.length * 0.7)) + '\n... [truncated to fit token budget]';
    } else if (fileTreeOverview.length > 500) {
      const half = Math.floor(fileTreeOverview.length * 0.4);
      fileTreeOverview = fileTreeOverview.slice(0, half) + '\n... (truncated)\n' + fileTreeOverview.slice(-half);
    } else if (readmeBlock.length > 1000) {
      readmeBlock = readmeBlock.slice(0, Math.max(1000, Math.floor(readmeBlock.length * 0.7))) + '\n... [README truncated to fit token budget]';
      fixedOverhead = (`Classify this repository architecture.\n\n${readmeBlock}STATIC DETECTION:\n${staticDetectionReport}\n\nFILE TREE OVERVIEW (first 1500 paths):\n`).length + templateSuffix.length + summariesBlock.length;
    } else {
      break;
    }
  }

  return `Classify this repository architecture.

${readmeBlock}STATIC DETECTION:
${staticDetectionReport}

FILE TREE OVERVIEW (first 1500 paths):
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
}

export async function classifyRepository(
  snapshot: RepoSnapshot,
  staticDetectionReport: string,
  summaries?: string[],
  signal?: AbortSignal,
): Promise<RepoProfile> {
  const prompt = buildClassifierPrompt(snapshot, staticDetectionReport, summaries);

  logger.log(`[Classifier] Calling LLM (~${Math.ceil(prompt.length / 4)} est tokens)...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client, requestSignal) =>
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
        signal: requestSignal,
      }), { ...REPO_LLM_REQUEST_OPTIONS, signal }
    );

    try {
      const parsed = parseLlmJson<Record<string, unknown>>(result, 'Classifier');
      return normalizeProfile(parsed);
    } catch (parseErr) {
      logger.warn('[Classifier] JSON parse failed:', parseErr instanceof Error ? parseErr.message : parseErr);
      return buildFallbackRepoProfile(snapshot);
    }
  } catch (err) {
    logger.error('[Classifier] LLM call failed:', err);
    return buildFallbackRepoProfile(snapshot);
  }
}
