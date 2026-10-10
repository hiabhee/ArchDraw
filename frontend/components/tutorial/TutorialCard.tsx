'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Layers,
  RotateCcw,
  Share2,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import type { TutorialDefinition } from '@/lib/tutorial/schema';
import { getTutorialProgressMeta } from '@/lib/tutorial/progress';
import { useTutorialStore } from '@/store/tutorialStore';

const ICON_LIB = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

const DIFFICULTY_META: Record<
  TutorialDefinition['difficulty'],
  { label: string; className: string; dot: string }
> = {
  beginner: {
    label: 'Beginner',
    className:
      'text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-400/10',
    dot: 'bg-emerald-500',
  },
  intermediate: {
    label: 'Intermediate',
    className:
      'text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-300 dark:bg-amber-400/10',
    dot: 'bg-amber-500',
  },
  advanced: {
    label: 'Advanced',
    className:
      'text-rose-700 bg-rose-500/10 border-rose-500/20 dark:text-rose-300 dark:bg-rose-400/10',
    dot: 'bg-rose-500',
  },
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (normalized.length !== 6) return `rgba(120,120,120,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface TutorialCardProps {
  tutorial: TutorialDefinition;
  /** Show the copy-link share action (public catalog). */
  showShare?: boolean;
}

export function TutorialCard({ tutorial, showShare = false }: TutorialCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const richProgress = useTutorialStore((s) => s.richProgress);
  const completedTutorials = useTutorialStore((s) => s.completedTutorials);
  const clearProgress = useTutorialStore((s) => s.clearProgress);

  const meta = useMemo(
    () => getTutorialProgressMeta(tutorial, richProgress, completedTutorials),
    [tutorial, richProgress, completedTutorials]
  );

  const Icon = tutorial.icon ? ICON_LIB[tutorial.icon] ?? BookOpen : BookOpen;
  const accent = tutorial.color || '#6FA8DC';
  const difficulty = DIFFICULTY_META[tutorial.difficulty] ?? DIFFICULTY_META.intermediate;
  const tags = (tutorial.tags || []).slice(0, 3);
  const totalSteps = tutorial.levels.reduce((sum, level) => sum + (level.steps?.length || 0), 0);

  function handleReset(e: React.MouseEvent) {
    e.stopPropagation();
    clearProgress(tutorial.id);
    setShowResetConfirm(false);
    toast.success('Progress reset');
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/tutorials/${tutorial.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const actionLabel =
    meta.status === 'in_progress' ? 'Resume' : meta.status === 'completed' ? 'Redo' : 'Start';

  return (
    <div
      onClick={() => router.push(`/tutorials/${tutorial.id}`)}
      className="relative group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 flex flex-col h-full bg-surface-panel border border-border-default hover:border-border-strong hover:shadow-2 hover:-translate-y-1"
      style={{
        boxShadow:
          '0 1px 2px hsl(var(--foreground) / 0.04), 0 4px 16px hsl(var(--foreground) / 0.04)',
      }}
    >
      {/* Decorative gradient header */}
      <div
        className="relative h-28 overflow-hidden shrink-0"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.04)} 70%, transparent 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-25"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 0.5px, transparent 0.5px)',
            backgroundSize: '14px 14px',
            color: hexToRgba(accent, 0.6),
          }}
        />
        <div
          className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-60"
          style={{ background: hexToRgba(accent, 0.25) }}
        />

        {/* Progress ring (in progress) */}
        {meta.status === 'in_progress' && (
          <div className="absolute top-3 left-3 w-9 h-9" title={`${meta.percent}% complete`}>
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-border-default" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke={accent} strokeWidth="2.5"
                strokeDasharray={`${meta.percent * 1.948} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-text-secondary">
              {meta.percent}%
            </span>
          </div>
        )}

        {/* Completed badge */}
        {meta.status === 'completed' && (
          <div
            className="absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center bg-emerald-500 border-2 border-white/60"
            title="Completed"
          >
            <Check className="w-4 h-4 text-white" strokeWidth={3} />
          </div>
        )}

        {/* Icon container */}
        <div className="absolute left-5 bottom-[-22px]">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center border border-border-default bg-surface-panel transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3"
            style={{
              color: accent,
              boxShadow:
                '0 4px 12px hsl(var(--foreground) / 0.08), 0 1px 2px hsl(var(--foreground) / 0.05)',
            }}
          >
            <Icon className="w-6 h-6" strokeWidth={1.75} />
          </div>
        </div>

        {/* Difficulty badge */}
        <div className="absolute top-3.5 right-3.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase border ${difficulty.className}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${difficulty.dot}`} />
            {difficulty.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-5 pt-7 pb-4">
        <h3 className="font-semibold text-[15px] leading-snug text-text-primary mb-2 line-clamp-2 group-hover:text-brand-text transition-colors">
          {tutorial.title}
        </h3>
        <p className="text-[13px] leading-relaxed text-text-muted line-clamp-2 mb-4">
          {tutorial.description}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-surface-page text-text-secondary border border-border-default/60"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-border-default/60 flex items-center justify-between text-[11.5px] text-text-muted">
          <div className="flex items-center gap-3.5">
            <span className="inline-flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" strokeWidth={1.75} />
              {totalSteps === 1 ? '1 step' : `${totalSteps} steps`}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
              {tutorial.estimatedMinutes} min
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {showShare && meta.status === 'not_started' && (
              <button
                onClick={handleShare}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-page transition-colors"
                title="Copy link"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
              </button>
            )}
            {meta.status === 'in_progress' && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowResetConfirm(true); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-red-600 hover:bg-surface-page transition-colors"
                title="Reset progress"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="inline-flex items-center gap-1 text-text-primary font-semibold opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
              {actionLabel}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </span>
          </div>
        </div>
      </div>

      {/* Accent left bar on hover */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px] origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300"
        style={{ background: accent }}
      />

      {showResetConfirm && (
        <div
          className="absolute bottom-14 right-3 z-20 flex items-center gap-1.5 p-2 rounded-lg bg-surface-panel border border-border-default shadow-3"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] text-text-muted">Reset?</span>
          <button
            onClick={handleReset}
            className="px-2 py-0.5 rounded text-[10px] font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Yes
          </button>
          <button
            onClick={() => setShowResetConfirm(false)}
            className="px-2 py-0.5 rounded text-[10px] text-text-muted hover:text-text-primary transition-colors"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
