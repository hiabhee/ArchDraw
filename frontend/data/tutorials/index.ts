// ── Factory Tutorial format (new canonical type) ────────────────────────────────
/** @deprecated Use TutorialDefinition from '@/lib/tutorial/schema' directly. */
export type { Tutorial, TutorialStep, TutorialLevel } from '@/lib/tutorial/types';
/** @deprecated */
export type { TutorialMessage, StepValidation } from '@/lib/tutorial/types';

// ── Flat Tutorial format (legacy — used by non-refactored tutorials) ────────────
/** @deprecated All 22 tutorials now use TutorialDefinition from schema.ts. */
export type FlatTutorial = {
  id: string;
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  category: string;
  estimatedTime: string;
  nodeCount: number;
  stepCount: number;
  icon: string;
  color: string;
  tags: string[];
  steps: import('@/lib/tutorial/types').TutorialStep[];
};

// Re-export FlatTutorial as TutorialData for backward compatibility with old flat tutorials
export type { FlatTutorial as TutorialData };

// ── Union type for the TUTORIALS array ────────────────────────────────────────
import type { TutorialDefinition } from '@/lib/tutorial/schema';

export type AnyTutorial = TutorialDefinition;

// ── Import all tutorials ────────────────────────────────────────────────────────
import chatgptTutorial_default from './chatgpt-architecture';
import instagramTutorial_default from './instagram-architecture';
import openclawTutorial_default from './openclaw-architecture';
import netflixTutorial_default from './netflix-architecture';
import uberTutorial_default from './uber-architecture';
import whatsappTutorial_default from './whatsapp-architecture';
import stripeTutorial_default from './stripe-architecture';
import youtubeTutorial_default from './youtube-architecture';
import notionTutorial_default from './notion-architecture';
import twitterTutorial_default from './twitter-architecture';
import airbnbTutorial_default from './airbnb-architecture';
import discordTutorial_default from './discord-architecture';
import zoomTutorial_default from './zoom-architecture';
import spotifyTutorial_default from './spotify-architecture';
import linkedinTutorial_default from './linkedin-architecture';
import figmaTutorial_default from './figma-architecture';
import shopifyTutorial_default from './shopify-architecture';
import doordashTutorial_default from './doordash-architecture';
import githubTutorial_default from './github-architecture';
import urlShortenerTutorial_default from './url-shortener-architecture';
import ragTutorial_default from './rag-application-architecture';
import aiAgentTutorial_default from './ai-agent-system-architecture';

const chatgptTutorial = chatgptTutorial_default;
const instagramTutorial = instagramTutorial_default;
const openclawTutorial = openclawTutorial_default;
const netflixTutorial = netflixTutorial_default;
const uberTutorial = uberTutorial_default;
const whatsappTutorial = whatsappTutorial_default;
const stripeTutorial = stripeTutorial_default;
const youtubeTutorial = youtubeTutorial_default;
const notionTutorial = notionTutorial_default;
const twitterTutorial = twitterTutorial_default;
const airbnbTutorial = airbnbTutorial_default;
const discordTutorial = discordTutorial_default;
const zoomTutorial = zoomTutorial_default;
const spotifyTutorial = spotifyTutorial_default;
const linkedinTutorial = linkedinTutorial_default;
const figmaTutorial = figmaTutorial_default;
const shopifyTutorial = shopifyTutorial_default;
const doordashTutorial = doordashTutorial_default;
const githubTutorial = githubTutorial_default;
const urlShortenerTutorial = urlShortenerTutorial_default;
const ragTutorial = ragTutorial_default;
const aiAgentTutorial = aiAgentTutorial_default;

// Re-export all tutorials
export {
  chatgptTutorial,
  instagramTutorial,
  openclawTutorial,
  netflixTutorial,
  uberTutorial,
  whatsappTutorial,
  stripeTutorial,
  youtubeTutorial,
  notionTutorial,
  twitterTutorial,
  airbnbTutorial,
  discordTutorial,
  zoomTutorial,
  spotifyTutorial,
  linkedinTutorial,
  figmaTutorial,
  shopifyTutorial,
  doordashTutorial,
  githubTutorial,
  urlShortenerTutorial,
  ragTutorial,
  aiAgentTutorial,
};

// Validate the refactored tutorials at startup (dev-only, no-op in prod)
// validateAllTutorials([chatgptTutorial, instagramTutorial, openclawTutorial, netflixTutorial, uberTutorial]);

export const LIVE_TUTORIALS = new Set<string>([]);

export function isLiveTutorial(id: string): boolean {
  return LIVE_TUTORIALS.has(id);
}

export const LEVELED_TUTORIALS = new Set([
  'chatgpt-architecture',
  'instagram-architecture',
  'netflix-architecture',
  'openclaw-architecture',
  'uber-architecture',
  'whatsapp-architecture',
  'stripe-architecture',
  'youtube-architecture',
  'notion-architecture',
  'twitter-architecture',
  'airbnb-architecture',
  'discord-architecture',
  'zoom-architecture',
  'spotify-architecture',
  'linkedin-architecture',
  'figma-architecture',
  'shopify-architecture',
  'doordash-architecture',
  'github-architecture',
  'url-shortener-architecture',
  'rag-application-architecture',
  'ai-agent-system-architecture',
]);

export function isLeveledTutorial(id: string): boolean {
  return LEVELED_TUTORIALS.has(id);
}

export const TUTORIALS: AnyTutorial[] = [
  chatgptTutorial,
  instagramTutorial,
  openclawTutorial,
  netflixTutorial,
  uberTutorial,
  whatsappTutorial,
  stripeTutorial,
  youtubeTutorial,
  notionTutorial,
  twitterTutorial,
  airbnbTutorial,
  discordTutorial,
  zoomTutorial,
  spotifyTutorial,
  linkedinTutorial,
  figmaTutorial,
  shopifyTutorial,
  doordashTutorial,
  githubTutorial,
  urlShortenerTutorial,
  ragTutorial,
  aiAgentTutorial,
];

export function getTutorialById(id: string): AnyTutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}

if (process.env.NODE_ENV === 'development') {
  import('@/lib/tutorial/registryCheck').then(({ warnMissingNodeTypes }) =>
    warnMissingNodeTypes(TUTORIALS as TutorialDefinition[])
  );
}
