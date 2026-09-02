/**
 * GH2R-024 — Docs revalidation pass.
 *
 * After deterministic VerifyStage cleanup, re-check the extracted graph AGAINST
 * the repository's own documentation (READMEs + docs from phase 1.5 metaFiles).
 * The docs are the authoritative naming/flow source: the reviewer adds components
 * the docs explicitly describe, removes doc-empty hallucinations, merges/renames
 * doc-mismatched nodes, and adds edges for doc-described flows.
 *
 * Returns the dormant ReviewResult shape, applied via `applyReviewCorrections`
 * in `DocsReviewStage`. Pure-best-effort: any failure yields an `approved` result
 * with no corrections so the pipeline never fails on this pass.
 */
import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import { buildManifestContext } from './repo-component-extractor';
import { REPO_LLM_MODEL, DOCS_MAX_TOKENS, DOCS_PROMPT_CHARS } from '@/lib/ai/utils/repoModels';
import { MAX_META_FILE_CONTEXT_CHARS } from '@/lib/repo-diagram/skip-rules';
import type { ExtractedNode, RichEdge, Workflow, ReviewResult, ReviewCorrection, FileEntry } from '@/lib/types/repo-diagram';
import logger from '@/lib/logger';

export type DocsValidationInput = {
  nodes: ExtractedNode[];
  edges: RichEdge[];
  workflows: Workflow[];
  metaFiles: FileEntry[];
  fileTree: string[];
  detailLevel?: 1 | 2 | 3;
};

// READMEs get the biggest share; docs/*.md next; manifests are compact summaries.
const README_DOCS_BUDGET = 16_000;
const DOCS_DOCS_BUDGET = 12_000;

function sliceDoc(content: string, max = MAX_META_FILE_CONTEXT_CHARS): string {
  return content.length > max ? content.slice(0, max) + '\n…[truncated]' : content;
}

/** READMEs + documentation markdown from phase 1.5 metaFiles, bounded. */
export function buildDocsContext(metaFiles: FileEntry[] = []): string {
  const readmes = metaFiles.filter((f) => /^(.+\/)?README(\.[a-z0-9]+)?$/i.test(f.path));
  const docFiles = metaFiles.filter(
    (f) => !/^(.+\/)?README(\.[a-z0-9]+)?$/i.test(f.path) && /\.md$/i.test(f.path)
  );
  // Root architecture docs first (ARCHITECTURE.md / README-adjacent), then docs/.
  const docsSorted = [...docFiles].sort((a, b) => {
    const scoreA = /^(.+\/)?(architecture|overview|design|system)[^/]*\.md$/i.test(a.path) ? 0 : /^docs?\//.test(a.path) ? 1 : 2;
    const scoreB = /^(.+\/)?(architecture|overview|design|system)[^/]*\.md$/i.test(b.path) ? 0 : /^docs?\//.test(b.path) ? 1 : 2;
    return scoreA - scoreB;
  });

  const blocks: string[] = [];
  let readmeUsed = 0;
  let docUsed = 0;

  for (const f of readmes) {
    const part = `### ${f.path}\n${sliceDoc(f.content)}`;
    if (blocks.length > 0 && readmeUsed + part.length > README_DOCS_BUDGET) break;
    blocks.push(part);
    readmeUsed += part.length;
  }
  for (const f of docsSorted) {
    const part = `### ${f.path}\n${sliceDoc(f.content)}`;
    if (blocks.length > 0 && docUsed + part.length > DOCS_DOCS_BUDGET) break;
    blocks.push(part);
    docUsed += part.length;
  }

  return blocks.length > 0
    ? `DOCUMENTATION (authoritative — use for naming and flows):\n${blocks.join('\n\n')}\n`
    : '';
}

function emptyCorrections(): ReviewCorrection {
  return {
    addNodes: [],
    removeNodeIds: [],
    mergeNodes: [],
    addEdges: [],
    removeEdgeIndexes: [],
    updateEdges: [],
    workflowCorrections: [],
  };
}

function buildPrompt(input: DocsValidationInput): string {
  const docsBlock = buildDocsContext(input.metaFiles);
  const manifestBlock = buildManifestContext(input.metaFiles);
  const treeSlice = input.fileTree.slice(0, 400);

  const nodeLines = input.nodes.map((n) =>
    `- id "${n.id}" | label "${n.label}" | type ${n.type} | confidence ${n.confidence} | sources: [${n.sourceFiles.slice(0, 4).join(', ')}]`
  ).join('\n');

  const edgeLines = input.edges
    .slice(0, 400)
    .map((e) =>
      `- ${e.from} -> ${e.to} | label "${e.label}" | type ${e.type} | confidence ${e.confidence}`
    )
    .join('\n');

  return `Re-check this automatically extracted architecture diagram against the repository's documentation.

${docsBlock}
${manifestBlock}FILE TREE (for grounding ids to real paths; new nodes must reference paths present here):
${treeSlice || '(empty tree)'}

CURRENT EXTRACTED NODES (${input.nodes.length}):
${nodeLines || '(none)'}

CURRENT EDGES (${input.edges.length}):
${edgeLines || '(none)'}

TASK: Confirm the diagram tells the same story as the documentation. The docs are ground truth for NAMING and FLOWS.

Apply ONLY corrections with explicit documentary evidence:
- ADD nodes for components the docs explicitly name/describe (services, databases, caches, queues, gateways, clients, workers) that are missing from the diagram. Set sourceFiles to the README/docs/manifest path that names them, and confidence by how explicitly the docs describe them (high = dedicated section, medium = listed once).
- REMOVE nodes that are likely hallucinations: the docs and file tree never reference them AND confidence is low or medium. Never remove a node that other edges reference.
- MERGE two nodes the docs treat as one component (mergeNodes: keepId + removeId + newLabel).
- RENAME a node when the docs use a clearly different canonical name (mergeNodes with keepId === removeId and newLabel set).
- ADD edges for flows the docs describe explicitly (e.g. "client → gateway → service → database", "api → queue → worker").
- CORRECT edges the docs contradict (updateEdges with index + changes), e.g. wrong direction or missing label.
- Do NOT invent components the docs never reference. Prefer small, high-precision corrections over broad rewrites.
- Proposed node ids must be snake_case and derived from the label (e.g. "Billing Service" → billing_service).
- If no corrections are required, set "approved": true with empty corrections.

${JSON_OUTPUT_REMINDER}
Required shape: { "approved": true, "corrections": { "addNodes": [ { "id": "snake_case_id", "label": "Human Name", "type": "SERVICE|DATABASE|CACHE|QUEUE|API_GATEWAY|EXTERNAL_SERVICE|WORKER|CDN|AUTH|INFRASTRUCTURE|PAGE|API_ROUTE|CONTROLLER|MIDDLEWARE|STORAGE|UI_COMPONENT", "description": "one sentence", "sourceFiles": ["relative/path"], "confidence": "high|medium|low" } ], "removeNodeIds": ["id"], "mergeNodes": [ { "keepId": "a", "removeId": "b", "newLabel": "Merged Name" } ], "addEdges": [ { "from": "a", "to": "b", "type": "HTTP|DB_QUERY|QUEUE|EVENT|FILE|CALL|ASYNC", "label": "short label", "direction": "sync|async|event", "protocol": "", "dataFlow": "", "triggeredBy": "", "description": "one sentence", "confidence": "high|medium|low" } ], "removeEdgeIndexes": [0], "updateEdges": [ { "index": 0, "changes": { "label": "new label" } } ], "workflowCorrections": [] }, "reviewNotes": "1-2 sentences summarizing what was checked and corrected" }
}`;
}

function normalizeResult(parsed: Record<string, unknown>): ReviewResult {
  const corrections = (parsed.corrections ?? {}) as Partial<ReviewCorrection>;
  return {
    approved: parsed.approved !== false,
    corrections: {
      addNodes: Array.isArray(corrections.addNodes) ? corrections.addNodes as ExtractedNode[] : [],
      removeNodeIds: Array.isArray(corrections.removeNodeIds) ? corrections.removeNodeIds as string[] : [],
      mergeNodes: Array.isArray(corrections.mergeNodes) ? corrections.mergeNodes as ReviewCorrection['mergeNodes'] : [],
      addEdges: Array.isArray(corrections.addEdges) ? corrections.addEdges as RichEdge[] : [],
      removeEdgeIndexes: Array.isArray(corrections.removeEdgeIndexes) ? corrections.removeEdgeIndexes as number[] : [],
      updateEdges: Array.isArray(corrections.updateEdges) ? corrections.updateEdges as ReviewCorrection['updateEdges'] : [],
      workflowCorrections: Array.isArray(corrections.workflowCorrections) ? corrections.workflowCorrections as string[] : [],
    },
    reviewNotes: typeof parsed.reviewNotes === 'string' ? parsed.reviewNotes : '',
  };
}

const APPROVED_EMPTY: ReviewResult = { approved: true, corrections: emptyCorrections(), reviewNotes: '' };

export async function validateAgainstDocs(input: DocsValidationInput): Promise<ReviewResult> {
  if (!input.metaFiles || input.metaFiles.length === 0) {
    logger.log('[DocsValidator] No meta files — skipping docs revalidation');
    return APPROVED_EMPTY;
  }

  const hasDocs = input.metaFiles.some(
    (f) => /^(.+\/)?README(\.[a-z0-9]+)?$/i.test(f.path) || /\.md$/i.test(f.path)
  );
  if (!hasDocs) {
    logger.log('[DocsValidator] No README/docs in meta files — nothing to validate against');
    return APPROVED_EMPTY;
  }

  // Budget for the whole user prompt (~4 chars ≈ 1 token).
  const userPrompt = buildPrompt(input);
  let prompt = userPrompt;
  if (prompt.length > DOCS_PROMPT_CHARS) {
    prompt = userPrompt.slice(0, DOCS_PROMPT_CHARS) + '\n…[context truncated]';
  }
  const system = `You are a meticulous architecture reviewer. You are given an automatically extracted architecture diagram and a repository's own documentation (README + docs + manifest summaries). Verify the diagram matches the documentation and emit MINIMAL corrections only where the docs provide explicit evidence. Respond with a single JSON object.`;

  logger.info(`[DocsValidator] Calling LLM (~${Math.ceil(prompt.length / 4)} est tokens, ${input.nodes.length} nodes, ${input.edges.length} edges)...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: REPO_LLM_MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: DOCS_MAX_TOKENS,
      })
    );

    try {
      const parsed = parseLlmJson<Record<string, unknown>>(result, 'DocsValidator');
      return normalizeResult(parsed);
    } catch (parseErr) {
      logger.warn('[DocsValidator] JSON parse failed — retrying with explicit JSON reminder:', parseErr);
      const retryResult = await apiKeyManager.executeWithRetry(async (client) =>
        groqJsonCompletion(client, {
          model: REPO_LLM_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt + '\n\nIMPORTANT: You MUST return valid JSON. No markdown fences, no commentary before/after.' },
          ],
          temperature: 0.1,
          max_tokens: Math.round(DOCS_MAX_TOKENS * 1.5),
        })
      );
      const retryParsed = parseLlmJson<Record<string, unknown>>(retryResult, 'DocsValidator');
      return normalizeResult(retryParsed);
    }
  } catch (llmErr) {
    logger.warn('[DocsValidator] LLM call failed — keeping verified graph as-is:', llmErr);
    return APPROVED_EMPTY;
  }
}