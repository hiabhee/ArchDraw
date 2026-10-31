'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Check, ArrowRight, Sparkles, ChevronRight, ChevronLeft, PenSquare, RotateCcw, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface CompletionCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

interface CompletionCardFlowProps {
  tutorialTitle: string;
  tutorialColor?: string;
  learnedItems: string[];
  nextTutorialTitle?: string;
  nextTutorialReason?: string;
  onRetry: () => void;
  onNext?: () => void;
  onGoToCanvas: () => void;
}

export function CompletionCardFlow({
  tutorialTitle,
  tutorialColor = '#6B7280',
  learnedItems,
  nextTutorialTitle,
  nextTutorialReason,
  onRetry,
  onNext,
  onGoToCanvas,
}: CompletionCardFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const cards: CompletionCard[] = [
    {
      id: 'trophy',
      icon: <Trophy className="w-7 h-7" />,
      title: 'You did it.',
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            You just designed <span className="text-white font-medium">{tutorialTitle.replace('How to Design ', '')}</span> from scratch. Not a copy — your own diagram, built step by step.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-slate-400">Something most engineers never actually learn</span>
          </div>
        </div>
      ),
    },
    {
      id: 'learned',
      icon: <Check className="w-7 h-7" />,
      title: 'What you now know',
      content: (
        <div className="space-y-3">
          {learnedItems.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${tutorialColor}20` }}
              >
                <Check className="w-3 h-3" style={{ color: tutorialColor }} />
              </div>
              <span className="text-sm text-slate-300 leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'facts',
      icon: <BookOpen className="w-7 h-7" />,
      title: 'Real facts you now understand',
      content: (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm leading-relaxed">
            Most engineers can describe what a system looks like. You&apos;re now one of the few who understands <em className="text-slate-300 not-italic">why</em> it works the way it does.
          </p>
          <div
            className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">The difference</p>
            <p className="text-sm text-slate-300">
              You can now explain the <span className="text-white font-medium">architectural decisions</span> — not just list the components.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'cta',
      icon: <ArrowRight className="w-7 h-7" />,
      title: nextTutorialTitle ? 'Try the next one' : 'Keep building',
      content: (
        <div className="space-y-4">
          {nextTutorialTitle && nextTutorialReason && (
            <div
              className="rounded-xl p-4"
              style={{ background: `${tutorialColor}08`, border: `1px solid ${tutorialColor}15` }}
            >
              <p className="text-sm font-medium text-white mb-1">{nextTutorialTitle}</p>
              <p className="text-xs text-slate-400">{nextTutorialReason}</p>
            </div>
          )}
          <div className="space-y-2">
            <button
              onClick={onGoToCanvas}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition duration-200 flex items-center justify-center gap-2"
              style={{ background: tutorialColor, boxShadow: `0 4px 14px ${tutorialColor}30` }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <PenSquare className="w-4 h-4" />
              Open in Canvas
            </button>
            {nextTutorialTitle && onNext && (
              <button
                onClick={onNext}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition duration-200 flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              >
                {nextTutorialTitle}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {!nextTutorialTitle && (
              <Link
                href="/tutorials"
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition duration-200 flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Browse all tutorials
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      ),
    },
  ];

  const goNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, cards.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      if (currentIndex < cards.length - 1) {
        goNext();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    }
  }, [cards.length, currentIndex, goNext, goPrev]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const card = cards[currentIndex];
  const isLastCard = currentIndex === cards.length - 1;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}
    >
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 50%, ${tutorialColor}10 0%, transparent 50%)`,
        }}
      />

      <div className="relative w-full max-w-lg mx-4">
        <div
          className="rounded-2xl p-8 transition duration-500"
          style={{
            background: 'white',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <Trophy className="w-4 h-4 text-gray-500" />
              </div>
              <span className="text-sm font-medium text-[#1A1A1A]">Tutorial Complete</span>
            </div>
            <div className="flex items-center gap-1.5">
              {cards.map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition duration-300"
                  style={{
                    background: i === currentIndex ? tutorialColor : 'rgba(0,0,0,0.1)',
                    transform: i === currentIndex ? 'scale(1.3)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="min-h-[300px] flex flex-col">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
              style={{
                background: `${tutorialColor}10`,
                border: `1px solid ${tutorialColor}20`,
              }}
            >
              <div style={{ color: tutorialColor }}>{card.icon}</div>
            </div>

            <h2
              className="text-xl font-bold text-[#1A1A1A] mb-4"
              style={{ letterSpacing: '-0.02em' }}
            >
              {card.title}
            </h2>

            <div className="flex-1">
              {card.content}
            </div>
          </div>

          {!isLastCard && (
            <div className="flex items-center justify-between mt-6 pt-6" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <div className="flex items-center gap-2">
                {currentIndex > 0 && (
                  <button
                    onClick={goPrev}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    style={{ background: 'rgba(0,0,0,0.04)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                )}
              </div>

              <button
                onClick={goNext}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: tutorialColor }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${tutorialColor}dd`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = tutorialColor; }}
              >
                {currentIndex === cards.length - 2 ? 'Finish' : 'Continue'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {isLastCard && (
            <div className="mt-6 pt-6 flex items-center justify-center" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry tutorial
              </button>
            </div>
          )}
        </div>

        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-slate-600">
          <kbd className="px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>←</kbd>
          <kbd className="px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>→</kbd>
          <span className="ml-1">to navigate</span>
        </div>
      </div>
    </div>
  );
}
