'use client';

import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { GenerationProgress } from '@/lib/ai/types';

interface GenerationProgressProps {
  progress: GenerationProgress | null;
  onCancel?: () => void;
}

const phaseMap: Record<string, string> = {
  'planning': 'Analyzing Requirements',
  'reasoning': 'Architectural Reasoning',
  'generating': 'Generating Components',
  'components': 'Generating Components',
  'edges': 'Creating Connections',
  'layout': 'Computing Layout',
  'validating': 'Validating Constraints',
  'scoring': 'Evaluating Quality',
  'complete': 'Complete',
  'error': 'Error'
};

const getAgentLabel = (phase: string): string => {
  return phaseMap[phase] || phase.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export function GenerationProgressDisplay({ progress, onCancel }: GenerationProgressProps) {
  if (!progress) return null;

  const getIcon = () => {
    switch (progress.phase) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-card border border-border pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-[calc(100vw-32px)]"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {getIcon()}

        <div className="flex flex-col gap-2 min-w-[280px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-foreground">
              {getAgentLabel(progress.phase)}
            </span>
            <span className="text-sm font-bold text-primary shrink-0">
              {progress.progress}%
            </span>
          </div>

          <div className="h-2 rounded-full bg-muted/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 min-w-0 flex-1">
              <span className="font-medium text-muted-foreground/80 truncate" title={progress.message}>
                {progress.message || getAgentLabel(progress.phase)}
              </span>
            </span>
            {progress.score > 0 && (
              <span className="flex items-center gap-1 shrink-0 ml-4">
                Score: <span className={progress.score >= 85 ? 'text-emerald-500' : 'text-amber-500'}>
                  {progress.score}/100
                </span>
              </span>
            )}
          </div>
        </div>

        {onCancel && progress.phase !== 'complete' && progress.phase !== 'error' && (
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            title="Cancel"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function GenerationStatusBadge({
  isGenerating,
  progress
}: {
  isGenerating: boolean;
  progress: GenerationProgress | null;
}) {
  if (!isGenerating || !progress) return null;

  return (
    <div className="fixed top-14 right-4 z-40 animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-sm border border-border/60 shadow-sm">
        <Loader2 className="w-3 h-3 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">
          Generating: {getAgentLabel(progress.phase)}
        </span>
        <span className="text-xs font-medium">
          {progress.progress}%
        </span>
      </div>
    </div>
  );
}
