import { TUTORIALS, getTutorialById } from '@/data/tutorials';
import type { TutorialDefinition } from '@/lib/tutorial/schema';

export interface NextTutorialSuggestion {
  id: string;
  title: string;
  reason: string;
}

/** Curated “what to learn next” copy when difficulty-based fallback is too generic. */
const CURATED_NEXT: Record<string, NextTutorialSuggestion> = {
  'url-shortener-architecture': {
    id: 'rate-limiter-architecture',
    title: 'How to Design a Rate Limiter',
    reason: 'Learn the API guard patterns you will reuse in every backend you build',
  },
  'rate-limiter-architecture': {
    id: 'todo-api-architecture',
    title: 'How to Design a Todo API',
    reason: 'Practice the classic client → gateway → service → database layering',
  },
  'todo-api-architecture': {
    id: 'rag-application-architecture',
    title: 'RAG Application Architecture',
    reason: 'Apply caching and API patterns to LLM-powered systems',
  },
  'chatgpt-architecture': {
    id: 'netflix-architecture',
    title: 'How to Design Netflix Architecture',
    reason: 'See how production AI systems compare to large-scale streaming platforms',
  },
  'github-architecture': {
    id: 'url-shortener-architecture',
    title: 'URL Shortener Architecture',
    reason: 'Practice classic interview questions with hashing and caching',
  },
};

const DIFFICULTY_ESCALATION: Record<TutorialDefinition['difficulty'], TutorialDefinition['difficulty'] | null> = {
  beginner: 'beginner',
  intermediate: 'advanced',
  advanced: null,
};

function byRecommendedOrder(current: TutorialDefinition): NextTutorialSuggestion | null {
  if (current.recommendedOrder == null) return null;
  const next = TUTORIALS.find((t) => t.recommendedOrder === current.recommendedOrder! + 1);
  if (!next) return null;
  return {
    id: next.id,
    title: next.title,
    reason: 'Continue the beginner path — each tutorial builds on the last',
  };
}

function byDifficultyLadder(current: TutorialDefinition): NextTutorialSuggestion | null {
  const targetDifficulty = DIFFICULTY_ESCALATION[current.difficulty];
  if (!targetDifficulty) return null;

  const idx = TUTORIALS.findIndex((t) => t.id === current.id);
  const candidates = TUTORIALS.filter(
    (t, i) => i > idx && t.difficulty === targetDifficulty && t.recommendedOrder == null
  );
  const next = candidates[0];
  if (!next) return null;

  return {
    id: next.id,
    title: next.title,
    reason:
      targetDifficulty === 'advanced'
        ? 'Ready for a deeper, production-scale architecture'
        : `Another ${targetDifficulty} tutorial to reinforce the patterns`,
  };
}

function byCatalogOrder(current: TutorialDefinition): NextTutorialSuggestion | null {
  const idx = TUTORIALS.findIndex((t) => t.id === current.id);
  if (idx < 0 || idx >= TUTORIALS.length - 1) return null;
  const next = TUTORIALS[idx + 1];
  return {
    id: next.id,
    title: next.title,
    reason: 'Explore another real-world system architecture',
  };
}

/**
 * Suggest the next tutorial after completion.
 * Priority: recommendedOrder funnel → curated map → difficulty ladder → catalog order.
 */
export function getNextTutorial(tutorialId: string): NextTutorialSuggestion | null {
  const current = getTutorialById(tutorialId);
  if (!current) return null;

  return (
    byRecommendedOrder(current) ??
    CURATED_NEXT[tutorialId] ??
    byDifficultyLadder(current) ??
    byCatalogOrder(current)
  );
}
