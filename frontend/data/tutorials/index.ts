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

export const LIVE_TUTORIALS = new Set(TUTORIALS.map(t => t.id));

export function isLiveTutorial(id: string): boolean {
  return LIVE_TUTORIALS.has(id);
}

export function isLeveledTutorial(_id: string): boolean {
  return true;
}

export function getTutorialById(id: string): AnyTutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}

if (process.env.NODE_ENV === 'development') {
  import('@/lib/tutorial/registryCheck').then(({ warnMissingNodeTypes }) =>
    warnMissingNodeTypes(TUTORIALS as TutorialDefinition[])
  );
}
