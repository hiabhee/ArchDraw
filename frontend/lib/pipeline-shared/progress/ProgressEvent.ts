export interface ProgressEvent {
  stage: string;
  progress: number;
  message: string;
  totalStages?: number;
  currentStage?: number;
  timestamp: number;
}

export type ProgressCallback = (event: ProgressEvent) => void;

export function createProgressEvent(
  stage: string,
  progress: number,
  message: string,
  currentStage?: number,
  totalStages?: number
): ProgressEvent {
  return {
    stage,
    progress: Math.max(0, Math.min(100, progress)),
    message,
    currentStage,
    totalStages,
    timestamp: Date.now(),
  };
}
