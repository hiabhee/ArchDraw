import componentsData from '@/data/components.json';
import awsData from '@/data/aws-components.json';
import dbData from '@/data/db-components.json';
import servicesData from '@/data/services-components.json';
import logger from '@/lib/logger';
import { STORAGE_KEYS } from '@/lib/config';
import type { Node } from 'reactflow';
import { fetchComponentTemplatesByIds, fetchAllComponentTemplates } from '@/lib/api-client';


export interface ComponentDefinition {
  id: string;
  label: string;
  category: string;
  color: string;
  icon?: string;
  technology?: string;
  description?: string;
  isCustom?: boolean;
}

export const CORE_COMPONENTS = componentsData as ComponentDefinition[];
export const AWS_COMPONENTS = awsData as ComponentDefinition[];
export const DB_COMPONENTS = dbData as ComponentDefinition[];
export const SERVICES_COMPONENTS = servicesData as ComponentDefinition[];

const ALL_COMPONENTS: ComponentDefinition[] = [
  ...CORE_COMPONENTS,
  ...AWS_COMPONENTS,
  ...DB_COMPONENTS,
  ...SERVICES_COMPONENTS,
];

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  technology: string | null;
  category: { name: string } | null;
}

class ComponentRegistry {
  private components = new Map<string, ComponentDefinition>();
  private customComponents = new Map<string, ComponentDefinition>();
  private syncedAt = 0;
  private cacheVersion = 1;

  constructor() {
    ALL_COMPONENTS.forEach(comp => this.components.set(comp.id, comp));
    this.loadCustomComponents();
    if (typeof window !== 'undefined') {
      this.backgroundRefresh().catch(() => {});
    }
  }

  private loadCustomComponents() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.customComponents);
      if (saved) {
        const parsed = JSON.parse(saved);
        let custom: ComponentDefinition[] = [];
        if (Array.isArray(parsed)) {
          custom = parsed;
          this.syncedAt = 0;
          this.cacheVersion = 1;
        } else if (parsed && typeof parsed === 'object') {
          custom = parsed.components || [];
          this.syncedAt = parsed.syncedAt || 0;
          this.cacheVersion = parsed.cacheVersion || 1;
        }
        custom.forEach(comp => this.customComponents.set(comp.id, { ...comp, isCustom: true }));
      }
    } catch (e) {
      logger.error('Failed to load custom components:', e);
    }
  }

  private saveCustomComponents() {
    if (typeof window === 'undefined') return;
    try {
      const custom = Array.from(this.customComponents.values());
      const data = {
        syncedAt: this.syncedAt || Date.now(),
        cacheVersion: this.cacheVersion || 1,
        components: custom,
      };
      localStorage.setItem(STORAGE_KEYS.customComponents, JSON.stringify(data));
    } catch (e) {
      logger.error('Failed to save custom components:', e);
    }
  }

  async ensureCustomComponentsForNodes(nodes: Node[]) {
    if (typeof window === 'undefined') return;
    const ids = new Set<string>();
    nodes.forEach(node => {
      const typeId = node.data?.typeId as string | undefined;
      const compType = node.data?.componentType as string | undefined;
      if (typeId && !this.components.has(typeId) && !this.customComponents.has(typeId)) {
        ids.add(typeId);
      }
      if (compType && !this.components.has(compType) && !this.customComponents.has(compType)) {
        ids.add(compType);
      }
    });

    const idList = Array.from(ids);
    if (idList.length > 0 && process.env.DATABASE_URL) {
      try {
        const data = await fetchComponentTemplatesByIds(idList);
        
        if (data && data.length > 0) {
          (data as TemplateRow[]).forEach((row) => {
            const comp: ComponentDefinition = {
              id: row.id,
              label: row.name,
              category: row.category?.name || 'Other',
              color: row.color || '#94a3b8',
              icon: row.icon || undefined,
              technology: row.technology || undefined,
              description: row.description || undefined,
              isCustom: true,
            };
            this.customComponents.set(comp.id, comp);
          });
          this.saveCustomComponents();
        }
      } catch (err) {
        logger.error('Failed to fetch missing custom components:', err);
      }
    }
  }

  async backgroundRefresh() {
    if (typeof window === 'undefined') return;
    if (!process.env.DATABASE_URL) return;
    
    const age = Date.now() - (this.syncedAt || 0);
    if (age < 24 * 60 * 60 * 1000) {
      return;
    }

    try {
      const data = await fetchAllComponentTemplates();
      
      if (data && data.length > 0) {
        (data as TemplateRow[]).forEach((row) => {
          const comp: ComponentDefinition = {
            id: row.id,
            label: row.name,
            category: row.category?.name || 'Other',
            color: row.color || '#94a3b8',
            icon: row.icon || undefined,
            technology: row.technology || undefined,
            description: row.description || undefined,
            isCustom: true,
          };
          this.customComponents.set(comp.id, comp);
        });
        this.syncedAt = Date.now();
        this.saveCustomComponents();
      }
    } catch (err) {
      logger.error('Failed to refresh custom components in background:', err);
    }
  }

  get(id: string): ComponentDefinition | undefined {
    return this.customComponents.get(id) || this.components.get(id);
  }

  getAll(): ComponentDefinition[] {
    return [...Array.from(this.customComponents.values()), ...Array.from(this.components.values())];
  }

  getCustomComponents(): ComponentDefinition[] {
    return Array.from(this.customComponents.values());
  }

  addCustomComponent(comp: ComponentDefinition) {
    this.customComponents.set(comp.id, { ...comp, isCustom: true });
    this.saveCustomComponents();
  }

  updateCustomComponent(id: string, updates: Partial<ComponentDefinition>) {
    const existing = this.customComponents.get(id);
    if (existing) {
      this.customComponents.set(id, { ...existing, ...updates });
      this.saveCustomComponents();
    }
  }

  deleteCustomComponent(id: string) {
    this.customComponents.delete(id);
    this.saveCustomComponents();
  }

  search(query: string): ComponentDefinition[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    
    return this.getAll().filter(comp => 
      comp.label.toLowerCase().includes(q) || 
      comp.category.toLowerCase().includes(q) ||
      comp.technology?.toLowerCase().includes(q)
    );
  }
}

export const componentRegistry = new ComponentRegistry();

export function getTierFromLayer(layer: string): string {
  const l = layer.toLowerCase();
  if (l.includes('client') || l.includes('presentation')) return 'client';
  if (l.includes('gateway') || l.includes('edge')) return 'edge';
  if (l.includes('service') || l.includes('compute') || l.includes('application')) return 'compute';
  if (l.includes('async') || l.includes('queue') || l.includes('broker')) return 'async';
  if (l.includes('data') || l.includes('db') || l.includes('cache')) return 'data';
  if (l.includes('observe') || l.includes('monitor') || l.includes('log')) return 'observe';
  if (l.includes('external')) return 'external';
  return 'compute';
}

export function getLayerColor(layer: 'A' | 'B' | 'C' | 'D'): string {
  const colors: Record<string, string> = {
    A: '#5A5A5A',
    B: '#6FA8DC',
    C: '#D8AA59',
    D: '#9A8575',
  };
  return colors[layer] || '#5A5A5A';
}
