'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X, Command, Layers, FileText, ArrowRight } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { componentRegistry, type ComponentDefinition } from '@/lib/componentRegistry';
import { createNode } from '@/lib/factory';
import { getViewportCenter } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const SERVICE_TYPE_MAP: Record<string, string> = {
  // Queue types
  'message_queue': 'queue',
  'event_bus': 'queue',
  'kafka_streaming': 'queue',
  // Database types
  'sql_db': 'database',
  'nosql_db': 'database',
  'graph_database': 'database',
  'object_storage': 'database',
  'data_warehouse': 'database',
  'in_memory_cache': 'database',
  'cdn_cache': 'database',
  'app_cache': 'database',
  // Load balancer types
  'load_balancer': 'load-balancer',
  'reverse_proxy': 'load-balancer',
  // External service types
  'email_service': 'external-service',
  'payment_gateway': 'external-service',
  'sms_push': 'external-service',
  'maps_api': 'external-service',
  'third_party_api': 'external-service',
  // Observability types
  'logger': 'observability',
  'metrics_collector': 'observability',
  'tracing_service': 'observability',
  'alert_manager': 'observability',
  'dashboard': 'observability',
  'otel_collector': 'observability',
  // Client types
  'client_web': 'client',
  'client_mobile': 'client',
  'api_gateway': 'load-balancer',
  'cdn': 'external-service',
  'dns': 'external-service',
  'bff_gateway': 'load-balancer',
  // Service types
  'microservice': 'service',
  'serverless_fn': 'service',
  'worker_job': 'service',
  'container': 'service',
  // AI / ML types
  'llm_api': 'ai',
  'openai': 'ai',
  'anthropic': 'ai',
  'anthropic_claude': 'ai',
  'gemini': 'ai',
  'claude': 'ai',
  'embedding_service': 'ai',
  'embedding_model': 'ai',
  'ml_model': 'ai',
  'sagemaker': 'ai',
  'huggingface': 'ai',
  // Server types
  'server_monolith': 'server',
  // Container types
  'docker': 'docker',
  // API types
  'graphql_federation': 'api',
  'graphql_subgraph': 'api',
  'rest_api': 'api',
};

let globalSearchVersion = 0;

function useCustomComponentListener() {
  const [version, setVersion] = useState(0);
  
  useEffect(() => {
    const handler = () => {
      globalSearchVersion++;
      setVersion(v => v + 1);
    };
    window.addEventListener('custom-component-added', handler);
    return () => window.removeEventListener('custom-component-added', handler);
  }, []);
  
  useEffect(() => {
    const handler = () => {
      globalSearchVersion++;
      setVersion(v => v + 1);
    };
    window.addEventListener('custom-component-deleted', handler);
    return () => window.removeEventListener('custom-component-deleted', handler);
  }, []);
  
  return version;
}

interface PaletteItem {
  id: string;
  type: 'component' | 'canvas' | 'action';
  label: string;
  subtitle?: string;
  data?: unknown;
  icon?: string;
  color?: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { addNode, addCanvas, canvases } = useDiagramStore();
  
  const registryVersion = useCustomComponentListener();
  const version = registryVersion + globalSearchVersion;

  useEffect(() => {
    const handler = () => {
      globalSearchVersion++;
    };
    window.addEventListener('custom-component-added', handler);
    return () => window.removeEventListener('custom-component-added', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return [];
    return componentRegistry.search(search);
  }, [search, version]);

  const recentCanvases = useMemo(() => {
    return [...canvases]
      .sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0))
      .slice(0, 3);
  }, [canvases]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setSearch('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      globalSearchVersion++;
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && open) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, open]);

  const handleSelectComponent = useCallback((comp: ComponentDefinition) => {
    const serviceType = SERVICE_TYPE_MAP[comp.id] || (comp.category?.toLowerCase().includes('messaging') || comp.category?.toLowerCase().includes('queue') ? 'queue' : comp.category?.toLowerCase().includes('ai') || comp.category?.toLowerCase().includes('ml') ? 'ai' : undefined);
    const node = createNode(
      comp.id,
      comp.label,
      getViewportCenter(),
      {
        type: 'systemNode',
        data: {
          componentId: comp.id,
          category: comp.category,
          color: comp.color,
          icon: comp.icon,
          technology: comp.technology,
          serviceType,
        }
      }
    );
    addNode(node);
    setOpen(false);
    setSearch('');
  }, [addNode]);

  const handleCreateComponent = useCallback(() => {
    setOpen(false);
    router.push('/editor');
  }, [router]);

  const handleOpenDashboard = useCallback(() => {
    setOpen(false);
    router.push('/dashboard');
  }, [router]);

  const handleOpenTemplates = useCallback(() => {
    setOpen(false);
    router.push('/templates');
  }, [router]);

  const handleOpenCanvas = useCallback((id: string) => {
    setOpen(false);
    router.push(`/editor?canvas=${id}`);
  }, [router]);

  const handleCreateCanvas = useCallback(() => {
    const newId = addCanvas();
    setOpen(false);
    router.push(`/editor?canvas=${newId}`);
  }, [addCanvas, router]);

  // Build display items with sections
  const { sections, flatItems } = useMemo(() => {
    const items: PaletteItem[] = [];
    const sectionsArray: { title: string; items: PaletteItem[] }[] = [];

    if (search && filtered.length > 0) {
      const components: PaletteItem[] = filtered.slice(0, 4).map(comp => ({
        id: `comp-${comp.id}`,
        type: 'component',
        label: comp.label,
        subtitle: comp.category,
        data: comp,
        color: comp.color,
      }));
      sectionsArray.push({ title: 'Components', items: components });
      items.push(...components);
    }

    if (!search && recentCanvases.length > 0) {
      const canvasesItems: PaletteItem[] = recentCanvases.map(c => ({
        id: `canvas-${c.id}`,
        type: 'canvas',
        label: c.name,
        subtitle: `${c.nodes?.length || 0} nodes · ${c.edges?.length || 0} edges`,
        data: { id: c.id, nodes: c.nodes, edges: c.edges },
      }));
      sectionsArray.push({ title: 'Recent', items: canvasesItems });
      items.push(...canvasesItems);
    }

    // Actions section
    const actions: PaletteItem[] = [];
    
    if (search) {
      actions.push({
        id: 'action-create-comp',
        type: 'action',
        label: 'Create component',
        subtitle: 'Add a custom component to the library',
        data: { action: 'create-component' },
      });
    }
    
    actions.push({
      id: 'action-create-canvas',
      type: 'action',
      label: 'Create new canvas',
      subtitle: 'Start with a blank canvas',
      data: { action: 'create-canvas' },
    });
    
    actions.push({
      id: 'action-templates',
      type: 'action',
      label: 'Browse templates',
      subtitle: 'Start from a pre-built architecture',
      data: { action: 'templates' },
    });
    
    actions.push({
      id: 'action-dashboard',
      type: 'action',
      label: 'Go to dashboard',
      subtitle: 'View all your canvases',
      data: { action: 'dashboard' },
    });

    sectionsArray.push({ title: 'Actions', items: actions });
    items.push(...actions);

    return { sections: sectionsArray, flatItems: items };
  }, [search, filtered, recentCanvases]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item.type === 'component') {
        handleSelectComponent(item.data as ComponentDefinition);
      } else if (item.type === 'canvas') {
        handleOpenCanvas((item.data as { id: string }).id);
      } else if (item.type === 'action') {
        const action = (item.data as { action: string }).action;
        if (action === 'create-canvas') handleCreateCanvas();
        else if (action === 'dashboard') handleOpenDashboard();
        else if (action === 'templates') handleOpenTemplates();
        else if (action === 'create-component') handleCreateComponent();
      }
    }
  };

  const handleItemClick = (item: PaletteItem) => {
    if (item.type === 'component') {
      handleSelectComponent(item.data as ComponentDefinition);
    } else if (item.type === 'canvas') {
      handleOpenCanvas((item.data as { id: string }).id);
    } else if (item.type === 'action') {
      const action = (item.data as { action: string }).action;
      if (action === 'create-canvas') handleCreateCanvas();
      else if (action === 'dashboard') handleOpenDashboard();
      else if (action === 'templates') handleOpenTemplates();
      else if (action === 'create-component') handleCreateComponent();
    }
  };

  const getItemIcon = (type: string, color?: string) => {
    if (type === 'component') {
      return (
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium"
          style={{ background: color || '#E0E0E0' }}
        >
          <Layers className="w-4 h-4 text-white" />
        </div>
      );
    }
    if (type === 'canvas') {
      return (
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: '#F2F2F2' }}
        >
          <FileText className="w-4 h-4" style={{ color: '#6B6B6B' }} />
        </div>
      );
    }
    return (
      <div 
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: '#EDE9FE' }}
      >
        <ArrowRight className="w-4 h-4" style={{ color: '#595959' }} />
      </div>
    );
  };

  let globalIndex = -1;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.4)' }} onClick={() => setOpen(false)} />

      {/* Palette */}
      <div 
        className="relative w-full max-w-lg mx-4 overflow-hidden"
        style={{ 
          background: 'white', 
          borderRadius: 24,
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Search input - pill shape */}
        <div className="flex items-center gap-3 px-5 py-4">
          <Search className="w-5 h-5 shrink-0" style={{ color: '#B0B0B0' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search components, canvases, actions..."
            className="flex-1 py-2 text-base bg-transparent border-none outline-none"
            style={{ color: '#1A1A1A' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" style={{ color: '#B0B0B0' }} />
            </button>
          )}
        </div>

        {/* Results */}
        <div 
          ref={listRef}
          className="max-h-[400px] overflow-y-auto"
        >
          {flatItems.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm" style={{ color: '#6B6B6B' }}>
                {search ? 'No results found' : 'Start typing to search...'}
              </p>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.title} className="pb-2">
              {/* Section header */}
              <div className="sticky top-0 px-5 py-2" style={{ background: 'white' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#B0B0B0' }}>
                  {section.title}
                </p>
              </div>
              
              {/* Section items */}
              <div className="px-3">
                {section.items.map((item) => {
                  globalIndex++;
                  const idx = globalIndex;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={() => handleItemClick(item)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-[14px] transition-all duration-150 ${
                        idx === selectedIndex 
                          ? 'bg-gray-100' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {getItemIcon(item.type, item.color)}
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>
                          {item.label}
                        </p>
                        {item.subtitle && (
                          <p className="text-xs truncate" style={{ color: '#6B6B6B' }}>
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                      {item.type === 'canvas' && (
                        <div 
                          className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#F2F2F2', color: '#6B6B6B' }}
                        >
                          Canvas
                        </div>
                      )}
                      {idx === selectedIndex && (
                        <ArrowRight className="w-4 h-4 shrink-0" style={{ color: '#6B6B6B' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div 
          className="flex items-center justify-between px-5 py-3 text-[10px] border-t"
          style={{ background: '#FAFAFA', borderColor: '#F2F2F2', color: '#6B6B6B' }}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded font-medium" style={{ background: 'white', color: '#6B6B6B' }}>↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded font-medium" style={{ background: 'white', color: '#6B6B6B' }}>↵</kbd> select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" />K
          </span>
        </div>
      </div>
    </div>
  );
}
