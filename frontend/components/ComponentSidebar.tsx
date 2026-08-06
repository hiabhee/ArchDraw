'use client';

import { useState, useEffect } from 'react';
import { Plus, PanelLeft, Blocks, Layers, Square, Search } from 'lucide-react';
import { CreateComponentModal, COMPONENT_TYPES, type CreateComponentData } from './CreateComponentModal';
import { componentRegistry, CORE_COMPONENTS, AWS_COMPONENTS, DB_COMPONENTS, SERVICES_COMPONENTS } from '@/lib/componentRegistry';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDiagramStore } from '@/store/diagramStore';
import { createPaletteNode, isBlankInitComponent } from '@/lib/factory';
import { getViewportCenter } from '@/lib/utils';

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

interface ComponentEntry {
  id: string;
  label: string;
  category: string;
  color: string;
  icon?: string;
  technology?: string;
  description?: string;
  isCustom?: boolean;
}

function makeDragGhost(label: string) {
  const ghost = document.createElement('div');
  ghost.style.cssText = `position:fixed;top:-100px;left:-100px;background:hsl(var(--card));border-radius:10px;padding:8px 14px;font-size:12px;font-weight:500;color:hsl(var(--foreground));white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,0.12);pointer-events:none;`;
  ghost.textContent = label;
  return ghost;
}

const TOP_SECTIONS = [
  { key: 'general', title: 'General' },
  { key: 'aws', title: 'AWS' },
  { key: 'databases', title: 'Databases' },
  { key: 'devtools', title: 'Tools' },
  { key: 'services', title: 'Services' },
  { key: 'ai', title: 'AI & ML' },
];

interface SidebarButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}

function SidebarButton({ icon, label, active, onClick }: SidebarButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="w-11 h-11 rounded-[12px] flex items-center justify-center transition-all duration-200"
        style={{
          background: active ? 'hsl(var(--accent))' : 'transparent',
        }}
      >
        {icon}
      </button>
      {isHovered && (
        <div className="absolute left-full ml-2 px-3 py-1.5 rounded-[8px] text-xs font-medium whitespace-nowrap pointer-events-none bg-popover text-popover-foreground">
          {label}
        </div>
      )}
    </div>
  );
}

interface ComponentSidebarProps {
  onOpenCreateModal?: () => void;
}

export function ComponentSidebar({ onOpenCreateModal }: ComponentSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customComponents, setCustomComponents] = useState<ComponentEntry[]>(() => componentRegistry.getCustomComponents() as ComponentEntry[]);
  const [activeSection, setActiveSection] = useState<string>('general');

  const q = search.toLowerCase();

  const getSectionData = (section: string): ComponentEntry[] => {
    switch (section) {
      case 'general': return CORE_COMPONENTS as ComponentEntry[];
      case 'aws': return AWS_COMPONENTS as ComponentEntry[];
      case 'databases': return DB_COMPONENTS as ComponentEntry[];
      case 'devtools': return [];
      case 'services': return SERVICES_COMPONENTS as ComponentEntry[];
      case 'custom': return customComponents;
      default: return [];
    }
  };

  const filteredComponents = q 
    ? [...customComponents, ...CORE_COMPONENTS, ...AWS_COMPONENTS, ...DB_COMPONENTS, ...SERVICES_COMPONENTS]
        .filter(c => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
        .slice(0, 30)
    : getSectionData(activeSection).slice(0, 15);

  const handleAdd = (comp: ComponentEntry) => {
    const center = getViewportCenter();
    const serviceType = SERVICE_TYPE_MAP[comp.id] || (comp.category?.toLowerCase().includes('messaging') || comp.category?.toLowerCase().includes('queue') ? 'queue' : comp.category?.toLowerCase().includes('ai') || comp.category?.toLowerCase().includes('ml') ? 'ai' : undefined);
    const blank = isBlankInitComponent(comp.id);
    const node = createPaletteNode(comp, center, { serviceType, blankInit: blank });
    if (node) {
      const store = useDiagramStore.getState();
      store.pushHistory();
      store.importDiagram([...store.nodes, node], store.edges);
      if (blank) {
        store.setSelectedNodeId(node.id);
        store.setSelectedNodeIds([node.id]);
      }
    }
  };

  return (
    <>
      {/* Collapsed - Floating Tool Panel */}
      {!isExpanded && (
        <div
          className="fixed z-40 flex flex-col items-center py-3 px-2 bg-card left-2 top-auto bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] sm:left-4 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2"
          style={{
            width: 60,
            borderRadius: 20,
            boxShadow: '0 10px 40px hsl(var(--foreground) / 0.06)',
            gap: 3,
          }}
        >
          <SidebarButton
            icon={<Blocks className="w-5 h-5 text-foreground" />}
            label="Components"
            onClick={() => { setIsExpanded(true); }}
          />

          <SidebarButton
            icon={<Layers className="w-5 h-5 text-muted-foreground" />}
            label="Layers"
            onClick={() => {}}
          />

          <SidebarButton
            icon={<Square className="w-5 h-5 text-muted-foreground" />}
            label="Shapes"
            onClick={() => {}}
          />

          <div className="w-8 h-px my-2 bg-border" />

          <SidebarButton
            icon={<Plus className="w-5 h-5 text-muted-foreground" />}
            label="Add"
            onClick={() => onOpenCreateModal?.()}
          />
        </div>
      )}

      {/* Expanded Panel */}
      {isExpanded && (
        <div
          className="fixed z-40 flex flex-col overflow-hidden bg-card inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] top-auto sm:left-4 sm:right-auto sm:top-1/2 sm:-translate-y-1/2 sm:bottom-auto sm:w-[280px] sm:max-h-[calc(100vh-180px)]"
          style={{
            maxHeight: 'calc(100dvh - 120px)',
            borderRadius: 20,
            boxShadow: '0 10px 40px hsl(var(--foreground) / 0.06)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Blocks className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Components</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              aria-label="Collapse components panel"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-[10px] transition-colors hover:bg-brand-bg text-muted-foreground"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative px-4 py-3">
            <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              className="pl-9 h-9 rounded-xl text-sm w-full bg-background"
              style={{ border: 'none' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Section Tabs */}
          {!q && (
            <div className="flex gap-1 px-4 pb-2 overflow-x-auto">
              {TOP_SECTIONS.slice(0, 4).map((section) => (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-xs font-medium whitespace-nowrap transition-all ${
                    activeSection === section.key ? 'bg-brand text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </div>
          )}

          {/* Component List */}
          <div className="flex-1 overflow-y-auto mt-2 px-3 pb-3">
            {customComponents.length > 0 && !q && activeSection !== 'general' && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Custom</span>
                </div>
                {customComponents.map((comp) => (
                  <div
                    key={comp.id}
                    className="group flex items-center gap-2 px-2 py-2 rounded-[10px] text-sm transition-all cursor-grab hover:bg-brand text-foreground"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/archdraw', JSON.stringify(comp));
                      e.dataTransfer.effectAllowed = 'move';
                      const ghost = makeDragGhost(comp.label);
                      document.body.appendChild(ghost);
                      e.dataTransfer.setDragImage(ghost, 0, 0);
                      setTimeout(() => document.body.removeChild(ghost), 0);
                    }}
                    onClick={() => handleAdd(comp)}
                  >
                    <div
                      className="w-7 h-7 rounded-[8px] flex items-center justify-center text-white text-xs font-medium"
                      style={{ background: comp.color }}
                    >
                      {comp.label.charAt(0)}
                    </div>
                    <span className="flex-1 truncate">{comp.label}</span>
                  </div>
                ))}
              </div>
            )}

            {filteredComponents.map((comp) => (
              <div
                key={comp.id}
                className="group flex items-center gap-2 px-2 py-2 rounded-[10px] text-sm transition-all cursor-grab hover:bg-brand text-foreground"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/archdraw', JSON.stringify(comp));
                  e.dataTransfer.effectAllowed = 'move';
                  const ghost = makeDragGhost(comp.label);
                  document.body.appendChild(ghost);
                  e.dataTransfer.setDragImage(ghost, 0, 0);
                  setTimeout(() => document.body.removeChild(ghost), 0);
                }}
                onClick={() => handleAdd(comp)}
              >
                <div
                  className="w-7 h-7 rounded-[8px] flex items-center justify-center text-white text-xs font-medium"
                  style={{ background: comp.color }}
                >
                  {comp.label.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{comp.label}</div>
                  <div className="text-[10px] text-muted-foreground">{comp.category}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border">
            <Button
              className="w-full justify-center gap-2 h-10 rounded-[12px] text-sm font-medium bg-brand text-foreground"
              style={{ border: 'none' }}
              onClick={() => { setShowCreateModal(true); }}
            >
              <Plus className="w-4 h-4" />
              New component
            </Button>
          </div>
        </div>
      )}

      <CreateComponentModal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); }}
        onCreate={(data: CreateComponentData) => {
          const typeInfo = COMPONENT_TYPES.find(t => t.id === data.type);
          const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          componentRegistry.addCustomComponent({
            id,
            label: data.name,
            category: typeInfo?.label || 'Other',
            color: typeInfo?.color || '#6B7280',
            description: data.description,
            technology: 'custom',
          });
          setCustomComponents(componentRegistry.getCustomComponents() as ComponentEntry[]);
          setShowCreateModal(false);
          window.dispatchEvent(new CustomEvent('custom-component-added'));
        }}
        existingNames={componentRegistry.getAll().map(c => c.label)}
      />
    </>
  );
}
