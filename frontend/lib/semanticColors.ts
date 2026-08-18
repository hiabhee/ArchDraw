/**
 * Semantic color system for role-based icon coloring.
 * Replaces the generic purple (#6366f1) fallback with category-appropriate colors.
 */

export type SemanticCategory = 
  | 'compute' 
  | 'data' 
  | 'async' 
  | 'external' 
  | 'security' 
  | 'orchestration'
  | 'networking'
  | 'observability'
  | 'ai'
  | 'integration';

export interface SemanticColorPalette {
  light: string;
  dark: string;
}

/**
 * Semantic color palettes designed to be meaningful and cohesive:
 * - compute: teal/blue-gray (processing, execution)
 * - data: green/slate (storage, persistence)
 * - async: orange (messaging, events, queues)
 * - external: muted brown/gray (third-party, APIs)
 * - security: red/rose (auth, firewall, secrets)
 * - orchestration: indigo (coordination, control)
 * - networking: purple (routing, CDN, DNS)
 * - observability: pink/magenta (metrics, logs, traces)
 * - ai: violet (ML, embeddings, agents)
 * - integration: amber (webhooks, payments, email)
 */
export const SEMANTIC_COLOR_PALETTES: Record<SemanticCategory, SemanticColorPalette> = {
  compute: {
    light: '#0891B2', // cyan-600
    dark: '#06B6D4',  // cyan-500
  },
  data: {
    light: '#059669', // emerald-600
    dark: '#10B981',  // emerald-500
  },
  async: {
    light: '#EA580C', // orange-600
    dark: '#F97316',  // orange-500
  },
  external: {
    light: '#78716C', // stone-500
    dark: '#A8A29E',  // stone-400
  },
  security: {
    light: '#DC2626', // red-600
    dark: '#EF4444',  // red-500
  },
  orchestration: {
    light: '#4F46E5', // indigo-600
    dark: '#6366F1',  // indigo-500
  },
  networking: {
    light: '#9333EA', // purple-600
    dark: '#A855F7',  // purple-500
  },
  observability: {
    light: '#DB2777', // pink-600
    dark: '#EC4899',  // pink-500
  },
  ai: {
    light: '#7C3AED', // violet-600
    dark: '#8B5CF6',  // violet-500
  },
  integration: {
    light: '#D97706', // amber-600
    dark: '#F59E0B',  // amber-500
  },
};

/**
 * Default fallback color (cyan) for truly generic/unclassified nodes.
 */
export const DEFAULT_SEMANTIC_COLOR = '#0891B2';

/**
 * Legacy purple colors to detect and replace.
 */
export const LEGACY_PURPLE_COLORS = new Set(['#6366f1', '#6366F1']);

/**
 * Get semantic color for a category, respecting dark mode.
 */
export function getSemanticColor(category: SemanticCategory, isDark: boolean = false): string {
  const palette = SEMANTIC_COLOR_PALETTES[category];
  return isDark ? palette.dark : palette.light;
}

/**
 * Map icon names to semantic categories for color resolution.
 */
export const ICON_TO_CATEGORY: Record<string, SemanticCategory> = {
  // Compute
  'arch-server': 'compute',
  'arch-service': 'compute',
  'arch-function': 'compute',
  'arch-worker': 'compute',
  'arch-docker': 'compute',
  'arch-vm': 'compute',
  'arch-batch': 'compute',
  'arch-cluster': 'compute',
  
  // Data
  'arch-database': 'data',
  'arch-document-db': 'data',
  'arch-key-value': 'data',
  'arch-cache': 'data',
  'arch-storage': 'data',
  'arch-file': 'data',
  'arch-warehouse': 'data',
  'arch-search': 'data',
  'arch-vector': 'data',
  'arch-timeseries': 'data',
  'arch-replication': 'data',
  'arch-backup': 'data',
  
  // Async/Messaging
  'arch-message-queue': 'async',
  'arch-event-stream': 'async',
  'arch-stream-processor': 'async',
  'arch-producer': 'async',
  'arch-consumer': 'async',
  'arch-consumer-group': 'async',
  'arch-broker': 'async',
  'arch-topic': 'async',
  'arch-partition': 'async',
  'arch-dead-letter': 'async',
  
  // External
  'arch-external': 'external',
  'arch-web': 'external',
  'arch-mobile': 'external',
  'arch-desktop': 'external',
  'arch-terminal': 'external',
  
  // Security
  'arch-auth': 'security',
  'arch-sso': 'security',
  'arch-secrets': 'security',
  'arch-firewall': 'security',
  
  // Orchestration
  'arch-coordinator': 'orchestration',
  'arch-kubernetes': 'orchestration',
  'arch-scheduler': 'orchestration',
  'arch-config': 'orchestration',
  'arch-registry': 'orchestration',
  'arch-cicd': 'orchestration',
  'arch-workflow': 'orchestration',
  
  // Networking
  'arch-api-gateway': 'networking',
  'arch-grpc': 'networking',
  'arch-load-balancer': 'networking',
  'arch-proxy': 'networking',
  'arch-router': 'networking',
  'arch-cdn': 'networking',
  'arch-dns': 'networking',
  'arch-graphql': 'networking',
  'arch-webhook': 'networking',
  'arch-realtime': 'networking',
  
  // Observability
  'arch-observability': 'observability',
  'arch-metrics': 'observability',
  'arch-logs': 'observability',
  'arch-trace': 'observability',
  'arch-health-check': 'observability',
  'arch-notification': 'observability',
  
  // AI
  'arch-ai': 'ai',
  'arch-agent': 'ai',
  'arch-knowledge': 'ai',
  
  // Integration
  'arch-payment': 'integration',
  'arch-email': 'integration',
  'arch-chat': 'integration',
  'arch-maps': 'integration',
  'arch-upload': 'integration',
  'arch-download': 'integration',
  'arch-users': 'integration',
  'arch-etl': 'integration',
  'arch-circuit-breaker': 'integration',
};

/**
 * Resolve semantic color for an icon, with fallback to default.
 */
export function resolveSemanticColorForIcon(iconName: string, isDark: boolean = false): string {
  const category = ICON_TO_CATEGORY[iconName];
  if (!category) return isDark ? '#06B6D4' : DEFAULT_SEMANTIC_COLOR;
  return getSemanticColor(category, isDark);
}

/**
 * Normalize a color, replacing legacy purple with appropriate semantic color.
 */
export function normalizeColor(
  color: string | undefined,
  iconName?: string,
  isDark: boolean = false
): string {
  // If no color provided or it's legacy purple, use semantic color
  if (!color || LEGACY_PURPLE_COLORS.has(color)) {
    if (iconName) {
      return resolveSemanticColorForIcon(iconName, isDark);
    }
    return isDark ? '#06B6D4' : DEFAULT_SEMANTIC_COLOR;
  }
  
  return color;
}

/**
 * Get category for an icon name.
 */
export function getCategoryForIcon(iconName: string): SemanticCategory | null {
  return ICON_TO_CATEGORY[iconName] || null;
}
