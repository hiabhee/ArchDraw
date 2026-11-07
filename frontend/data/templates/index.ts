import type { Node, Edge } from 'reactflow';
import { chatgptNodes, chatgptEdges } from './chatgpt';
import { instagramNodes, instagramEdges } from './instagram';
import { archdrawNodes, archdrawEdges } from './archdraw';
import { videoStreamingNodes, videoStreamingEdges } from './video-streaming';
import { netflixNodes, netflixEdges } from './netflix';
import { rideshareNodes, rideshareEdges } from './rideshare';
import { fintechPaymentsNodes, fintechPaymentsEdges } from './fintech-payments';
import { collaborativeDocsNodes, collaborativeDocsEdges } from './collaborative-docs';
import { foodDeliveryNodes, foodDeliveryEdges } from './food-delivery';
import { repoToDiagramNodes, repoToDiagramEdges } from './repo-to-diagram';
import { mvcNodes, mvcEdges } from './mvc';
import { cleanArchitectureNodes, cleanArchitectureEdges } from './clean-architecture';
import { hexagonalNodes, hexagonalEdges } from './hexagonal';
import { layeredNodes, layeredEdges } from './layered';
import { microservicesNodes, microservicesEdges } from './microservices';
import { eventDrivenNodes, eventDrivenEdges } from './event-driven';
import { cqrsNodes, cqrsEdges } from './cqrs';
import { eventSourcingNodes, eventSourcingEdges } from './event-sourcing';
import { serverlessNodes, serverlessEdges } from './serverless';
import { ecommerceNodes, ecommerceEdges } from './ecommerce';
import { urlShortenerNodes, urlShortenerEdges } from './url-shortener';
import { chatSystemNodes, chatSystemEdges } from './chat-system';
import { notificationNodes, notificationEdges } from './notification';
import { searchNodes, searchEdges } from './search';
import { requestResponseNodes, requestResponseEdges } from './request-response';
import { claudeCodeNodes, claudeCodeEdges } from './claude-code';
import {
  whatsappNodes, whatsappEdges,
  twitterNodes, twitterEdges,
  airbnbNodes, airbnbEdges,
  discordNodes, discordEdges,
  zoomNodes, zoomEdges,
  spotifyNodes, spotifyEdges,
  linkedinNodes, linkedinEdges,
  figmaNodes, figmaEdges,
  githubNodes, githubEdges,
  rateLimiterNodes, rateLimiterEdges,
} from './tutorial-systems';

export interface Template {
  id: string;
  name: string;
  description: string;
  tags: string[];
  icon: string; // emoji
  nodes: Node[];
  edges: Edge[];
}

type CanvasEdgeType = 'sync' | 'async' | 'stream' | 'event' | 'dep';

function layerForCategory(category?: string): string {
  const value = (category || '').toLowerCase();
  if (value.includes('client') || value.includes('entry')) return 'client';
  if (value.includes('gateway') || value.includes('edge')) return 'edge';
  if (value.includes('messaging') || value.includes('event') || value.includes('queue') || value.includes('stream')) return 'async';
  if (value.includes('data') || value.includes('storage') || value.includes('database')) return 'data';
  if (value.includes('observability') || value.includes('analytics')) return 'observe';
  if (value.includes('auth') || value.includes('ai') || value.includes('ml')) return 'external';
  if (value.includes('cache')) return 'external';
  return 'compute';
}

function edgeTypeForLabel(label?: string): CanvasEdgeType {
  const value = (label || '').toLowerCase();
  if (/(stream|realtime|real-time|location|cursor|token)/.test(value)) return 'stream';
  if (/(event|publish|broadcast|changed|trigger|metric|log)/.test(value)) return 'event';
  if (/(async|queue|job|worker|background|notify|email|push)/.test(value)) return 'async';
  if (/(external|processor|bank|cdn|settlement|rail)/.test(value)) return 'dep';
  return 'sync';
}

import { createNode, createEdge } from '@/lib/component-library/factory';
import { calculateNodeDimensions } from '@/lib/diagram/nodes/nodeSizing';

function withCanvasStyle(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: nodes.map((node) => {
      const { id, position, data } = node;
      const label = (data?.label as string) || 'Unnamed';
      // Keep shape sizing uniform (rounded-rectangle) but preserve per-node
      // icon / color / category so the global icon toggle (iconMode)
      // controls visibility. Previously this forced `showIcon: false` and
      // `icon: undefined` which made `ON` hide all template icons
      // (see `resolveNodeIconVisibility` – per-node false overrides global).
      const { width, height } = calculateNodeDimensions(label, undefined, { shape: 'rounded-rectangle' });
      return createNode(
        (data?.typeId as string) || 'shapeNode',
        label,
        position || { x: 0, y: 0 },
        {
          id,
          type: 'shapeNode',
          width,
          height,
          data: {
            ...data,
            label,
            shape: 'rounded-rectangle' as const,
            nodeWidth: width,
            nodeHeight: height,
            // Do not force icon visibility – let global `iconMode` decide.
            // Preserve original icon / color / category so `NodeIcon` can
            // resolve a glyph when icons are ON.
            layer: data?.layer || layerForCategory(data?.category as string),
          },
        }
      );
    }),
    edges: edges.map((edge) => {
      const { id, source, target, label, data, style, animated, ...rest } = edge;
      const edgeLabel = String(data?.label || label || '');
      const connectionType = (data?.connectionType || data?.edgeType || edgeTypeForLabel(edgeLabel)) as CanvasEdgeType;
      
      return createEdge(
        source, 
        target, 
        edgeLabel, 
        {
          id,
          type: 'simpleFloating',
          animated: animated ?? connectionType !== 'sync',
          data: {
            ...data,
            label: edgeLabel,
            edgeType: connectionType,
            connectionType,
            pathType: data?.pathType || 'Smoothstep',
          },
          style: {
            ...style,
            strokeWidth: style?.strokeWidth || 1.5,
          },
          ...rest
        }
      );
    }),
  };
}

function template(input: Template): Template {
  const styled = withCanvasStyle(input.nodes, input.edges);
  return { ...input, ...styled };
}

export const TEMPLATES: Template[] = [
  template({
    id: 'archdraw_self',
    name: 'ArchDraw Architecture',
    description:
      'ArchDraw itself: pipeline-core + shared layout, AI Mermaid / Mermaid / Repo diagram pipelines, React Flow canvas, and Supabase.',
    tags: ['Next.js', 'pipeline-core', 'React Flow', 'Supabase'],
    icon: '🏗️',
    nodes: archdrawNodes,
    edges: archdrawEdges,
  }),
  template({
    id: 'chatgpt',
    name: 'ChatGPT-like Architecture',
    description: 'LLM-powered chat app with RAG pipeline, vector DB, streaming, and observability.',
    tags: ['AI', 'LLM', 'RAG', 'Microservices'],
    icon: '🤖',
    nodes: chatgptNodes,
    edges: chatgptEdges,
  }),
  template({
    id: 'claude_code',
    name: 'Claude Code Architecture',
    description: 'Terminal coding agent: CLI → agent loop → context (CLAUDE.md, skills, compaction) → Anthropic API, with tool calls routed through permissions and hooks to file, Bash, search, web, subagent and MCP tools.',
    tags: ['AI', 'Agent', 'LLM', 'Claude', 'MCP', 'Developer Tools'],
    icon: '🧑‍💻',
    nodes: claudeCodeNodes,
    edges: claudeCodeEdges,
  }),
  template({
    id: 'instagram',
    name: 'Instagram-like Architecture',
    description: 'Social media platform with feed, media storage, Kafka streaming, and search.',
    tags: ['Social', 'Media', 'Kafka', 'Microservices'],
    icon: '📸',
    nodes: instagramNodes,
    edges: instagramEdges,
  }),
  template({
    id: 'video_streaming',
    name: 'Video Streaming',
    description: 'Production video platform with uploads, transcoding, manifests, CDN delivery, playback telemetry, and search.',
    tags: ['Video', 'Streaming', 'CDN', 'Transcoding', 'Search'],
    icon: '🎬',
    nodes: videoStreamingNodes,
    edges: videoStreamingEdges,
  }),
  template({
    id: 'netflix',
    name: 'Netflix Streaming',
    description: 'FAANG-level Netflix architecture with 7 layers: Client, Edge, Gateway, Microservices (grouped by domain), Data, Streaming Pipeline, Analytics. Clean layered structure for system design interviews.',
    tags: ['Netflix', 'Streaming', 'FAANG', 'System Design', 'Microservices', 'CDN'],
    icon: '🎥',
    nodes: netflixNodes,
    edges: netflixEdges,
  }),
  template({
    id: 'rideshare',
    name: 'Ride-Sharing Backend',
    description: 'Production-grade ride-sharing architecture with correct flows: Primary (rider request), Real-Time (driver location), Async (post-ride processing). Includes proper grouping and no orphan components.',
    tags: ['Ride-Sharing', 'Uber', 'Lyft', 'Real-Time', 'Microservices', 'WebSocket'],
    icon: '🚗',
    nodes: rideshareNodes,
    edges: rideshareEdges,
  }),
  template({
    id: 'fintech_payments',
    name: 'Fintech Payments Platform',
    description: 'Payment authorization, fraud scoring, ledger writes, settlement rails, analytics, and operational alerts.',
    tags: ['Payments', 'Ledger', 'Fraud', 'Kafka', 'Fintech'],
    icon: '💳',
    nodes: fintechPaymentsNodes,
    edges: fintechPaymentsEdges,
  }),
  template({
    id: 'collaborative_docs',
    name: 'Collaborative Docs',
    description: 'Realtime document editing with CRDT operations, presence, pub/sub fanout, snapshots, search, and metrics.',
    tags: ['Realtime', 'CRDT', 'Pub/Sub', 'Docs', 'SaaS'],
    icon: '📝',
    nodes: collaborativeDocsNodes,
    edges: collaborativeDocsEdges,
  }),
  template({
    id: 'food_delivery',
    name: 'Food Delivery Marketplace',
    description: 'Marketplace architecture for ordering, restaurant menus, courier dispatch, location streaming, and notifications.',
    tags: ['Marketplace', 'Dispatch', 'Streaming', 'Search', 'Mobile'],
    icon: '🍱',
    nodes: foodDeliveryNodes,
    edges: foodDeliveryEdges,
  }),
  template({
    id: 'repo_to_diagram',
    name: 'How Repo → Diagram Works',
    description:
      'The repo-import pipeline itself: GitHub ingestion (tarball + Contents-API fallback), static analysis, deterministic baseline, three LLM agents (classify / extract / relationships), evidence verification, a docs review against the README, and finalization into a React Flow canvas.',
    tags: ['Repo Import', 'Pipeline', 'LLM Agents', 'Dagre'],
    icon: '🔎',
    nodes: repoToDiagramNodes,
    edges: repoToDiagramEdges,
  }),
  template({
    id: 'mvc',
    name: 'MVC Architecture',
    description: 'Model-View-Controller: Browser → Router → Controller → Service → Model → DB, View renders HTML.',
    tags: ['MVC', 'Model', 'View', 'Controller', 'MVP', 'MVVM', 'Pattern'],
    icon: '🎭',
    nodes: mvcNodes,
    edges: mvcEdges,
  }),
  template({
    id: 'clean_architecture',
    name: 'Clean Architecture',
    description: 'Onion/Clean: dependencies point inward from Frameworks & Drivers (web, DB) through Interface Adapters (Controllers/Presenters/Gateways) to Use Cases and Entities.',
    tags: ['Clean', 'Onion', 'Hexagonal', 'Ports', 'Adapters', 'SOLID'],
    icon: '🧅',
    nodes: cleanArchitectureNodes,
    edges: cleanArchitectureEdges,
  }),
  template({
    id: 'hexagonal',
    name: 'Hexagonal Architecture',
    description: 'Ports & Adapters: Domain Core with Input/Output Ports and adapters for REST, DB, Queue, Cache.',
    tags: ['Hexagonal', 'Ports', 'Adapters', 'DDD'],
    icon: '⬡',
    nodes: hexagonalNodes,
    edges: hexagonalEdges,
  }),
  template({
    id: 'layered',
    name: 'Layered Architecture',
    description: 'N-Tier / 3-Tier: Client → Presentation → Business → Persistence → Database, plus external.',
    tags: ['Layered', 'N-Tier', '3-Tier', 'Tier', 'Architecture'],
    icon: '🥞',
    nodes: layeredNodes,
    edges: layeredEdges,
  }),
  template({
    id: 'microservices',
    name: 'Microservices',
    description: 'Client → API Gateway → Auth/User/Order services; User and Order own their databases and publish to an Event Bus.',
    tags: ['Microservices', 'Monolith', 'API Gateway', 'Service', 'Distributed'],
    icon: '🧩',
    nodes: microservicesNodes,
    edges: microservicesEdges,
  }),
  template({
    id: 'event_driven',
    name: 'Event-Driven Architecture',
    description: 'Client → API → transactional Outbox → Event Bus → OrderCreated consumed by Inventory, Email and Analytics.',
    tags: ['Event-Driven', 'EDA', 'Event', 'Kafka', 'Queue', 'Outbox'],
    icon: '📨',
    nodes: eventDrivenNodes,
    edges: eventDrivenEdges,
  }),
  template({
    id: 'cqrs',
    name: 'CQRS',
    description: 'Command Query Responsibility Segregation: Write DB + Read DB via Event Bus, separate Command/Query APIs.',
    tags: ['CQRS', 'Command', 'Query', 'Read', 'Write', 'Event'],
    icon: '⚖️',
    nodes: cqrsNodes,
    edges: cqrsEdges,
  }),
  template({
    id: 'event_sourcing',
    name: 'Event Sourcing',
    description: 'Client → Command Handler → Event Store → Event Bus → Projection → Read Model.',
    tags: ['Event Sourcing', 'Event Store', 'Append', 'Projection'],
    icon: '📜',
    nodes: eventSourcingNodes,
    edges: eventSourcingEdges,
  }),
  template({
    id: 'serverless',
    name: 'Serverless Architecture',
    description: 'Client → CDN + API Gateway → Lambda → DynamoDB/S3, EventBridge cron.',
    tags: ['Serverless', 'Lambda', 'API Gateway', 'DynamoDB', 'S3', 'JAMstack'],
    icon: '⚡',
    nodes: serverlessNodes,
    edges: serverlessEdges,
  }),
  template({
    id: 'ecommerce',
    name: 'E-commerce Platform',
    description: 'Shop like Amazon: CDN, Gateway, Auth, Catalog, Cart, Order, Payment, Search, Inventory.',
    tags: ['E-commerce', 'Amazon', 'Shop', 'Cart', 'Payment', 'Catalog'],
    icon: '🛒',
    nodes: ecommerceNodes,
    edges: ecommerceEdges,
  }),
  template({
    id: 'url_shortener',
    name: 'URL Shortener',
    description: 'Bitly clone: Client → LB → API, Redis cache-aside over Cassandra, and a scheduled expiry job.',
    tags: ['URL Shortener', 'Bitly', 'Shortener', 'Cache', 'Cassandra'],
    icon: '🔗',
    nodes: urlShortenerNodes,
    edges: urlShortenerEdges,
  }),
  template({
    id: 'chat_system',
    name: 'Chat System',
    description: 'Slack-like: Client ⇄ WebSocket GW ⇄ Message service (send + deliver), Presence, History, push for offline users, search via Kafka.',
    tags: ['Chat', 'Slack', 'WebSocket', 'Real-Time', 'Messaging'],
    icon: '💬',
    nodes: chatSystemNodes,
    edges: chatSystemEdges,
  }),
  template({
    id: 'notification',
    name: 'Notification System',
    description: 'Service → Queue → Dispatcher → Push/Email/SMS + Preference DB.',
    tags: ['Notification', 'Push', 'Email', 'SMS', 'Queue'],
    icon: '🔔',
    nodes: notificationNodes,
    edges: notificationEdges,
  }),
  template({
    id: 'search',
    name: 'Search Autocomplete',
    description: 'Typeahead: Client → Search API → Trie Cache + Elasticsearch, DB CDC via Kafka.',
    tags: ['Search', 'Autocomplete', 'Trie', 'Elasticsearch', 'Typeahead'],
    icon: '🔍',
    nodes: searchNodes,
    edges: searchEdges,
  }),
  template({
    id: 'request_response',
    name: 'Request-Response Cycle',
    description: 'End-to-end HTTP lifecycle: DNS lookup, then Client → CDN → LB → Gateway (Auth) → Service → Cache/DB and back through the CDN. Numbered 1–14 for request, token check, cache/DB lookup, JSON response, and 200 OK.',
    tags: ['HTTP', 'Request-Response', 'REST', 'API Gateway', 'Cache', 'DNS'],
    icon: '🔄',
    nodes: requestResponseNodes,
    edges: requestResponseEdges,
  }),
  // Systems that had a system design tutorial but no diagram (data/templates/tutorial-systems.ts).
  template({
    id: 'whatsapp',
    name: 'WhatsApp-like Architecture',
    description: 'End-to-end encrypted messaging: persistent chat servers, store-until-delivered messages, group fan-out, presence, push for offline users, encrypted media and calls.',
    tags: ['WhatsApp', 'Messaging', 'Chat', 'WebSocket', 'End-to-end encryption'],
    icon: '💬',
    nodes: whatsappNodes,
    edges: whatsappEdges,
  }),
  template({
    id: 'twitter',
    name: 'Twitter-like Architecture',
    description: 'Social timeline at scale: tweet writes, fan-out to follower timelines in Redis, social graph, search indexing from an event stream, media and notifications.',
    tags: ['Twitter', 'X', 'Timeline', 'Fan-out', 'Social media'],
    icon: '🐦',
    nodes: twitterNodes,
    edges: twitterEdges,
  }),
  template({
    id: 'airbnb',
    name: 'Airbnb-like Architecture',
    description: 'Booking marketplace: geo and date search, listings with cached pages, availability calendars, bookings, payments, guest-host messaging, reviews and notifications.',
    tags: ['Airbnb', 'Marketplace', 'Booking', 'Search', 'Payments'],
    icon: '🏠',
    nodes: airbnbNodes,
    edges: airbnbEdges,
  }),
  template({
    id: 'discord',
    name: 'Discord-like Architecture',
    description: 'Real-time chat and voice: REST and WebSocket gateways, guilds, message history in NoSQL, voice channels, presence, attachments and observability.',
    tags: ['Discord', 'Chat', 'Voice', 'WebSocket', 'Real-time'],
    icon: '🎮',
    nodes: discordNodes,
    edges: discordEdges,
  }),
  template({
    id: 'zoom',
    name: 'Zoom-like Architecture',
    description: 'Video conferencing: signaling, WebRTC session setup, media servers with TURN relay, meeting state, in-meeting chat and cloud recording.',
    tags: ['Zoom', 'Video conferencing', 'WebRTC', 'Media server', 'Real-time'],
    icon: '🎥',
    nodes: zoomNodes,
    edges: zoomEdges,
  }),
  template({
    id: 'spotify',
    name: 'Spotify-like Architecture',
    description: 'Music streaming: audio CDN, catalog, playback, playlists, search, listening events feeding recommendations and a warehouse, and transcoding of new releases.',
    tags: ['Spotify', 'Music streaming', 'CDN', 'Recommendations', 'Audio'],
    icon: '🎧',
    nodes: spotifyNodes,
    edges: spotifyEdges,
  }),
  template({
    id: 'linkedin',
    name: 'LinkedIn-like Architecture',
    description: 'Professional network: profiles on a connection graph, ranked feeds with fan-out, people and job search, messaging and notifications.',
    tags: ['LinkedIn', 'Social graph', 'Feed', 'Search', 'Professional network'],
    icon: '💼',
    nodes: linkedinNodes,
    edges: linkedinEdges,
  }),
  template({
    id: 'figma',
    name: 'Figma-like Architecture',
    description: 'Real-time collaborative design: per-file multiplayer servers, CRDT merging, cursor presence, pub/sub broadcast, version history and exports.',
    tags: ['Figma', 'Collaboration', 'Multiplayer', 'CRDT', 'Design tool'],
    icon: '🎨',
    nodes: figmaNodes,
    edges: figmaEdges,
  }),
  template({
    id: 'github',
    name: 'GitHub-like Architecture',
    description: 'Code hosting: Git over HTTPS and SSH, replicated repository storage, pull requests, events driving Actions runners, webhooks, and code search.',
    tags: ['GitHub', 'Git', 'CI/CD', 'Code hosting', 'Developer tools'],
    icon: '🐙',
    nodes: githubNodes,
    edges: githubEdges,
  }),
  template({
    id: 'rate_limiter',
    name: 'Rate Limiter',
    description: 'Distributed rate limiting at the API gateway: per-plan rules, token buckets with atomic counters in Redis, 429 rejections and metrics.',
    tags: ['Rate limiter', 'API', 'Redis', 'Token bucket', 'System design interview'],
    icon: '🚦',
    nodes: rateLimiterNodes,
    edges: rateLimiterEdges,
  }),
];
