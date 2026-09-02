import type { ExtractedNode, RichEdge, StaticSignal, Subsystem, DependencyIntelligence, RepoSnapshot, RepoProfile, FileEntry } from '@/lib/types/repo-diagram';
import { summarizeSubsystem } from '@/lib/repo-diagram/subsystem-detector';
import { fetchFileContentsByPaths } from '@/lib/github-ingestion';
import logger from '@/lib/logger';

export function normalizeId(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64) || 'node';
}

function confidenceRankForMerge(c: string | undefined): number {
  if (c === 'high') return 3;
  if (c === 'medium') return 2;
  return 1;
}

function normalizeLabelKey(label: string): string {
  // GH2R-016: avoid collapsing generic names like "API"/"Service" to "" which causes collisions
  const stripped = label.toLowerCase().replace(/\s*\([^)]*\)/g, '');
  const withoutGeneric = stripped.replace(/\b(api|service|database|db|cache|worker|module)\b/g, '').trim();
  const alnum = withoutGeneric.replace(/[^a-z0-9]/g, '').trim();
  if (!alnum) return label.toLowerCase().replace(/[^a-z0-9]/g, '').trim() || normalizeId(label);
  return alnum;
}

export function mergeLlmIntoBaseline(
  baseline: ExtractedNode[],
  llmNodes: ExtractedNode[]
): ExtractedNode[] {
  if (llmNodes.length === 0) return baseline;

  const merged = new Map<string, ExtractedNode>();

  for (const llm of llmNodes) {
    const id = normalizeId(llm.id);
    const isGenericExternalDesc = llm.type === 'EXTERNAL_SERVICE' &&
      /^(external\s+service\s+integration|external\s+service)$/i.test(llm.description?.trim() || '');
    if (isGenericExternalDesc) continue;
    if (merged.has(id)) {
      const existing = merged.get(id)!;
      logger.warn(`[mergeLlmIntoBaseline] normalizeId collision: "${existing.id}" from "${existing.label}" and "${llm.label}" — skipping duplicate`);
      existing.sourceFiles = [...new Set([...existing.sourceFiles, ...llm.sourceFiles])];
      if (confidenceRankForMerge(llm.confidence) > confidenceRankForMerge(existing.confidence)) {
        existing.label = llm.label;
        existing.description = llm.description;
      }
      continue;
    }
    merged.set(id, { ...llm, id });
  }

  const llmSourceFiles = new Set(llmNodes.flatMap(n => n.sourceFiles));
  const llmNormLabels = new Map(llmNodes.map(n => [normalizeLabelKey(n.label), n]));

  for (const base of baseline) {
    const baseId = normalizeId(base.id);
    const existing = merged.get(baseId);
    if (existing) {
      existing.sourceFiles = [...new Set([...existing.sourceFiles, ...base.sourceFiles])];
      if (confidenceRankForMerge(base.confidence) > confidenceRankForMerge(existing.confidence)) {
        existing.label = base.label;
        existing.description = base.description;
      }
      continue;
    }

    const baseNormKey = normalizeLabelKey(base.label);
    const overlapsSource = base.sourceFiles.some(sf => llmSourceFiles.has(sf));
    const overlapsLabel = baseNormKey && llmNormLabels.has(baseNormKey);

    if (overlapsSource || overlapsLabel) {
      const llmNode = overlapsLabel
        ? llmNormLabels.get(baseNormKey)
        : [...merged.values()].find(n => n.sourceFiles.some(sf => base.sourceFiles.includes(sf)));
      if (llmNode) {
        const llmId = normalizeId(llmNode.id);
        const mergedNode = { ...llmNode, id: llmId };
        mergedNode.sourceFiles = [...new Set([...mergedNode.sourceFiles, ...base.sourceFiles])];
        if (confidenceRankForMerge(base.confidence) > confidenceRankForMerge(llmNode.confidence)) {
          mergedNode.label = base.label;
          mergedNode.description = base.description;
        }
        if (confidenceRankForMerge(llmNode.confidence) >= confidenceRankForMerge(base.confidence)) {
          mergedNode.type = llmNode.type;
        }
        merged.set(llmId, mergedNode);
      }
      continue;
    }

    merged.set(baseId, { ...base, id: baseId });
  }

  return Array.from(merged.values());
}

export function buildDependencyIntelligence(signals: StaticSignal[]): DependencyIntelligence[] {
  const depSignals = signals.filter(s => s.type === 'dependency');
  const seen = new Set<string>();
  const deps: DependencyIntelligence[] = [];

  for (const s of depSignals) {
    const category = (s.details.category as string) || 'unknown';
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    deps.push({
      name: s.label,
      category,
      purpose: `${s.label} — ${category}`,
      usedIn: [s.source],
      usagePattern: 'declared',
      architecturalRole: category === 'database' ? 'data_persistence'
        : category === 'queue' ? 'async_messaging'
        : category === 'auth' ? 'authentication'
        : category === 'payments' ? 'payments'
        : category === 'email' ? 'notification'
        : category === 'ai_ml' ? 'ai_ml'
        : 'supporting_infrastructure',
      externalEndpoint: null,
      isOnCriticalPath: ['database', 'queue', 'auth'].includes(category),
    });
  }

  return deps;
}

export function buildSummariesForLLM(subsystems: Subsystem[], signals: StaticSignal[]): string[] {
  return subsystems.map(sub => {
    const subSignals = signals.filter(s =>
      sub.path === '/' ? !subsystems.some(other => other.path !== '/' && s.source.startsWith(other.path)) : s.source.startsWith(sub.path)
    );
    return summarizeSubsystem(sub, subSignals.map(s => ({
      type: s.type,
      label: s.label,
      source: s.source,
      category: s.details.category as string | undefined,
      confidence: s.confidence,
    })));
  });
}

export async function gatherPass2Files(snapshot: RepoSnapshot, profile: RepoProfile, cap: number): Promise<FileEntry[]> {
  const selected = new Set(snapshot.selectedFiles.map(f => f.path));
  const candidates: string[] = [];
  const allPaths = [
    ...(profile.extractionStrategy.keyDirectories ?? []),
    ...(profile.extractionStrategy.entryPoints ?? []),
  ];
  if (allPaths.length === 0) return [];

  for (const path of snapshot.fileTree) {
    if (candidates.length >= cap) break;
    if (selected.has(path)) continue;
    if (allPaths.some(p => path.startsWith(p) || path === p)) {
      if (/(__tests__|\.test\.|\.spec\.)/.test(path)) continue;
      candidates.push(path);
    }
  }

  const map = snapshot.archiveMap;
  if (map) {
    return candidates.flatMap(path => {
      const content = map.get(path);
      return content == null ? [] : [{ path, content }];
    });
  }

  // Contents-API fallback: classification-guided pass-2 used to no-op here,
  // silently degrading every non-tarball run. Fetch the candidates directly
  // (bounded by `cap`). Uses env GITHUB_TOKEN — private repos authorized only
  // by a per-request user token degrade to today's behavior for these files.
  const fetched = await fetchFileContentsByPaths(snapshot.owner, snapshot.repo, candidates);
  if (fetched.length < candidates.length) {
    logger.warn(`[gatherPass2Files] Contents-API fallback fetched ${fetched.length}/${candidates.length} pass-2 file(s)`);
  }
  return fetched;
}
