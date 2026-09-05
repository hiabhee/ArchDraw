import type { ReactFlowNode, ReactFlowEdge } from '../types/index.js';
import type { ApplyTemplateInput } from '../lib/schema.js';
import { normalizeLayer, getTierColor } from '../lib/node-catalog.js';
import { COMM_COLORS } from '../lib/constants.js';
import { fetchWithTimeout } from '../lib/http.js';
import type { TierType } from '../types/index.js';

interface TemplateNode {
  id: string;
  label: string;
  tier: string;
  icon: string;
}

interface TemplateEdge {
  source: string;
  target: string;
  communicationType: string;
}

interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'archflow',
    name: 'ArchFlow Architecture',
    description: 'The system design of ArchFlow itself - a modern SaaS architecture',
    category: 'Architecture',
    nodes: [
      { id: 'client', label: 'Client App', tier: 'client', icon: 'monitor' },
      { id: 'cdn', label: 'CDN', tier: 'edge', icon: 'radio-tower' },
      { id: 'api-gateway', label: 'API Gateway', tier: 'edge', icon: 'webhook' },
      { id: 'auth-service', label: 'Auth Service', tier: 'compute', icon: 'shield' },
      { id: 'user-service', label: 'User Service', tier: 'compute', icon: 'users' },
      { id: 'canvas-service', label: 'Canvas Service', tier: 'compute', icon: 'pen-tool' },
      { id: 'ai-service', label: 'AI Service', tier: 'compute', icon: 'sparkles' },
      { id: 'message-queue', label: 'Message Queue', tier: 'async', icon: 'message-square' },
      { id: 'postgres', label: 'PostgreSQL', tier: 'data', icon: 'database' },
      { id: 'redis', label: 'Redis Cache', tier: 'data', icon: 'gauge' },
      { id: 'monitoring', label: 'Monitoring', tier: 'observe', icon: 'activity' },
    ],
    edges: [
      { source: 'client', target: 'cdn', communicationType: 'sync' },
      { source: 'cdn', target: 'api-gateway', communicationType: 'sync' },
      { source: 'api-gateway', target: 'auth-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'user-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'canvas-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'ai-service', communicationType: 'sync' },
      { source: 'ai-service', target: 'message-queue', communicationType: 'async' },
      { source: 'user-service', target: 'postgres', communicationType: 'sync' },
      { source: 'canvas-service', target: 'postgres', communicationType: 'sync' },
      { source: 'canvas-service', target: 'redis', communicationType: 'sync' },
      { source: 'canvas-service', target: 'message-queue', communicationType: 'async' },
      { source: 'monitoring', target: 'auth-service', communicationType: 'sync' },
      { source: 'monitoring', target: 'user-service', communicationType: 'sync' },
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT-like Architecture',
    description: 'LLM chat app with RAG, vector DB, and streaming',
    category: 'AI',
    nodes: [
      { id: 'client', label: 'Web Client', tier: 'client', icon: 'monitor' },
      { id: 'cdn', label: 'CDN', tier: 'edge', icon: 'radio-tower' },
      { id: 'load-balancer', label: 'Load Balancer', tier: 'edge', icon: 'scale' },
      { id: 'websocket-server', label: 'WebSocket Server', tier: 'compute', icon: 'zap' },
      { id: 'chat-service', label: 'Chat Service', tier: 'compute', icon: 'message-circle' },
      { id: 'token-streaming', label: 'Token Streaming', tier: 'compute', icon: 'zap' },
      { id: 'llm-gateway', label: 'LLM Gateway', tier: 'compute', icon: 'brain' },
      { id: 'vector-db', label: 'Vector Database', tier: 'data', icon: 'cpu' },
      { id: 'embedding-service', label: 'Embedding Service', tier: 'compute', icon: 'network' },
      { id: 'document-store', label: 'Document Store', tier: 'data', icon: 'file-text' },
      { id: 'postgres', label: 'PostgreSQL', tier: 'data', icon: 'database' },
      { id: 'redis', label: 'Redis', tier: 'data', icon: 'gauge' },
      { id: 'monitoring', label: 'Monitoring', tier: 'observe', icon: 'activity' },
    ],
    edges: [
      { source: 'client', target: 'cdn', communicationType: 'sync' },
      { source: 'cdn', target: 'load-balancer', communicationType: 'sync' },
      { source: 'load-balancer', target: 'websocket-server', communicationType: 'stream' },
      { source: 'websocket-server', target: 'chat-service', communicationType: 'sync' },
      { source: 'chat-service', target: 'token-streaming', communicationType: 'stream' },
      { source: 'token-streaming', target: 'llm-gateway', communicationType: 'stream' },
      { source: 'chat-service', target: 'vector-db', communicationType: 'sync' },
      { source: 'embedding-service', target: 'vector-db', communicationType: 'sync' },
      { source: 'embedding-service', target: 'document-store', communicationType: 'sync' },
      { source: 'chat-service', target: 'postgres', communicationType: 'sync' },
      { source: 'chat-service', target: 'redis', communicationType: 'sync' },
      { source: 'monitoring', target: 'chat-service', communicationType: 'sync' },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram-like Architecture',
    description: 'Social platform with Kafka, media storage, and search',
    category: 'Social',
    nodes: [
      { id: 'mobile-app', label: 'Mobile App', tier: 'client', icon: 'smartphone' },
      { id: 'web-client', label: 'Web Client', tier: 'client', icon: 'monitor' },
      { id: 'cdn', label: 'CDN', tier: 'edge', icon: 'radio-tower' },
      { id: 'api-gateway', label: 'API Gateway', tier: 'edge', icon: 'webhook' },
      { id: 'auth-service', label: 'Auth Service', tier: 'compute', icon: 'shield' },
      { id: 'user-service', label: 'User Service', tier: 'compute', icon: 'users' },
      { id: 'media-service', label: 'Media Service', tier: 'compute', icon: 'image' },
      { id: 'feed-service', label: 'Feed Service', tier: 'compute', icon: 'rss' },
      { id: 'post-service', label: 'Post Service', tier: 'compute', icon: 'file-text' },
      { id: 'kafka', label: 'Kafka', tier: 'async', icon: 'activity' },
      { id: 'fanout-service', label: 'Fan-out Service', tier: 'compute', icon: 'share-2' },
      { id: 'search-service', label: 'Search Service', tier: 'compute', icon: 'search' },
      { id: 'postgres', label: 'PostgreSQL', tier: 'data', icon: 'database' },
      { id: 'redis', label: 'Redis Cache', tier: 'data', icon: 'gauge' },
      { id: 's3', label: 'Object Storage', tier: 'data', icon: 'hard-drive' },
      { id: 'elasticsearch', label: 'Search Engine', tier: 'data', icon: 'search' },
      { id: 'monitoring', label: 'Monitoring', tier: 'observe', icon: 'activity' },
    ],
    edges: [
      { source: 'mobile-app', target: 'cdn', communicationType: 'sync' },
      { source: 'web-client', target: 'cdn', communicationType: 'sync' },
      { source: 'cdn', target: 'api-gateway', communicationType: 'sync' },
      { source: 'api-gateway', target: 'auth-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'user-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'media-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'feed-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'post-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'search-service', communicationType: 'sync' },
      { source: 'media-service', target: 's3', communicationType: 'sync' },
      { source: 'post-service', target: 'kafka', communicationType: 'async' },
      { source: 'kafka', target: 'fanout-service', communicationType: 'async' },
      { source: 'fanout-service', target: 'redis', communicationType: 'sync' },
      { source: 'search-service', target: 'elasticsearch', communicationType: 'sync' },
      { source: 'user-service', target: 'postgres', communicationType: 'sync' },
      { source: 'post-service', target: 'postgres', communicationType: 'sync' },
    ],
  },
  {
    id: 'rideshare',
    name: 'Uber-like Architecture',
    description: 'Rideshare platform with real-time tracking and dynamic pricing',
    category: 'Transportation',
    nodes: [
      { id: 'passenger-app', label: 'Passenger App', tier: 'client', icon: 'smartphone' },
      { id: 'driver-app', label: 'Driver App', tier: 'client', icon: 'car' },
      { id: 'cdn', label: 'CDN', tier: 'edge', icon: 'radio-tower' },
      { id: 'api-gateway', label: 'API Gateway', tier: 'edge', icon: 'webhook' },
      { id: 'auth-service', label: 'Auth Service', tier: 'compute', icon: 'shield' },
      { id: 'ride-service', label: 'Ride Service', tier: 'compute', icon: 'car' },
      { id: 'matching-service', label: 'Matching Service', tier: 'compute', icon: 'git-merge' },
      { id: 'pricing-service', label: 'Pricing Service', tier: 'compute', icon: 'dollar-sign' },
      { id: 'location-service', label: 'Location Service', tier: 'compute', icon: 'map-pin' },
      { id: 'notification-service', label: 'Notification Service', tier: 'compute', icon: 'bell' },
      { id: 'kafka', label: 'Kafka', tier: 'async', icon: 'activity' },
      { id: 'postgres', label: 'PostgreSQL', tier: 'data', icon: 'database' },
      { id: 'redis', label: 'Redis', tier: 'data', icon: 'gauge' },
      { id: 'geofence-service', label: 'Geofence Service', tier: 'compute', icon: 'map' },
      { id: 'fraud-detection', label: 'Fraud Detection', tier: 'compute', icon: 'shield-alert' },
      { id: 'monitoring', label: 'Monitoring', tier: 'observe', icon: 'activity' },
    ],
    edges: [
      { source: 'passenger-app', target: 'cdn', communicationType: 'sync' },
      { source: 'driver-app', target: 'cdn', communicationType: 'sync' },
      { source: 'cdn', target: 'api-gateway', communicationType: 'sync' },
      { source: 'api-gateway', target: 'auth-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'ride-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'matching-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'pricing-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'location-service', communicationType: 'sync' },
      { source: 'driver-app', target: 'location-service', communicationType: 'stream' },
      { source: 'ride-service', target: 'kafka', communicationType: 'async' },
      { source: 'kafka', target: 'notification-service', communicationType: 'async' },
      { source: 'matching-service', target: 'redis', communicationType: 'sync' },
      { source: 'pricing-service', target: 'redis', communicationType: 'sync' },
      { source: 'location-service', target: 'geofence-service', communicationType: 'sync' },
      { source: 'ride-service', target: 'fraud-detection', communicationType: 'sync' },
      { source: 'ride-service', target: 'postgres', communicationType: 'sync' },
      { source: 'monitoring', target: 'ride-service', communicationType: 'sync' },
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce Platform',
    description: 'Full-stack e-commerce with cart, payments, and order management',
    category: 'Commerce',
    nodes: [
      { id: 'client', label: 'Web Client', tier: 'client', icon: 'monitor' },
      { id: 'mobile-app', label: 'Mobile App', tier: 'client', icon: 'smartphone' },
      { id: 'cdn', label: 'CDN', tier: 'edge', icon: 'radio-tower' },
      { id: 'load-balancer', label: 'Load Balancer', tier: 'edge', icon: 'scale' },
      { id: 'api-gateway', label: 'API Gateway', tier: 'edge', icon: 'webhook' },
      { id: 'auth-service', label: 'Auth Service', tier: 'compute', icon: 'shield' },
      { id: 'product-service', label: 'Product Service', tier: 'compute', icon: 'package' },
      { id: 'cart-service', label: 'Cart Service', tier: 'compute', icon: 'shopping-cart' },
      { id: 'order-service', label: 'Order Service', tier: 'compute', icon: 'clipboard-list' },
      { id: 'payment-service', label: 'Payment Service', tier: 'compute', icon: 'credit-card' },
      { id: 'inventory-service', label: 'Inventory Service', tier: 'compute', icon: 'package' },
      { id: 'notification-service', label: 'Notification Service', tier: 'compute', icon: 'bell' },
      { id: 'rabbitmq', label: 'Message Queue', tier: 'async', icon: 'message-square' },
      { id: 'postgres', label: 'PostgreSQL', tier: 'data', icon: 'database' },
      { id: 'redis', label: 'Redis Cache', tier: 'data', icon: 'gauge' },
      { id: 's3', label: 'Object Storage', tier: 'data', icon: 'hard-drive' },
      { id: 'monitoring', label: 'Monitoring', tier: 'observe', icon: 'activity' },
    ],
    edges: [
      { source: 'client', target: 'cdn', communicationType: 'sync' },
      { source: 'mobile-app', target: 'cdn', communicationType: 'sync' },
      { source: 'cdn', target: 'load-balancer', communicationType: 'sync' },
      { source: 'load-balancer', target: 'api-gateway', communicationType: 'sync' },
      { source: 'api-gateway', target: 'auth-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'product-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'cart-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'order-service', communicationType: 'sync' },
      { source: 'api-gateway', target: 'payment-service', communicationType: 'sync' },
      { source: 'order-service', target: 'rabbitmq', communicationType: 'async' },
      { source: 'rabbitmq', target: 'notification-service', communicationType: 'async' },
      { source: 'rabbitmq', target: 'inventory-service', communicationType: 'async' },
      { source: 'product-service', target: 'postgres', communicationType: 'sync' },
      { source: 'product-service', target: 'redis', communicationType: 'sync' },
      { source: 'product-service', target: 's3', communicationType: 'sync' },
      { source: 'cart-service', target: 'redis', communicationType: 'sync' },
      { source: 'order-service', target: 'postgres', communicationType: 'sync' },
      { source: 'payment-service', target: 'postgres', communicationType: 'sync' },
    ],
  },
];

export async function applyTemplate(input: ApplyTemplateInput): Promise<{
  success: boolean;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  metadata: {
    templateName: string;
    nodeCount: number;
    edgeCount: number;
  };
  diagramUrl?: string;
  sessionId?: string;
  shareUrl?: string;
  embeddedDiagram?: { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] };
  message?: string;
  errors?: string[];
}> {
  const errors: string[] = [];

  try {
    const template = TEMPLATES.find(t => t.id === input.templateId);

    if (!template) {
      return {
        success: false,
        nodes: [],
        edges: [],
        metadata: {
          templateName: input.templateId,
          nodeCount: 0,
          edgeCount: 0,
        },
        errors: [`Template '${input.templateId}' not found`],
      };
    }

    let templateNodes = template.nodes;
    const templateEdges = template.edges;

    if (input.customizations) {
      if (input.customizations.renameNodes) {
        const renameMap = input.customizations.renameNodes;
        templateNodes = templateNodes.map(node => ({
          ...node,
          label: renameMap[node.id] || node.label,
        }));
      }

      if (input.customizations.addNodes) {
        for (const addNode of input.customizations.addNodes) {
          templateNodes.push({
            id: addNode.id,
            label: addNode.label,
            tier: 'compute',
            icon: addNode.icon,
          });
        }
      }
    }

    const TIER_X: Record<string, number> = {
      client: 50,
      edge: 320,
      compute: 650,
      async: 1000,
      data: 1350,
      observe: 1700,
      external: 2050,
    };

    const tierNodes: Record<string, TemplateNode[]> = {};
    for (const node of templateNodes) {
      const tier = node.tier || 'compute';
      if (!tierNodes[tier]) {
        tierNodes[tier] = [];
      }
      tierNodes[tier].push(node);
    }

    const yCounters: Record<string, number> = {};
    const reactFlowNodes: ReactFlowNode[] = templateNodes.map((node) => {
      const tier = node.tier || 'compute';
      if (!yCounters[tier]) yCounters[tier] = 50;
      const y = yCounters[tier];
      yCounters[tier] += 100;

      const normalizedTier = normalizeLayer(tier) as TierType;

      return {
        id: node.id,
        type: 'systemNode',
        position: { x: TIER_X[tier] || 650, y },
        data: {
          label: node.label,
          subtitle: node.label,
          icon: node.icon,
          layer: normalizedTier,
          tier: normalizedTier,
          tierColor: getTierColor(normalizedTier),
          category: template.category,
        },
        width: 180,
        height: 70,
        zIndex: 1,
      };
    });

    const reactFlowEdges: ReactFlowEdge[] = templateEdges.map((edge, idx) => {
      const commType = (edge.communicationType || 'sync') as keyof typeof COMM_COLORS;
      const commStyle = COMM_COLORS[commType] || COMM_COLORS.sync;
      const edgeLabel = commType === 'async' ? 'async message'
        : commType === 'stream' ? 'stream'
        : commType === 'event' ? 'event'
        : '';

      return {
        id: `edge-${idx}`,
        source: edge.source,
        target: edge.target,
        type: 'smooth',
        animated: commStyle.animated,
        label: edgeLabel,
        labelShowBg: true,
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#1e1e2e', fillOpacity: 0.9 },
        labelStyle: { fontSize: 10, fontWeight: 600, fill: '#e2e8f0' },
        style: {
          stroke: commStyle.color,
          strokeWidth: 2,
          strokeDasharray: commStyle.dash,
        },
        markerEnd: { type: 'arrowclosed', color: commStyle.color },
        data: {
          communicationType: commType as 'sync' | 'async' | 'stream' | 'event' | 'dep',
          pathType: 'smooth',
          label: edgeLabel,
        },
      };
    });

    let diagramUrl: string | undefined;
    let message: string | undefined;
    let sessionId: string | undefined;
    const API_BASE = process.env.API_BASE_URL || 'https://archdraw.hiabhee.online';

    try {
      const saveResponse = await fetchWithTimeout(`${API_BASE}/api/diagram/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: reactFlowNodes,
          edges: reactFlowEdges,
          label: template.name,
          source: 'mcp',
        }),
      });

      if (saveResponse.ok) {
        const saveData = await saveResponse.json() as { sessionId: string; url?: string };
        const urlPath = saveData.url || `/editor?session=${saveData.sessionId}`;
        diagramUrl = `${API_BASE}${urlPath}`;
        sessionId = saveData.sessionId;
        const shareUrl = `${API_BASE}/share/${sessionId}`;
        message = `✅ Template loaded! Open this URL to view and edit the diagram:\n\n${diagramUrl}\n\n🔗 Shareable link:\n${shareUrl}\n\nOr copy and paste this link in your browser. The template has ${reactFlowNodes.length} nodes and ${reactFlowEdges.length} edges.\n\n**To export**: Use the session ID "${sessionId}" with the export_diagram tool (format: json/png/svg).`;
      }
    } catch {
      message = `Template applied with ${reactFlowNodes.length} nodes and ${reactFlowEdges.length} edges.`;
    }

    return {
      success: true,
      nodes: reactFlowNodes,
      edges: reactFlowEdges,
      metadata: {
        templateName: template.name,
        nodeCount: reactFlowNodes.length,
        edgeCount: reactFlowEdges.length,
      },
      diagramUrl,
      sessionId,
      shareUrl: sessionId ? `${API_BASE}/share/${sessionId}` : undefined,
      embeddedDiagram: {
        nodes: reactFlowNodes,
        edges: reactFlowEdges,
      },
      message,
      errors: errors.length > 0 ? errors : undefined,
    };

  } catch (error) {
    return {
      success: false,
      nodes: [],
      edges: [],
      metadata: {
        templateName: input.templateId,
        nodeCount: 0,
        edgeCount: 0,
      },
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

export function getAvailableTemplates(): Array<{ id: string; name: string; description: string; category: string }> {
  return TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
  }));
}
