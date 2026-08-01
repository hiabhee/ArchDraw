'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Zap, BookOpen, Target, Lightbulb, Play } from 'lucide-react';
import { analytics } from '@/lib/analytics';
import { STORAGE_KEYS } from '@/lib/config';

interface IntroCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
}

interface IntroCardFlowProps {
  tutorialTitle: string;
  tutorialDescription: string;
  levelTitle?: string;
  levelDescription?: string;
  stepCount: number;
  estimatedTime: string;
  componentCount: number;
  onStart: () => void;
  onSkip?: () => void;
  tutorialColor?: string;
}

const MAX_INTRO_SHOWS = 2;

function getIntroShownCount(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(STORAGE_KEYS.introCount) ?? '0', 10);
}

function incrementIntroShownCount(): void {
  if (typeof window === 'undefined') return;
  const count = getIntroShownCount();
  localStorage.setItem(STORAGE_KEYS.introCount, String(count + 1));
}

export function IntroCardFlow({
  tutorialTitle,
  tutorialDescription,
  levelTitle,
  levelDescription,
  stepCount,
  estimatedTime,
  componentCount,
  onStart,
  onSkip,
  tutorialColor = '#6B7280',
}: IntroCardFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Lazy initializer: reads localStorage once on first mount (SSR-safe via the guard
  // inside getIntroShownCount). Avoids calling setState synchronously in an effect.
  const [showCount] = useState<number>(() => {
    const count = getIntroShownCount();
    if (count < MAX_INTRO_SHOWS) incrementIntroShownCount();
    return count;
  });

  // Only side-effect: skip the intro flow when the count threshold is already met.
  // No setState in this effect — reads stable `showCount` from above.
  useEffect(() => {
    if (showCount >= MAX_INTRO_SHOWS) onSkip?.();
  }, [showCount, onSkip]);

  const canShow = showCount < MAX_INTRO_SHOWS;

  const cards: IntroCard[] = [
    {
      id: 'hook',
      icon: <Target className="w-6 h-6" />,
      title: `What you're about to build`,
      description: `You're going to design ${tutorialTitle.replace('How to Design ', '')} from scratch. Not just copy a diagram — build it yourself, component by component.`,
      highlight: `${componentCount} components · ${stepCount} steps`,
    },
    {
      id: 'why',
      icon: <Lightbulb className="w-6 h-6" />,
      title: 'Why this matters',
      description: levelDescription || tutorialDescription,
      highlight: levelTitle || 'System Architecture',
    },
    {
      id: 'outcome',
      icon: <Zap className="w-6 h-6" />,
      title: 'What you\'ll understand by the end',
      description: `The real architectural decisions behind ${tutorialTitle.replace('How to Design ', '')}. Not what the diagram shows — why each component exists and how they work together at scale.`,
      highlight: 'Architecture at scale',
    },
    {
      id: 'cta',
      icon: <Play className="w-6 h-6" />,
      title: 'Ready to start?',
      description: `Each step guides you to add a component, connect it, and understand why it's there. Take ${estimatedTime} to build something real.`,
      highlight: `${stepCount} steps ahead`,
    },
  ];

  const goNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      if (typeof window !== 'undefined') {
        analytics.track({
          event_type: 'tutorial_interaction',
          event_name: 'welcome_card_next',
          page_path: window.location.pathname,
          payload: { card_index: currentIndex + 1 }
        });
      }
    }
  }, [currentIndex, cards.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      if (typeof window !== 'undefined') {
        analytics.track({
          event_type: 'tutorial_interaction',
          event_name: 'welcome_card_prev',
          page_path: window.location.pathname,
          payload: { card_index: currentIndex - 1 }
        });
      }
    }
  }, [currentIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      if (currentIndex < cards.length - 1) {
        goNext();
      } else {
        onStart();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    } else if (e.key === 'Escape' && onSkip) {
      onSkip();
    }
  }, [cards.length, currentIndex, goNext, goPrev, onStart, onSkip]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const card = cards[currentIndex];
  const isLastCard = currentIndex === cards.length - 1;

  if (!canShow) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}
    >
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${tutorialColor}15 0%, transparent 50%)`,
        }}
      />

      <div className="relative w-full max-w-lg mx-4">
        <div
          className="rounded-2xl p-8 transition-all duration-500"
          style={{
            background: 'linear-gradient(135deg, #0f2747 0%, #0a1929 100%)',
            border: '1px solid rgba(30, 144, 255, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(30, 144, 255, 0.4), 0 0 40px rgba(30, 144, 255, 0.2)',
            transform: `translateX(${currentIndex === 0 ? 0 : currentIndex > 0 ? -10 : 10}px)`,
            opacity: 1,
          }}
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${tutorialColor}15`, border: `1px solid ${tutorialColor}25` }}
              >
                <BookOpen className="w-4 h-4" style={{ color: tutorialColor }} />
              </div>
              <span className="text-sm font-medium text-blue-100">{tutorialTitle.replace('How to Design ', '')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {cards.map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: i === currentIndex ? tutorialColor : 'rgba(0,0,0,0.15)',
                    transform: i === currentIndex ? 'scale(1.3)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="min-h-[280px] flex flex-col">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300"
              style={{
                background: `${tutorialColor}10`,
                border: `1px solid ${tutorialColor}20`,
                transform: 'scale(1)',
              }}
            >
              <div style={{ color: tutorialColor }}>{card.icon}</div>
            </div>

            <h2
              className="text-2xl font-bold text-white mb-4 transition-all duration-300"
              style={{ letterSpacing: '-0.03em', lineHeight: 1.2 }}
            >
              {card.title}
            </h2>

            <p
              className="text-base text-blue-100/90 leading-relaxed flex-1"
              style={{ lineHeight: 1.7 }}
            >
              {card.description}
            </p>

            {card.highlight && (
              <div className="mt-6">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: `${tutorialColor}10`, color: tutorialColor, border: `1px solid ${tutorialColor}20` }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  {card.highlight}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-8 pt-6" style={{ borderTop: '1px solid rgba(30, 144, 255, 0.2)' }}>
            <div className="flex items-center gap-2">
              {currentIndex > 0 && (
                <button
                  onClick={goPrev}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-blue-200 hover:text-white transition-colors"
                  style={{ background: 'rgba(30, 144, 255, 0.2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(30, 144, 255, 0.35)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(30, 144, 255, 0.2)'; }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {onSkip && !isLastCard && (
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                                    analytics.track({
                        event_type: 'tutorial_interaction',
                        event_name: 'welcome_card_skip',
                        page_path: window.location.pathname,
                        payload: { skipped_at_card: currentIndex }
                      });
                    }
                    onSkip();
                  }}
                  className="px-3 py-2 rounded-lg text-sm text-blue-200/60 hover:text-blue-100 transition-colors"
                >
                  Skip intro
                </button>
              )}

              <button
                onClick={() => {
                  if (isLastCard && typeof window !== 'undefined') {
                                analytics.track({
                      event_type: 'tutorial_interaction',
                      event_name: 'welcome_card_start_building',
                      page_path: window.location.pathname,
                      payload: { tutorial: tutorialTitle }
                    });
                  }
                  if (isLastCard) {
                    onStart();
                  } else {
                    goNext();
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200"
                style={{ 
                  background: tutorialColor,
                  boxShadow: `0 4px 14px ${tutorialColor}40`,
                }}
                onMouseEnter={(e) => { 
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = `0 6px 20px ${tutorialColor}50`; 
                }}
                onMouseLeave={(e) => { 
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = `0 4px 14px ${tutorialColor}40`; 
                }}
              >
                {isLastCard ? (
                  <>
                    Start Building
                    <Play className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-blue-200/70">
          <kbd className="px-2 py-1 rounded" style={{ background: 'rgba(30, 144, 255, 0.2)' }}>←</kbd>
          <kbd className="px-2 py-1 rounded" style={{ background: 'rgba(30, 144, 255, 0.2)' }}>→</kbd>
          <span className="ml-1">to navigate</span>
        </div>
      </div>
    </div>
  );
}
