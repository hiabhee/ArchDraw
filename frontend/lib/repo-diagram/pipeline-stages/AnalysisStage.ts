import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { detectSubsystems } from '@/lib/repo-diagram/subsystem-detector';
import { extractStaticSignals } from '@/lib/repo-diagram/static-analyzer';
import { buildEvidenceGraph } from '@/lib/repo-diagram/evidence-from-graph';
import type { RepoSnapshot, Subsystem, StaticSignal } from '@/lib/types/repo-diagram';
import type { ImportGraph } from '@/lib/repo-diagram/import-graph';
import type { IngestionOutput } from './IngestionStage';
import logger from '@/lib/logger';

export interface AnalysisOutput {
  snapshot: RepoSnapshot;
  subsystems: Subsystem[];
  signals: StaticSignal[];
  importGraph: ImportGraph;
}

export class AnalysisStage extends BaseStage<IngestionOutput, AnalysisOutput> {
  constructor() {
    super('analysis', { description: 'Detect subsystems, extract signals, build import graph', weight: 3 });
  }

  async execute(input: IngestionOutput, context: PipelineContext): Promise<StageResult<AnalysisOutput>> {
    const snapshot = input.snapshot;

    context.onProgress?.('detecting_subsystems', 20, 'Detecting subsystems...');
    const subsystems = detectSubsystems(snapshot);
    logger.info(`  Found ${subsystems.length} subsystems`);

    context.onProgress?.('extracting_signals', 35, 'Extracting static signals...');
    const signals = extractStaticSignals(snapshot.selectedFiles, subsystems);
    logger.info(`  Extracted ${signals.length} signals (${new Set(signals.map(s => s.type)).size} types)`);

    const importGraph: ImportGraph = buildEvidenceGraph(snapshot.selectedFiles, snapshot.fileTree);
    logger.info(`  Import graph: ${importGraph.edges.size} importer files, ${importGraph.external.size} external refs`);

    return successResult({ snapshot, subsystems, signals, importGraph });
  }
}
