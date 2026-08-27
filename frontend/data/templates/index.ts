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

import { createNode, createEdge } from '@/lib/factory';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';

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
      'The repo-import pipeline itself: GitHub ingestion (tarball + Contents-API fallback), static analysis, deterministic baseline, three LLM agents (classify / extract / relationships), evidence verification, and finalization into a React Flow canvas.',
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
    description: 'Onion/Clean: Entities → Use Cases → Interface Adapters (Controllers/Presenters/Gateways) → Frameworks & External.',
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
    description: 'Client → API Gateway → Auth/User/Order services, each with DB, plus Event Bus.',
    tags: ['Microservices', 'Monolith', 'API Gateway', 'Service', 'Distributed'],
    icon: '🧩',
    nodes: microservicesNodes,
    edges: microservicesEdges,
  }),
  template({
    id: 'event_driven',
    name: 'Event-Driven Architecture',
    description: 'Client → API → Event Store → Event Bus → Inventory/Email/Analytics consumers.',
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
    description: 'Bitly clone: Client → LB → API → Cache (Redis) → DB (Cassandra) + Worker.',
    tags: ['URL Shortener', 'Bitly', 'Shortener', 'Cache', 'Cassandra'],
    icon: '🔗',
    nodes: urlShortenerNodes,
    edges: urlShortenerEdges,
  }),
  template({
    id: 'chat_system',
    name: 'Chat System',
    description: 'Slack-like: Client → WebSocket GW → Presence, Message → History, Push, Search via Kafka.',
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
];
