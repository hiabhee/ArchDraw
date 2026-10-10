import { readFileSync } from 'fs';
import { join } from 'path';
import type { ComponentDefinition, NodeTypeSummary, TierType } from '../types/index.js';
import { TIER_COLORS } from './constants.js';

let cachedComponents: ComponentDefinition[] | null = null;

export function getComponents(): ComponentDefinition[] {
  if (cachedComponents) {
    return cachedComponents;
  }

  try {
    const componentsPath = join(__dirname, '..', '..', '..', 'frontend', 'data', 'components.json');
    const content = readFileSync(componentsPath, 'utf-8');
    cachedComponents = JSON.parse(content) as ComponentDefinition[];
    return cachedComponents;
  } catch (error) {
    console.error('[NodeCatalog] Failed to load components.json:', error);
    return [];
  }
}

export function getComponentsByCategory(): NodeTypeSummary {
  const components = getComponents();
  const categoryMap = new Map<string, ComponentDefinition[]>();

  for (const component of components) {
    const category = component.category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(component);
  }

  const categories = Array.from(categoryMap.entries())
    .map(([name, comps]) => ({
      name,
      count: comps.length,
      nodes: comps.map(n => ({
        id: n.id,
        label: n.label,
        icon: n.icon,
        description: n.description,
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    categories,
    totalCount: components.length,
  };
}

export function searchComponents(query: string, limit: number = 50): ComponentDefinition[] {
  const components = getComponents();
  const lowerQuery = query.toLowerCase();

  const results = components.filter(c =>
    c.label.toLowerCase().includes(lowerQuery) ||
    c.description.toLowerCase().includes(lowerQuery) ||
    c.category.toLowerCase().includes(lowerQuery) ||
    c.id.toLowerCase().includes(lowerQuery)
  );

  return results.slice(0, limit);
}

export function getComponentsByTier(tier: TierType): ComponentDefinition[] {
  const components = getComponents();
  const tierCategories: Record<TierType, string[]> = {
    client: ['Client & Entry'],
    edge: ['Client & Entry'],
    compute: ['Compute', 'AI Agents', 'LLM Models', 'RAG', 'Vector Databases', 'ML Infrastructure', 'ML Serving', 'MLOps', 'LLM Ops', 'AI Frameworks', 'AI Data Pipeline', 'Speech & Audio', 'Vision AI', 'Real-time'],
    async: ['Messaging & Events'],
    data: ['Data Storage', 'Caching'],
    observe: ['Observability'],
    external: ['External Services'],
  };

  const validCategories = tierCategories[tier] || [];
  return components.filter(c => validCategories.includes(c.category));
}

export function getTierFromCategory(category: string): TierType | null {
  const categoryToTier: Record<string, TierType> = {
    'Client & Entry': 'client',
    'Compute': 'compute',
    'Data Storage': 'data',
    'Caching': 'data',
    'Messaging & Events': 'async',
    'Auth & Security': 'compute',
    'Observability': 'observe',
    'AI / ML': 'compute',
    'External Services': 'external',
    'DevOps / Infra': 'compute',
    'AI Agents': 'compute',
    'LLM Models': 'compute',
    'RAG': 'compute',
    'Vector Databases': 'data',
    'ML Infrastructure': 'compute',
    'ML Serving': 'compute',
    'MLOps': 'compute',
    'LLM Ops': 'compute',
    'AI Frameworks': 'compute',
    'AI Data Pipeline': 'compute',
    'Speech & Audio': 'compute',
    'Vision AI': 'compute',
    'Real-time': 'compute',
  };

  return categoryToTier[category] || null;
}

export function getTierColor(tier: TierType): string {
  return TIER_COLORS[tier] || '#3b82f6';
}

export function getLayerFromTier(tier: TierType): string {
  return tier;
}

export function normalizeLayer(layer: string): string {
  const layerMap: Record<string, string> = {
    'presentation': 'client',
    'gateway': 'edge',
    'application': 'compute',
    'orchestration': 'compute',
    'data': 'data',
    'observability': 'observe',
    'external': 'external',
    'client': 'client',
    'edge': 'edge',
    'compute': 'compute',
    'async': 'async',
    'observe': 'observe',
    'group': 'group',
  };
  return layerMap[layer.toLowerCase()] || 'compute';
}
