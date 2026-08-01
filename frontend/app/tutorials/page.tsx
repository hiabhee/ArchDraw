'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import {
  ArrowLeft, Clock, Layers, Brain, Image, BarChart2, Video, ArrowRight,
  CheckCircle, Share2, Check, Car, MessageCircle, Twitter, CreditCard,
  Github, Link as LinkIcon, Bot, FileText, Home, Music, Linkedin,
  ShoppingBag, Bike, RotateCcw, X, Sparkles, Zap, BookOpen,
  Camera, Users, Play, BarChart, ShoppingCart,
} from 'lucide-react';
import { TUTORIALS, isLiveTutorial } from '@/data/tutorials';
import { useTutorialStore } from '@/store/tutorialStore';
import type { TutorialDefinition } from '@/lib/tutorial/schema';
import { toast } from 'sonner';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Brain, Image, BarChart2, Video,
  Car, MessageCircle, Twitter, CreditCard,
  Github, Link: LinkIcon, Bot, FileText, Home, Music, Linkedin,
  ShoppingBag, Bike, Camera, Users, Play, BarChart, ShoppingCart,
};

const DIFFICULTY_CONFIG = {
  beginner: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Beginner' },
  intermediate: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Intermediate' },
  advanced: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Advanced' },
};

function getTutorialMeta(tutorial: TutorialDefinition): { nodeCount: number; stepCount: number } {
  const levels = tutorial.levels ?? [];
  const stepCount = levels.reduce((acc, l) => acc + l.steps.length, 0);
  const nodeCount = levels.reduce((acc, l) =>
    acc + l.steps.reduce((sAcc, s) => {
      const nodeRules = s.validation.filter((r) => r.type === 'node_exists' || r.type === 'node_count');
      return sAcc + nodeRules.length;
    }, 0), 0);
  return { nodeCount, stepCount };
}

function TutorialCard({ tutorial }: { tutorial: TutorialDefinition }) {
  const router = useRouter();
  const { tutorialProgress, completedTutorials, clearProgress } = useTutorialStore();
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const progress = tutorialProgress[tutorial.id] ?? 0;
  const { nodeCount, stepCount } = getTutorialMeta(tutorial);
  const isCompleted = completedTutorials.includes(tutorial.id);
  const isInProgress = progress > 0 && !isCompleted;
  const diffConfig = DIFFICULTY_CONFIG[tutorial.difficulty] ?? DIFFICULTY_CONFIG.intermediate;
  const IconComp = tutorial.icon ? ICON_MAP[tutorial.icon] : undefined;
  const completionPercent = stepCount > 0 ? Math.round((progress / stepCount) * 100) : 0;

  const richProgress = useTutorialStore((s) => s.richProgress);
  const savedProgress = richProgress[tutorial.id];
  const hasRichProgress = savedProgress && (savedProgress.currentStep > 0 || savedProgress.currentLevel > 1);

  const accuratePercent = useMemo(() => {
    if (savedProgress && tutorial.levels) {
      const totalSteps = tutorial.levels.reduce((acc, l) => acc + l.steps.length, 0);
      const currentOverallStep = (savedProgress.currentLevel - 1) * (tutorial.levels[0]?.steps.length ?? 0) + savedProgress.currentStep;
      return totalSteps > 0 ? Math.round((currentOverallStep / totalSteps) * 100) : 0;
    }
    return completionPercent;
  }, [completionPercent, savedProgress, tutorial]);

  function handleReset(e: React.MouseEvent) {
    e.stopPropagation();
    clearProgress(tutorial.id);
    setShowResetConfirm(false);
    toast.success('Progress reset');
  }

  const estimatedTime = `${tutorial.estimatedMinutes} mins`;

  return (
    <div
      className="relative group cursor-pointer border border-border-default rounded-xl bg-surface-panel hover:bg-surface-page/80 transition-all duration-200 hover:shadow-2"
      onClick={() => router.push(`/tutorials/${tutorial.id}`)}
    >
      {(isInProgress || hasRichProgress) && (
        <div
          className="absolute top-3 right-3 z-10 w-10 h-10"
        >
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" className="stroke-border-default" strokeWidth="2.5" />
            <circle cx="18" cy="18" r="16" fill="none" stroke="#595959" strokeWidth="2.5" strokeDasharray={`${accuratePercent * 2.01} 100`} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-text-secondary">
            {accuratePercent}%
          </span>
        </div>
      )}

      <div className="p-5 flex flex-col h-full">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-surface-page border border-border-default">
            {IconComp && <IconComp className="w-4 h-4 text-text-secondary" />}
          </div>
          <div className="min-w-0 flex-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${diffConfig.bg} ${diffConfig.color} ${diffConfig.border} border`}>
              {diffConfig.label}
            </span>
            {tutorial.category && (
              <p className="text-[11px] text-text-muted mt-0.5">{tutorial.category}</p>
            )}
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text-primary mb-1.5 leading-snug">
            {tutorial.title}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
            {tutorial.description}
          </p>
        </div>

        {tutorial.tags && tutorial.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 mb-3">
            {tutorial.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-surface-page text-text-muted border border-border-default">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] text-text-muted mb-3 pt-3 border-t border-border-default/60">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {estimatedTime}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {nodeCount} nodes
          </span>
          <span>{stepCount} steps</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/tutorials/${tutorial.id}`}
            className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 bg-surface-page border border-border-default text-text-primary hover:bg-border-default/20 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {isInProgress ? 'Resume' : isCompleted ? 'Redo' : 'Start'}
            <ArrowRight className="w-3 h-3" />
          </Link>

          {isCompleted ? (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-50 border border-green-200">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          ) : (isInProgress || hasRichProgress) ? (
            <button
              onClick={(e) => { e.stopPropagation(); setShowResetConfirm(true); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-page border border-border-default text-text-muted hover:text-red-600 hover:border-red-200 transition-colors"
              title="Reset progress"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const url = `${window.location.origin}/tutorials/${tutorial.id}`;
                navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-page border border-border-default text-text-muted hover:text-text-primary transition-colors"
              title="Copy link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {showResetConfirm && (
            <div className="absolute bottom-16 right-4 z-20 flex items-center gap-1.5 p-2 rounded-lg bg-surface-panel border border-border-default shadow-3">
              <span className="text-[10px] text-text-muted">Reset?</span>
              <button
                onClick={handleReset}
                className="px-2 py-0.5 rounded text-[10px] font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowResetConfirm(false); }}
                className="px-2 py-0.5 rounded text-[10px] text-text-muted hover:text-text-primary transition-colors"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TutorialsPage() {
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const clearAllProgress = useTutorialStore((s) => s.clearAllProgress);
  const completedCount = useTutorialStore((s) => s.completedTutorials.length);
  const totalCount = TUTORIALS.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function handleResetAll() {
    clearAllProgress();
    setShowResetAllConfirm(false);
    toast.success('All tutorial progress has been reset');
  }

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface-page/80 backdrop-blur-md border-b border-border-default">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div className="w-px h-4 bg-border-default" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-surface-panel border border-border-default">
                <BookOpen className="w-3.5 h-3.5 text-text-secondary" />
              </div>
              <span className="text-sm font-semibold">Tutorials</span>
            </div>
          </div>
          {completedCount > 0 && (
            <button
              onClick={() => setShowResetAllConfirm(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-red-600 border border-border-default hover:border-red-200 bg-surface-panel transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset all progress
            </button>
          )}
        </div>
      </header>

      {/* Reset all confirmation dialog */}
      {showResetAllConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-modal/60"
          onClick={(e) => { if (e.target === e.currentTarget) setShowResetAllConfirm(false); }}
        >
          <div className="w-full max-w-sm rounded-xl bg-surface-panel border border-border-default p-5 shadow-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Reset all progress?</h2>
              <button onClick={() => setShowResetAllConfirm(false)} className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed mb-5">
              This will permanently delete your progress across every tutorial. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetAllConfirm(false)}
                className="flex-1 py-2 rounded-lg text-xs font-medium bg-surface-page border border-border-default text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAll}
                className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 pt-10 pb-20">
        {/* Hero section */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-panel border border-border-default text-text-muted mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
            {totalCount} tutorials available
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-3 tracking-tight">
            Learn System Design
          </h1>
          <p className="text-sm text-text-secondary max-w-lg leading-relaxed">
            Build real architectures step by step. From messaging apps to AI agents — each tutorial teaches you how production systems work by guiding you to design them yourself.
          </p>
        </div>

        {/* Progress bar */}
        {completedCount > 0 && (
          <div className="mb-8 p-4 rounded-xl bg-surface-panel border border-border-default">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-page border border-border-default">
                  <CheckCircle className="w-4 h-4 text-text-secondary" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-text-primary">Your Progress</div>
                  <div className="text-[11px] text-text-muted">{completedCount} of {totalCount} tutorials completed</div>
                </div>
              </div>
              <div className="text-lg font-bold text-text-secondary">{completionPercent}%</div>
            </div>
            <div className="h-1.5 rounded-full bg-border-default overflow-hidden">
              <div className="h-full rounded-full bg-text-muted transition-all duration-700" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
        )}

        {/* Tutorial grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {TUTORIALS.map((tutorial) => (
            <TutorialCard key={tutorial.id} tutorial={tutorial} />
          ))}
        </div>
      </main>
    </div>
  );
}
