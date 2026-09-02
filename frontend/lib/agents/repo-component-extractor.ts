import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { extractComponentsHeuristic } from './repo-heuristic-extractor';
import { JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import { REPO_LLM_MODEL, EXTRACTOR_MAX_TOKENS, EXTRACTOR_PROMPT_CHARS } from '@/lib/ai/utils/repoModels';
import { parse as parseYaml } from 'yaml';
import { MAX_META_FILE_CONTEXT_CHARS } from '@/lib/repo-diagram/skip-rules';
import type { RepoSnapshot, RepoProfile, ExtractedNode, FileEntry } from '@/lib/types/repo-diagram';
import logger from '@/lib/logger';

export type { ExtractedNode };

const KEY_FILE_BUDGET = 60_000;

/**
 * GH2R-024 — component count scales with detail level (was hardcoded 25).
 * L3's upstream node ceiling is 150 (FinalizationStage); the extractor emits
 * up to these many curated components and the deterministic baseline merges in.
 */
const MAX_COMPONENTS_BY_LEVEL: Record<number, number> = { 1: 25, 2: 45, 3: 70 };

// Cap on the ARCHITECTURE MANIFESTS block we inject into the loader prompt.
const META_CONTEXT_BUDGET = 16_000;
const README_CONTEXT_BUDGET = 24_000;

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
    const lower = file.path.toLowerCase();
    // README first — project overview often names services/architecture
    if (/(^|\/)readme(\.[^/]+)?$/.test(lower)) {
      score += 100;
    }
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
    const isReadme = /(^|\/)readme(\.[^/]+)?$/i.test(file.path);
    const maxChars = isReadme ? 16_000 : 10_000;
    const content =
      file.content.length > maxChars
        ? file.content.slice(0, maxChars) + '\n... [truncated]'
        : file.content;
    const cost = file.path.length + content.length + 40;
    if (cost <= budget) {
      selected.push({ path: file.path, content });
      budget -= cost;
    }
  }

  return selected;
}

// ─── GH2R-024: architecture-manifest context builders ───────────────────────
// Meta files (snapshot.metaFiles) IMPLY the architecture without reading code:
// docker-compose services, package.json boundaries/scripts, terraform
// resources, CI workflows, prisma models. Summaries are compact so the full set
// fits the loader prompt even for large monorepos.

function sliceMeta(content: string, max = MAX_META_FILE_CONTEXT_CHARS): string {
  return content.length > max ? content.slice(0, max) + '\n…[truncated]' : content;
}

function summarizePackageJson(content: string): string {
  try {
    const pj = JSON.parse(content);
    const lines: string[] = [];
    if (pj.name) lines.push(`name: ${pj.name}`);
    if (pj.private === true) lines.push('private: true');
    const deps = { ...(pj.dependencies || {}), ...(pj.devDependencies || {}) };
    const depNames = Object.keys(deps);
    if (depNames.length > 0) {
      lines.push(`deps (${depNames.length}): ${depNames.slice(0, 40).join(', ')}${depNames.length > 40 ? ', …' : ''}`);
    }
    if (pj.workspaces) lines.push(`workspaces: ${JSON.stringify(pj.workspaces)}`);
    if (pj.scripts && Object.keys(pj.scripts).length > 0) lines.push(`scripts: ${Object.keys(pj.scripts).join(', ')}`);
    return lines.join('\n');
  } catch {
    return sliceMeta(content);
  }
}

function summarizeCompose(content: string): string {
  try {
    const parsed = parseYaml(content) as Record<string, unknown>;
    const services = (parsed?.services ?? {}) as Record<string, Record<string, unknown>>;
    const out: string[] = [];
    for (const [name, conf] of Object.entries(services)) {
      if (!conf || typeof conf !== 'object') continue;
      const parts: string[] = [];
      if (conf.image) parts.push(`image=${conf.image}`);
      if (conf.build) parts.push(`build=${typeof conf.build === 'string' ? conf.build : JSON.stringify(conf.build)}`);
      if (conf.ports) parts.push(`ports=${JSON.stringify(conf.ports)}`);
      if (conf.depends_on) parts.push(`depends_on=${JSON.stringify(conf.depends_on)}`);
      out.push(`- ${name}${parts.length ? ` (${parts.join(', ')})` : ''}`);
    }
    return out.length > 0 ? `services:\n${out.join('\n')}` : sliceMeta(content);
  } catch {
    return sliceMeta(content);
  }
}

function summarizeTerraform(content: string): string {
  const out: string[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*(resource|module|data|provider|variable|output|locals)\s+["']?([\w-]+)["']?\s*(?:["']([\w-]+)["'])?/);
    if (m) out.push(`${m[1]}${m[2] ? ` ${m[2]}` : ''}${m[3] ? ` ${m[3]}` : ''}`);
    if (out.length >= 60) break;
  }
  return out.length > 0 ? out.join('\n') : sliceMeta(content);
}

function summarizeWorkflow(content: string): string {
  const out: string[] = [];
  for (const line of content.split('\n')) {
    const nm = line.match(/^\s*name:\s*(.+)/);
    if (nm) { out.push(`name: ${nm[1].trim()}`); continue; }
    const jm = line.match(/^  (\w[\w-]*):\s*$/);
    if (jm) out.push(`- job: ${jm[1]}`);
    if (out.length >= 40) break;
  }
  return out.length > 0 ? out.join('\n') : sliceMeta(content);
}

function summarizePrisma(content: string): string {
  const out = (content.match(/^\s*(model|enum|datasource|generator)\s+\w+/gm) || []).slice(0, 60).join('\n');
  return out.length > 0 ? out : sliceMeta(content);
}

function summarizeManifest(content: string): string {
  return content
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .slice(0, 40)
    .join('\n');
}

/** GH2R-024 — shared manifest context builder. Exported for the docs-review
 * validator so it sees the same explicit infra/config evidence as the extractor. */
export function buildManifestContext(metaFiles: FileEntry[] = []): string {
  let used = 0;
  const blocks: string[] = [];

  for (const file of metaFiles) {
    if (used >= META_CONTEXT_BUDGET) break;
    const name = file.path.split('/').pop() ?? file.path;
    if (/^README(\.[a-z0-9]+)?$/i.test(name)) continue; // carried by readmeBlock
    if (/^(docs?|\.github)\//.test(file.path) && !/\.github\/workflows\//.test(file.path)) continue;

    let summary = '';
    if (name === 'package.json') summary = summarizePackageJson(file.content);
    else if (/^docker-compose\.ya?ml$|^compose\.ya?ml$/i.test(name)) summary = summarizeCompose(file.content);
    else if (/\.(tf|tfvars)$/.test(file.path)) summary = summarizeTerraform(file.content);
    else if (/\.github\/workflows\//.test(file.path)) summary = summarizeWorkflow(file.content);
    else if (/^(.+\/)?schema\.prisma$/.test(file.path)) summary = summarizePrisma(file.content);
    else if (/^(?:(chrome-extension|frontend|backend|server|client|web|api|apps?|packages?)\/)?(Dockerfile[^/]*)$/i.test(file.path)) summary = summarizeManifest(file.content);
    else if (/\.(ya?ml|yaml|json|toml|mod|txt|tf)$/.test(name)) summary = summarizeManifest(file.content);
    else summary = summarizeManifest(file.content);

    if (!summary) continue;
    summary = sliceMeta(summary);
    const block = `### ${file.path}\n${summary}`;
    if (used + block.length > META_CONTEXT_BUDGET && blocks.length > 0) break;
    blocks.push(block);
    used += block.length;
  }

  return blocks.length > 0
    ? `ARCHITECTURE MANIFESTS (explicit architecture evidence — docker-compose services = SERVICE nodes, terraform = INFRASTRUCTURE, CI jobs = pipeline steps, package.json = service boundaries):\n${blocks.join('\n\n')}\n`
    : '';
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

const GENERIC_BARE_LABELS = new Set(['service', 'manager', 'helper', 'handler', 'controller', 'api', 'util', 'client', 'worker', 'service ', 'manager ', 'handler ', 'util ']);
function filterGenericAndDupNodes(nodes: ExtractedNode[]): ExtractedNode[] {
  const seen = new Set<string>();
  const out: ExtractedNode[] = [];
  for (const n of nodes) {
    const labelLower = n.label.trim().toLowerCase();
    if (GENERIC_BARE_LABELS.has(labelLower)) {
      logger.warn(`[ComponentExtractor] dropping generic bare label: "${n.label}"`);
      continue;
    }
    // also drop labels that are 1 word and that word is generic stem (e.g. "Worker" alone is generic, but "Payment Worker" is ok)
    if (labelLower.split(/\s+/).length === 1 && GENERIC_BARE_LABELS.has(labelLower)) continue;
    const key = labelLower;
    if (seen.has(key)) {
      logger.warn(`[ComponentExtractor] dropping duplicate label: "${n.label}"`);
      continue;
    }
    seen.add(key);
    out.push(n);
  }
  return out;
}

export async function extractComponents(
  snapshot: RepoSnapshot,
  repoProfile: RepoProfile,
  staticDetectionReport: string,
  summaries?: string[],
  opts?: { detailLevel?: 1 | 2 | 3 }
): Promise<ExtractedNode[]> {
  const detail = opts?.detailLevel ?? 2;
  const maxComponents = MAX_COMPONENTS_BY_LEVEL[detail] ?? 45;

  // Budget sized for gpt-oss-120b's context window (the old 28k cap was sized
  // for the retired llama-3.3-70b 12K TPM ceiling and starved the extractor).
  const PROMPT_CHAR_CAP = EXTRACTOR_PROMPT_CHARS;
  const fileTreeText = snapshot.fileTree.slice(0, 1000).join('\n');
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

  // README as primary context — derived from phase 1.5 metaFiles (many READMEs,
  // bounded total) or legacy selectedFiles. Never drop, bounded to fit the prompt.
  const readmeSource = snapshot.metaFiles?.length ? snapshot.metaFiles : snapshot.selectedFiles;
  const readmeFiles = readmeSource.filter((f) => /^(.+\/)?README(\.[a-z0-9]+)?$/i.test(f.path));
  let readmeBlock = '';
  if (readmeFiles.length > 0) {
    let readmeUsed = 0;
    const readmeParts: string[] = [];
    for (const f of readmeFiles) {
      const part = `### ${f.path}\n${f.content.slice(0, 8000)}`;
      if (readmeParts.length > 0 && readmeUsed + part.length > README_CONTEXT_BUDGET) break;
      readmeParts.push(part);
      readmeUsed += part.length;
    }
    readmeBlock = `README CONTEXT (primary — derive domain, features, and component names from this):\n${readmeParts.join('\n\n')}\n`;
  }

  // GH2R-024: manifest context from phase 1.5 metaFiles (docker-compose,
  // terraform, CI, package.json, prisma) — explicit architecture evidence.
  const manifestBlock = buildManifestContext(snapshot.metaFiles);

  // Truncate key files if total prompt exceeds budget
  const templatePrefix = `Identify architectural components in this repository.\n\n${readmeBlock}${manifestBlock}STATIC DETECTION:\n${staticDetectionReport}\n\nREPO PROFILE:\n${profileBlock}\n\nFILE TREE:\n${fileTreeText}${summariesBlock}\n\n`;
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

${readmeBlock}${manifestBlock}STATIC DETECTION:
${staticDetectionReport}

REPO PROFILE:
${profileBlock}

FILE TREE:
${fileTreeText}${summariesBlock}

${keyFilesBlock}

${JSON_OUTPUT_REMINDER}
Required shape: { "nodes": [ { "id": "snake_case_id", "label": "Human Name", "type": "PAGE|API_ROUTE|DATABASE|EXTERNAL_SERVICE|AUTH|MIDDLEWARE|UI_COMPONENT|SERVICE|CONTROLLER|WORKER|QUEUE|CACHE|STORAGE|API_GATEWAY|CDN|CORE_MODULE|INFRASTRUCTURE", "description": "one sentence", "sourceFiles": ["relative/path"], "confidence": "high|medium|low" } ] }

 Be thorough and comprehensive. Extract up to ${maxComponents} high-quality architectural components. Focus on:
- README is ground truth for naming — use product/feature nouns from README (e.g. if README says "Expense Tracker", prefer "Expense Service", "Receipt Parser", not "Generic Service")
- ARCHITECTURE MANIFESTS are explicit evidence: every docker-compose service → a SERVICE node, terraform resources → INFRASTRUCTURE nodes, github workflow jobs → pipeline/CI nodes, package.json workspaces → distinct service boundaries
- Group related route files into meaningful API domains (e.g., '/api/orders/*' → 'Order API' — never emit 3 separate "Order Service"/"Order Handler"/"Order Manager" for same domain)
- Identify distinct service modules by their actual responsibilities — each label must be UNIQUE (no duplicates like "User Service" twice with different ids)
- Extract key database entities and external integrations — only if imported/used in source evidence
- Include middleware, workers, and infrastructure components when present
- Use the repo profile's extractionStrategy to focus on architecturally significant areas
- Only include components that have clear evidence in the provided code or file tree
- Assign high confidence only when you see direct evidence in source files
- Be specific with component names — NEVER emit generic standalone names: "Service", "Manager", "Helper", "Handler", "Controller", "API", "Util", "Worker", "Client" — always qualify (e.g. "Payment Worker", not "Worker")
- Do NOT repeat the same concept: if two nodes share >80% of sourceFiles or label stems, merge them into one`;

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
|- README is primary for domain — name components after README features, not inferred generic patterns
|- ARCHITECTURE MANIFESTS are explicit evidence — each docker-compose service → a SERVICE node, terraform resource → INFRASTRUCTURE, CI workflow job → pipeline node, package.json workspace → distinct service boundary
|- Extract up to ${maxComponents} UNIQUE nodes — no duplicate labels (case-insensitive) or same sourceFiles overlap >50%; if duplicate, merge
|- Use snake_case ids derived from the UNIQUE label (e.g. "Expense Service" → expense_service)
|- Group related route files into one API route node by domain (e.g. '/api/orders/*' → 'Order API' — never 2 nodes for same domain)
|- Group service modules by responsibility (e.g. 'Payment Service', 'Notification Service') — each must have distinct responsibility
|- External services only if they represent a distinct architectural boundary AND are imported/used in source
|- confidence: "high" only if seen in key source files, "medium" if from file tree, "low" if speculative
|- Never repeat source file contents
|- Only emit nodes that have evidence in the provided files or file tree — do NOT invent nodes for plausible-but-absent services
|- Use the repo profile's extractionStrategy to guide your focus
|- NEVER emit bare generic names: "Service", "Manager", "Helper", "Handler", "Controller", "API", "Util", "Client", "Worker" — always qualified with domain noun from README (e.g. "Receipt Worker")
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
        const cleaned = filterGenericAndDupNodes(nodes);
        if (cleaned.length > 0) return cleaned;
        logger.warn('[ComponentExtractor] all nodes were generic/dup — treating as parse failure to retry');
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
|- README is primary for domain — name components after README features, not inferred generic patterns
|- ARCHITECTURE MANIFESTS are explicit evidence — each docker-compose service → a SERVICE node, terraform resource → INFRASTRUCTURE, CI workflow job → pipeline node, package.json workspace → distinct service boundary
|- Extract up to ${maxComponents} UNIQUE nodes — no duplicate labels (case-insensitive) or same sourceFiles overlap >50%; if duplicate, merge
|- Use snake_case ids derived from the UNIQUE label (e.g. "Expense Service" → expense_service)
|- Group related route files into one API route node by domain (e.g. '/api/orders/*' → 'Order API' — never 2 nodes for same domain)
|- Group service modules by responsibility (e.g. 'Payment Service', 'Notification Service') — each must have distinct responsibility
|- External services only if they represent a distinct architectural boundary AND are imported/used in source
|- confidence: "high" only if seen in key source files, "medium" if from file tree, "low" if speculative
|- Never repeat source file contents
|- Only emit nodes that have evidence in the provided files or file tree — do NOT invent nodes for plausible-but-absent services
|- Use the repo profile's extractionStrategy to guide your focus
|- NEVER emit bare generic names: "Service", "Manager", "Helper", "Handler", "Controller", "API", "Util", "Client", "Worker" — always qualified with domain noun from README (e.g. "Receipt Worker")
- If the codebase is large, focus on the most architecturally significant components
- Include infrastructure components like databases, caches, queues, and external services when present`,
              },
              {
                role: 'user',
                content: userPrompt + '\n\nIMPORTANT: You MUST return valid JSON with a "nodes" array. Do not return markdown code blocks or explanatory text.',
              },
            ],
            temperature: 0.1,
            max_tokens: Math.round(EXTRACTOR_MAX_TOKENS * 1.5),
          })
        );
        const retryParsed = parseLlmJson<Record<string, unknown>>(retryResult, 'ComponentExtractor');
        const retryNodes = extractNodesFromParsed(retryParsed);
        if (retryNodes && retryNodes.length > 0) {
          const cleanedRetry = filterGenericAndDupNodes(retryNodes);
          if (cleanedRetry.length > 0) return cleanedRetry;
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