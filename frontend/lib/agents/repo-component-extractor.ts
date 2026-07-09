import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { extractComponentsHeuristic } from './repo-heuristic-extractor';
import { JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import type { RepoSnapshot, RepoProfile, ExtractedNode } from '@/lib/types/repo-diagram';

export type { ExtractedNode };

const KEY_FILE_BUDGET = 8000;

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
    const content = file.content.length > 3000 ? file.content.slice(0, 3000) + '\n... [truncated]' : file.content;
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

export async function extractComponents(
  snapshot: RepoSnapshot,
  repoProfile: RepoProfile,
  staticDetectionReport: string,
  summaries?: string[]
): Promise<ExtractedNode[]> {
  const fileTreeText = snapshot.fileTree.slice(0, 200).join('\n');
  const keyFiles = pickKeyFiles(snapshot);

  const keyFilesBlock = keyFiles.length > 0
    ? `KEY SOURCE FILES (architectural evidence):\n${keyFiles.map((f) => `### ${f.path}\n${f.content}`).join('\n\n')}`
    : '(no key source files available)';

  const summariesBlock = summaries?.length
    ? `\nSUBSYSTEM SUMMARIES:\n${summaries.join('\n\n')}\n`
    : '';

  const userPrompt = `Identify architectural components in this repository.

STATIC DETECTION:
${staticDetectionReport}

REPO PROFILE:
${JSON.stringify({
    repoType: repoProfile.repoType,
    architecturePattern: repoProfile.architecturePattern,
    applicationDomain: repoProfile.applicationDomain,
    coreCapabilities: repoProfile.coreCapabilities,
    primaryUserFlows: repoProfile.primaryUserFlows,
  }, null, 2)}

FILE TREE:
${fileTreeText}${summariesBlock}

${keyFilesBlock}

${JSON_OUTPUT_REMINDER}
Required shape: { "nodes": [ { "id": "snake_case_id", "label": "Human Name", "type": "PAGE|API_ROUTE|DATABASE|EXTERNAL_SERVICE|AUTH|MIDDLEWARE|UI_COMPONENT|SERVICE|CONTROLLER|WORKER|QUEUE|CACHE|STORAGE|API_GATEWAY|CDN|CORE_MODULE|INFRASTRUCTURE", "description": "one sentence", "sourceFiles": ["relative/path"], "confidence": "high|medium|low" } ] }`;

  console.log(`[ComponentExtractor] Calling LLM (~${Math.ceil(userPrompt.length / 4)} est tokens, ${keyFiles.length} key files)...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert software architect. Identify architectural components from the static detection report and key source files.

The static detection already identifies framework, ORM, database, auth, queue, etc. — use that as ground truth.
Focus on identifying meaningful architectural components: services, API routes grouped by domain, pages grouped by feature, databases, auth, middleware, background workers, external integrations.

Rules:
- Extract up to 20 nodes — quality over quantity
- Use snake_case ids
- Group related route files into one API route node by domain (e.g. '/api/orders/*' → 'Order API')
- Group service modules by responsibility (e.g. 'Payment Service', 'Notification Service')
- External services only if they represent a distinct architectural boundary
- confidence: "high" if seen in key source files, "medium" if from file tree, "low" if speculative
- Never repeat source file contents`,
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      })
    );

    if (looksLikeEchoedSource(result)) {
      console.warn('[ComponentExtractor] LLM echoed source; using heuristic fallback');
      return extractComponentsHeuristic(snapshot, repoProfile);
    }

    try {
      const parsed = parseLlmJson<Record<string, unknown>>(result, 'ComponentExtractor');
      const nodes = extractNodesFromParsed(parsed);
      if (nodes && nodes.length > 0) {
        return nodes;
      }
    } catch (parseErr) {
      console.warn('[ComponentExtractor] JSON parse failed:', parseErr instanceof Error ? parseErr.message : parseErr);
    }

    console.warn('[ComponentExtractor] No valid nodes; using heuristic fallback');
    return extractComponentsHeuristic(snapshot, repoProfile);
  } catch (err) {
    console.error('[ComponentExtractor] LLM call failed:', err);
    const heuristic = extractComponentsHeuristic(snapshot, repoProfile);
    if (heuristic.length > 0) {
      return heuristic;
    }
    throw new Error(`Failed to extract components: ${err instanceof Error ? err.message : String(err)}`);
  }
}
