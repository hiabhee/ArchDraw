import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { extractComponentsHeuristic } from './repo-heuristic-extractor';
import { formatSourceFilesForPrompt, JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import type { RepoSnapshot, RepoProfile, DependencyMap, ExtractedNode } from '@/lib/types/repo-diagram';

export type { ExtractedNode };

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
  if (!trimmed.includes('{') && (trimmed.includes('import ') || trimmed.includes('def '))) return true;
  return false;
}

export async function extractComponents(
  snapshot: RepoSnapshot,
  repoProfile?: RepoProfile,
  dependencyMap?: DependencyMap,
  summaries?: string[]
): Promise<ExtractedNode[]> {
  const fileTreeText = snapshot.fileTree.slice(0, 200).join('\n');
  const sourceFilesBlock = formatSourceFilesForPrompt(snapshot.selectedFiles);

  const profileText = repoProfile ? JSON.stringify(repoProfile, null, 2) : '';
  const depMapText = dependencyMap ? JSON.stringify(dependencyMap, null, 2) : '';

  const contextBlock = summaries && summaries.length > 0
    ? `SUBSYSTEM SUMMARIES:\n${summaries.join('\n\n')}`
    : `SOURCE FILES (reference only — do not copy into your answer):\n${sourceFilesBlock}`;

  const userPrompt = `Analyze this repository and list architectural components as JSON.

FILE TREE (first 200 paths):
${fileTreeText}

REPO META:
${JSON.stringify(snapshot.repoMeta)}

${repoProfile ? `REPO PROFILE:\n${profileText}\n` : ''}${dependencyMap ? `DEPENDENCY MAP:\n${depMapText}\n` : ''}
${contextBlock}

${JSON_OUTPUT_REMINDER}
Required shape: { "nodes": [ { "id", "label", "type", "description", "sourceFiles", "confidence" } ] }`;

  console.log(`[ComponentExtractor] Calling LLM to extract components...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert software architect. Extract architectural components from repositories.

Return ONLY a JSON object with a "nodes" array. Never repeat source file contents.

NODE TYPES: PAGE, API_ROUTE, DATABASE, EXTERNAL_SERVICE, AUTH, MIDDLEWARE, UI_COMPONENT, SERVICE, CONTROLLER, WORKER, QUEUE, CACHE, STORAGE, API_GATEWAY, CDN, STATE_MANAGEMENT, DOCUMENTATION_SECTION, CORE_MODULE, PLUGIN_SYSTEM, INFRASTRUCTURE, UNKNOWN

Rules: max 20 nodes, snake_case ids, only components evidenced in the snapshot, no duplicates.`,
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 6000,
      })
    );

    if (looksLikeEchoedSource(result)) {
      console.warn('[ComponentExtractor] LLM echoed source instead of JSON; using heuristic fallback');
      return extractComponentsHeuristic(snapshot, repoProfile);
    }

    try {
      const parsed = parseLlmJson<Record<string, unknown>>(result, 'ComponentExtractor');
      const nodes = extractNodesFromParsed(parsed);
      if (nodes && nodes.length > 0) {
        return nodes;
      }
    } catch (parseErr) {
      console.warn(
        '[ComponentExtractor] JSON parse failed:',
        parseErr instanceof Error ? parseErr.message : parseErr
      );
    }

    console.warn('[ComponentExtractor] No nodes in LLM response; using heuristic fallback');
    return extractComponentsHeuristic(snapshot, repoProfile);
  } catch (err) {
    console.error('[ComponentExtractor] LLM call failed:', err);
    const heuristic = extractComponentsHeuristic(snapshot, repoProfile);
    if (heuristic.length > 0) {
      console.log(`[ComponentExtractor] Heuristic fallback produced ${heuristic.length} nodes`);
      return heuristic;
    }
    throw new Error(
      `Failed to extract components from repository: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
