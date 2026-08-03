import type {
  FileEntry,
  ExtractedNode,
  RichEdge,
  RepoProfile,
  DependencyIntelligence,
  Workflow,
} from '@/lib/types/repo-diagram';

// ~25k characters ≈ ~6k tokens — balances context coverage with LLM speed
const PROMPT_CHAR_BUDGET = 25_000;

// Architecture review runs after extraction — keep well under Groq on_demand TPM (~12k).
export const REVIEW_PROMPT_CHAR_BUDGET = 18_000;
const REVIEW_MAX_NODES = 32;
const REVIEW_MAX_EDGES = 50;
const REVIEW_MAX_DEPS = 16;

// Per-file hard cap so one giant file can't consume the entire budget
const PER_FILE_MAX_CHARS = 5_000;

// Files we want to show first because they reveal architecture best
function fileImportancePriority(path: string): number {
  const p = path.toLowerCase();
  if (/route\.(ts|js|tsx)|router\.(ts|js)|controller\.(ts|js)|api\/.+\.(ts|js)/.test(p)) return 0;
  if (/main\.py|app\.py|server\.(ts|js)|index\.(ts|js)|manage\.py|main\.go/.test(p)) return 1;
  if (/model|schema|entity|migration|prisma/.test(p)) return 2;
  if (/service|worker|task|job/.test(p)) return 3;
  if (/middleware|auth|guard/.test(p)) return 4;
  if (/package\.json|requirements\.txt|go\.mod|cargo\.toml/.test(p)) return 5;
  if (/docker-compose|dockerfile/.test(p)) return 6;
  if (/\.env|env\.example/.test(p)) return 7;
  if (/readme|\.md$|\.lock$/.test(p)) return 9; // push to end
  return 5;
}

/**
 * Format all ingested source files for LLM context within a character budget.
 * Prioritizes architecture-signal files (routes, models, services, entry points)
 * over configuration and documentation files.
 */
export function formatSourceFilesForPrompt(files: FileEntry[]): string {
  if (files.length === 0) return '(no source files ingested)';

  const prioritized = [...files].sort(
    (a, b) => fileImportancePriority(a.path) - fileImportancePriority(b.path)
  );

  let remainingBudget = PROMPT_CHAR_BUDGET;
  const chunks: string[] = [];

  for (const file of prioritized) {
    if (remainingBudget <= 0) break;
    const content =
      file.content.length > PER_FILE_MAX_CHARS
        ? `${file.content.slice(0, PER_FILE_MAX_CHARS)}\n... [truncated at ${PER_FILE_MAX_CHARS} chars]`
        : file.content;
    const block = `### ${file.path}\n${content}`;
    const blockLen = block.length;
    if (blockLen > remainingBudget) {
      // Include a partial snippet rather than skipping entirely
      const partial = block.slice(0, remainingBudget);
      chunks.push(`${partial}\n... [budget exhausted]`);
      remainingBudget = 0;
      break;
    }
    chunks.push(block);
    remainingBudget -= blockLen;
  }

  const skipped = prioritized.length - chunks.length;
  const footer = skipped > 0 ? `\n\n(${skipped} additional files omitted — budget exhausted)` : '';
  return chunks.join('\n\n') + footer;
}

export const JSON_OUTPUT_REMINDER =
  'Respond with a single JSON object only. Do not repeat or quote the source files. Do not use markdown fences.';

/** Compact node list for the architecture reviewer (drops verbose descriptions). */
export function compactNodesForReview(nodes: ExtractedNode[], max = REVIEW_MAX_NODES): unknown[] {
  return nodes.slice(0, max).map((n) => ({
    id: n.id,
    label: n.label,
    type: n.type,
    c: n.confidence,
    files: n.sourceFiles.slice(0, 2),
  }));
}

/** Compact edge list for the architecture reviewer. */
export function compactEdgesForReview(edges: RichEdge[], max = REVIEW_MAX_EDGES): unknown[] {
  return edges.slice(0, max).map((e, i) => ({
    i,
    from: e.from,
    to: e.to,
    type: e.type,
    label: e.label,
    c: e.confidence,
  }));
}

export function compactProfileForReview(profile: RepoProfile): unknown {
  return {
    repoType: profile.repoType,
    pattern: profile.architecturePattern,
    confidence: profile.confidence,
    stack: profile.primaryStack,
    domain: profile.applicationDomain || undefined,
    capabilities: profile.coreCapabilities.length > 0 ? profile.coreCapabilities : undefined,
    dirs: profile.extractionStrategy.keyDirectories.slice(0, 6),
  };
}

export function compactDepsForReview(deps: DependencyIntelligence[], max = REVIEW_MAX_DEPS): unknown[] {
  return deps.slice(0, max).map((d) => ({
    name: d.name,
    category: d.category,
    critical: d.isOnCriticalPath,
    usedIn: d.usedIn.slice(0, 1),
  }));
}

function summarizeGraphIssues(nodes: ExtractedNode[], edges: RichEdge[]): string {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.from);
    connected.add(e.to);
  }
  const orphans = nodes.filter((n) => !connected.has(n.id)).map((n) => n.id);
  const dangling = edges
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !nodeIds.has(e.from) || !nodeIds.has(e.to))
    .map(({ i, e }) => `#${i}:${e.from}->${e.to}`);

  const lines: string[] = [];
  if (orphans.length > 0) lines.push(`Orphans (${orphans.length}): ${orphans.slice(0, 12).join(', ')}`);
  if (dangling.length > 0) lines.push(`Dangling edges: ${dangling.slice(0, 8).join(', ')}`);
  return lines.length > 0 ? lines.join('\n') : 'No obvious orphan/dangling issues detected.';
}

/**
 * Build a token-efficient review prompt that fits Groq on_demand TPM limits.
 */
export function buildArchitectureReviewPrompt(
  nodes: ExtractedNode[],
  edges: RichEdge[],
  workflows: Workflow[],
  repoProfile: RepoProfile,
  dependencyMap: DependencyIntelligence[]
): string {
  const nodeSlice = nodes.length > REVIEW_MAX_NODES;
  const edgeSlice = edges.length > REVIEW_MAX_EDGES;

  const sections: string[] = [
    'Review this extracted architecture diagram. Return correction JSON only.',
    '',
    `NODES (${nodes.length}${nodeSlice ? `, showing first ${REVIEW_MAX_NODES}` : ''}):`,
    JSON.stringify(compactNodesForReview(nodes)),
    '',
    `EDGES (${edges.length}${edgeSlice ? `, showing first ${REVIEW_MAX_EDGES}` : ''}):`,
    JSON.stringify(compactEdgesForReview(edges)),
    '',
    'GRAPH ISSUES:',
    summarizeGraphIssues(nodes, edges),
  ];

  if (workflows.length > 0) {
    sections.push(
      '',
      'WORKFLOWS:',
      JSON.stringify(workflows.slice(0, 3).map((w) => ({ name: w.name, steps: w.steps.slice(0, 8) })))
    );
  }

  sections.push(
    '',
    'PROFILE:',
    JSON.stringify(compactProfileForReview(repoProfile)),
    '',
    'DEPENDENCIES:',
    JSON.stringify(compactDepsForReview(dependencyMap)),
    '',
    JSON_OUTPUT_REMINDER
  );

  let prompt = sections.join('\n');
  if (prompt.length > REVIEW_PROMPT_CHAR_BUDGET) {
    // Last resort: drop dependency detail and trim nodes further
    const tighterNodes = compactNodesForReview(nodes, 20);
    const tighterEdges = compactEdgesForReview(edges, 30);
    prompt = [
      sections[0],
      '',
      `NODES (${nodes.length}, compact):`,
      JSON.stringify(tighterNodes),
      '',
      `EDGES (${edges.length}, compact):`,
      JSON.stringify(tighterEdges),
      '',
      'GRAPH ISSUES:',
      summarizeGraphIssues(nodes, edges),
      '',
      'PROFILE:',
      JSON.stringify(compactProfileForReview(repoProfile)),
      '',
      JSON_OUTPUT_REMINDER,
    ].join('\n');
  }

  return prompt.slice(0, REVIEW_PROMPT_CHAR_BUDGET);
}

