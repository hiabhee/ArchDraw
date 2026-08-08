'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle, RotateCcw, X } from 'lucide-react';
import { TUTORIALS } from '@/data/tutorials';
import { useTutorialStore } from '@/store/tutorialStore';
import { TutorialCatalog } from '@/components/tutorial/TutorialCatalog';
import { toast } from 'sonner';

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

        <TutorialCatalog tutorials={TUTORIALS} showShare />
      </main>
    </div>
  );
}
