import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { extractComponentsHeuristic } from './repo-heuristic-extractor';
import { JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import { REPO_LLM_MODEL, EXTRACTOR_MAX_TOKENS } from '@/lib/ai/utils/repoModels';
import type { RepoSnapshot, RepoProfile, ExtractedNode } from '@/lib/types/repo-diagram';
import logger from '@/lib/logger';

export type { ExtractedNode };

const KEY_FILE_BUDGET = 32000;

const ARCHITECTURAL_FILE_PATTERNS = [
  /route\.(ts|js|tsx)$/,
  /router\.(ts|js)$/,
  /controller\.(ts|js|py)$/,
  /main\.py|app\.py|server\.(ts|js)|index\.(ts|js)|manage\.py/,
  /middleware\.(ts|js|py)$/,
  /auth\.(ts|js|py)$/,
  /schema\.prisma/,
  /models?\//,
  /services?\//,
  /worker\.(ts|js|py)$/,
  /queue\.(ts|js|py)$/,
  /database\.(ts|js|py)$/,
  // ── Python / ML patterns ──
  /^train(ing)?\.(py|ipynb)$/,
  /^predict(ion)?\.(py|ipynb)$/,
  /^inference\.(py|ipynb)$/,
  /^model\.(py|ipynb)$/,
  /^eval(uate)?\.(py|ipynb)$/,
  /^dataset?\.(py|ipynb)$/,
  /^feature.*\.(py|ipynb)$/,
  /^etl|pipeline|process|transform.*\.(py|ipynb)$/,
  /^config\.(py|yml|yaml|json|toml)$/,
  /^requirements\.txt/,
  /^pyproject\.toml/,
  /^setup\.py/,
];

function pickKeyFiles(snapshot: RepoSnapshot): { path: string; content: string }[] {
  const scored: { path: string; content: string; score: number }[] = [];

  for (const file of snapshot.selectedFiles) {
    let score = 0;
    for (const pattern of ARCHITECTURAL_FILE_PATTERNS) {
      if (pattern.test(file.path)) {
        score += 1;
      }
    }
    // Prefer shorter paths (closer to root) and non-test files
    if (!file.path.includes('test') && !file.path.includes('spec')) score += 1;
    if (file.path.split('/').length <= 3) score += 1;
    if (score > 0) {
      scored.push({ ...file, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const selected: { path: string; content: string }[] = [];
  let budget = KEY_FILE_BUDGET;

  for (const file of scored) {
    if (budget <= 0) break;
    const content = file.content.length > 5000 ? file.content.slice(0, 5000) + '\n... [truncated]' : file.content;
    const cost = file.path.length + content.length + 40;
    if (cost <= budget) {
      selected.push({ path: file.path, content });
      budget -= cost;
    }
  }

  return selected;
}

function extractNodesFromParsed(parsed: Record<string, unknown>): ExtractedNode[] | null {
  const raw =
    parsed.nodes ??
    parsed.components ??
    parsed.architectural_components ??
    parsed.architecturalComponents;

  if (!Array.isArray(raw)) return null;
  return raw as ExtractedNode[];
}

function looksLikeEchoedSource(result: string): boolean {
  const trimmed = result.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('--- ') && trimmed.includes('---\n')) return true;
  if (trimmed.startsWith('### ') && !trimmed.includes('"nodes"')) return true;
  // Check if it looks like prose describing files rather than a structured JSON list
  if (!trimmed.includes('{') && !trimmed.includes('[') && (trimmed.includes('import ') || trimmed.includes('def ') || trimmed.includes('from '))) return true;
  return false;
}

function markHeuristicNodes(nodes: ExtractedNode[]): ExtractedNode[] {
  return nodes.map((n) => ({
    ...n,
    confidence: n.confidence === 'high' ? 'medium' : 'low',
    description: n.description
      ? `[Heuristic] ${n.description}`
      : '[Heuristic] Inferred from file tree — not confirmed by source code.',
  }));
}

export async function extractComponents(
  snapshot: RepoSnapshot,
  repoProfile: RepoProfile,
  staticDetectionReport: string,
  summaries?: string[]
): Promise<ExtractedNode[]> {
  const PROMPT_CHAR_CAP = 64_000;
  const fileTreeText = snapshot.fileTree.slice(0, 400).join('\n');
  let keyFiles = pickKeyFiles(snapshot);

  const summariesBlock = summaries?.length
    ? `\nSUBSYSTEM SUMMARIES:\n${summaries.join('\n\n')}\n`
    : '';

  const profileBlock = JSON.stringify({
    repoType: repoProfile.repoType,
    architecturePattern: repoProfile.architecturePattern,
    applicationDomain: repoProfile.applicationDomain,
    coreCapabilities: repoProfile.coreCapabilities,
    primaryUserFlows: repoProfile.primaryUserFlows,
  }, null, 2);

  // Truncate key files if total prompt exceeds budget
  const templatePrefix = `Identify architectural components in this repository.\n\nSTATIC DETECTION:\n${staticDetectionReport}\n\nREPO PROFILE:\n${profileBlock}\n\nFILE TREE:\n${fileTreeText}${summariesBlock}\n\n`;
  const templateSuffix = `\n\n${JSON_OUTPUT_REMINDER}\nRequired shape: ...}`;
  const fixedOverhead = templatePrefix.length + templateSuffix.length + summariesBlock.length;
  let keyFilesBlock = keyFiles.length > 0
    ? `KEY SOURCE FILES (architectural evidence):\n${keyFiles.map((f) => `### ${f.path}\n${f.content}`).join('\n\n')}`
    : '(no key source files available)';
  while (keyFilesBlock.length > 1000 && keyFilesBlock.length + fixedOverhead > PROMPT_CHAR_CAP) {
    if (keyFiles.length <= 1) break;
    keyFiles = keyFiles.slice(0, Math.ceil(keyFiles.length * 0.7));
    keyFilesBlock = `KEY SOURCE FILES (architectural evidence):\n${keyFiles.map((f) => `### ${f.path}\n${f.content}`).join('\n\n')}`;
  }

  const userPrompt = `Identify architectural components in this repository.

STATIC DETECTION:
${staticDetectionReport}

REPO PROFILE:
${profileBlock}

FILE TREE:
${fileTreeText}${summariesBlock}

${keyFilesBlock}

${JSON_OUTPUT_REMINDER}
Required shape: { "nodes": [ { "id": "snake_case_id", "label": "Human Name", "type": "PAGE|API_ROUTE|DATABASE|EXTERNAL_SERVICE|AUTH|MIDDLEWARE|UI_COMPONENT|SERVICE|CONTROLLER|WORKER|QUEUE|CACHE|STORAGE|API_GATEWAY|CDN|CORE_MODULE|INFRASTRUCTURE", "description": "one sentence", "sourceFiles": ["relative/path"], "confidence": "high|medium|low" } ] }

Be thorough and comprehensive. Extract up to 30 high-quality architectural components. Focus on:
- Group related route files into meaningful API domains (e.g., '/api/orders/*' → 'Order API')
- Identify distinct service modules by their actual responsibilities
- Extract key database entities and external integrations
- Include middleware, workers, and infrastructure components
- Use the repo profile's extractionStrategy to focus on architecturally significant areas
- Only include components that have clear evidence in the provided code or file tree
- Assign high confidence only when you see direct evidence in source files
- Be specific with component names - avoid generic names like "Service" or "Manager"`;

  logger.info(`[ComponentExtractor] Calling LLM (~${Math.ceil(userPrompt.length / 4)} est tokens, ${keyFiles.length} key files)...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: REPO_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an expert software architect. Identify architectural components from the static detection report and key source files.

The static detection already identifies framework, ORM, database, auth, queue, etc. — use that as ground truth.
Focus on identifying meaningful architectural components: services, API routes grouped by domain, pages grouped by feature, databases, auth, middleware, background workers, external integrations.

Rules:
|- Extract up to 30 nodes — quality over quantity, but be comprehensive
|- Use snake_case ids
|- Group related route files into one API route node by domain (e.g. '/api/orders/*' → 'Order API')
|- Group service modules by responsibility (e.g. 'Payment Service', 'Notification Service')
|- External services only if they represent a distinct architectural boundary
|- confidence: "high" only if seen in key source files, "medium" if from file tree, "low" if speculative
|- Never repeat source file contents
|- Only emit nodes that have evidence in the provided files or file tree — do NOT invent nodes for plausible-but-absent services
|- Use the repo profile's extractionStrategy to guide your focus
|- Be specific with component names - avoid generic names like "Service" or "Manager"
- If the codebase is large, focus on the most architecturally significant components
- Include infrastructure components like databases, caches, queues, and external services when present`,
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: EXTRACTOR_MAX_TOKENS,
      })
    );

    // Phase 6.5 — one retry on JSON-parse failure / empty result with explicit JSON reminder + 1.5× tokens.
    if (looksLikeEchoedSource(result)) {
      logger.warn('[ComponentExtractor] LLM echoed source; using heuristic fallback');
      return markHeuristicNodes(extractComponentsHeuristic(snapshot, repoProfile));
    }

    try {
      const parsed = parseLlmJson<Record<string, unknown>>(result, 'ComponentExtractor');
      const nodes = extractNodesFromParsed(parsed);
      if (nodes && nodes.length > 0) {
        return nodes;
      }
    } catch (parseErr) {
      logger.warn('[ComponentExtractor] JSON parse failed — retrying with explicit JSON reminder:',
        parseErr instanceof Error ? parseErr.message : parseErr);
      try {
        const retryResult = await apiKeyManager.executeWithRetry(async (client) =>
          groqJsonCompletion(client, {
            model: REPO_LLM_MODEL,
            messages: [
              {
                role: 'system',
                content: `You are an expert software architect. Identify architectural components from the static detection report and key source files.

The static detection already identifies framework, ORM, database, auth, queue, etc. — use that as ground truth.
Focus on identifying meaningful architectural components: services, API routes grouped by domain, pages grouped by feature, databases, auth, middleware, background workers, external integrations.

Rules:
|- Extract up to 30 nodes — quality over quantity, but be comprehensive
|- Use snake_case ids
|- Group related route files into one API route node by domain (e.g. '/api/orders/*' → 'Order API')
|- Group service modules by responsibility (e.g. 'Payment Service', 'Notification Service')
|- External services only if they represent a distinct architectural boundary
|- confidence: "high" only if seen in key source files, "medium" if from file tree, "low" if speculative
|- Never repeat source file contents
|- Only emit nodes that have evidence in the provided files or file tree — do NOT invent nodes for plausible-but-absent services
|- Use the repo profile's extractionStrategy to guide your focus
|- Be specific with component names - avoid generic names like "Service" or "Manager"
- If the codebase is large, focus on the most architecturally significant components
- Include infrastructure components like databases, caches, queues, and external services when present`,
              },
              {
                role: 'user',
                content: userPrompt + '\n\nIMPORTANT: You MUST return valid JSON with a "nodes" array. Do not return markdown code blocks or explanatory text.',
              },
            ],
            temperature: 0.1,
            max_tokens: EXTRACTOR_MAX_TOKENS,
          })
        );
        const retryParsed = parseLlmJson<Record<string, unknown>>(retryResult, 'ComponentExtractor');
        const retryNodes = extractNodesFromParsed(retryParsed);
        if (retryNodes && retryNodes.length > 0) {
          return retryNodes;
        }
      } catch (retryErr) {
        logger.warn('[ComponentExtractor] Retry also failed:', retryErr);
      }
    }

    logger.warn('[ComponentExtractor] No valid nodes extracted; using heuristic fallback');
    return markHeuristicNodes(extractComponentsHeuristic(snapshot, repoProfile));
  } catch (llmErr) {
    logger.warn('[ComponentExtractor] LLM call failed; using heuristic fallback:', llmErr);
    return markHeuristicNodes(extractComponentsHeuristic(snapshot, repoProfile));
  }
}