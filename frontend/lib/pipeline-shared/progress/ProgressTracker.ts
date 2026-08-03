import type { ProgressEvent, ProgressCallback } from './ProgressEvent';
import { createProgressEvent } from './ProgressEvent';

export class ProgressTracker {
  private callbacks: Set<ProgressCallback> = new Set();
  private currentStage: string = '';
  private currentProgress: number = 0;
  private stageWeights: Map<string, number>;
  private totalWeight: number;

  constructor(stages: Array<{ name: string; weight?: number }>) {
    this.stageWeights = new Map();
    let total = 0;
    for (const stage of stages) {
      const weight = stage.weight ?? 1;
      this.stageWeights.set(stage.name, weight);
      total += weight;
    }
    this.totalWeight = total;
  }

  onProgress(callback: ProgressCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  removeCallback(callback: ProgressCallback): void {
    this.callbacks.delete(callback);
  }

  report(stage: string, progress: number, message: string): void {
    this.currentStage = stage;
    this.currentProgress = progress;

    const event = createProgressEvent(stage, progress, message, this.getStageIndex(stage), this.stageWeights.size);
    for (const cb of this.callbacks) {
      cb(event);
    }
  }

  reportStageProgress(stage: string, stageProgress: number, message: string): void {
    const weight = this.stageWeights.get(stage) ?? 1;
    const completedWeight = this.getCompletedWeight(stage);
    const stageContribution = (weight / this.totalWeight) * stageProgress;
    const overallProgress = Math.round(((completedWeight + stageContribution) / this.totalWeight) * 100);
    this.report(stage, overallProgress, message);
  }

  stageStarted(stage: string): void {
    this.report(stage, this.getCompletedWeight(stage) / this.totalWeight * 100, `Starting: ${stage}`);
  }

  stageCompleted(stage: string, message?: string): void {
    const completedWeight = this.getCompletedWeight(stage) + (this.stageWeights.get(stage) ?? 1);
    this.report(stage, Math.round((completedWeight / this.totalWeight) * 100), message ?? `Completed: ${stage}`);
  }

  stageFailed(stage: string, errorMessage?: string): void {
    this.report(stage, this.getCompletedWeight(stage) / this.totalWeight * 100, `Failed: ${stage}${errorMessage ? ` — ${errorMessage}` : ''}`);
  }

  getCurrentProgress(): number {
    return this.currentProgress;
  }

  getCurrentStage(): string {
    return this.currentStage;
  }

  private getStageIndex(stage: string): number {
    let idx = 0;
    for (const name of this.stageWeights.keys()) {
      if (name === stage) return idx;
      idx++;
    }
    return -1;
  }

  private getCompletedWeight(stage: string): number {
    let completed = 0;
    for (const [name, weight] of this.stageWeights) {
      if (name === stage) break;
      completed += weight;
    }
    return completed;
  }
}
