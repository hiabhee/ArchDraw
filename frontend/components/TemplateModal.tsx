'use client';

import { useState } from 'react';
import type { Node, Edge } from 'reactflow';
import { X, Search, LayoutTemplate, Lock } from 'lucide-react';
import { TEMPLATES, type Template } from '@/data/templates/index';
import { useDiagramStore } from '@/store/diagramStore';
import { useAuthStore } from '@/store/authStore';
import { layoutDiagramViaMermaid } from '@/lib/mermaid/relayout';
import { toast } from 'sonner';
import { getUserTier, isTemplateAllowed } from '@/lib/userQuotas';
import { UpgradeModal, UPGRADE_BENEFITS } from '@/components/UpgradeModal';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface Props { onClose: () => void }

export function TemplateModal({ onClose }: Props) {
  useBodyScrollLock(true);
  const [query, setQuery] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { nodes, loadTemplate, fitView, addCanvas } = useDiagramStore();
  const renameCanvas = useDiagramStore((s) => s.renameCanvas);
  const setActiveLayoutPresetId = useDiagramStore((s) => s.setActiveLayoutPresetId);
  const { user } = useAuthStore();
  const tier = getUserTier(user?.id);

  const filtered = TEMPLATES.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
  );

  /** Same Mermaid → Dagre path as the toolbar layout toggler. */
  const layoutTemplate = async (t: Template): Promise<{ nodes: Node[]; edges: Edge[] }> => {
    const result = await layoutDiagramViaMermaid(t.nodes, t.edges, 'LR', { title: t.name });
    if (!result.success) {
      toast.error(`Layout failed: ${result.warnings.join('; ') || 'unknown error'}`);
      return { nodes: t.nodes, edges: t.edges };
    }
    return { nodes: result.nodes, edges: result.edges };
  };

  const handleLoad = async (t: Template) => {
    setLoadingId(t.id);
    try {
      const { nodes: ln, edges: le } = await layoutTemplate(t);
      setActiveLayoutPresetId('layered-lr');
      if (nodes.length > 0) {
        addCanvas();
        setTimeout(() => {
          const { activeCanvasId } = useDiagramStore.getState();
          useDiagramStore.getState().renameCanvas(activeCanvasId, t.name);
          useDiagramStore.getState().loadTemplate(ln, le);
          setTimeout(() => useDiagramStore.getState().fitView(), 80);
        }, 0);
        toast.success(`"${t.name}" loaded in new tab`);
        onClose();
        return;
      }
      await apply(t, ln, le);
    } finally {
      setLoadingId(null);
    }
  };

  const apply = async (t: Template, ln?: Node[], le?: Edge[]) => {
    const result = (ln && le) ? { nodes: ln, edges: le } : await layoutTemplate(t);
    const { activeCanvasId } = useDiagramStore.getState();
    renameCanvas(activeCanvasId, t.name);
    loadTemplate(result.nodes, result.edges);
    setActiveLayoutPresetId('layered-lr');
    setTimeout(() => fitView(), 80);
    toast.success(`"${t.name}" loaded`);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Panel */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
        onClick={onClose}
      >
        <div
          className="pointer-events-auto w-full max-w-xl bg-card border border-border/20 rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          style={{ maxHeight: '80vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 shrink-0 border-b border-border/10">
            <div className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center border border-border/10">
              <LayoutTemplate className="w-5 h-5 text-foreground/80" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Templates</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Load a pre-built architecture to get started</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-4 shrink-0 border-b border-border/5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates…"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-secondary/50 dark:bg-secondary/30 border border-border/10 rounded-xl outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 text-foreground placeholder:text-muted-foreground/50 transition-all duration-200"
              />
            </div>
          </div>

          {/* Template list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm">No templates match &quot;{query}&quot;</p>
              </div>
            ) : (
              filtered.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  isLocked={!isTemplateAllowed(tier, t.id)}
                  isLoading={loadingId === t.id}
                  disabled={loadingId !== null}
                  onLoad={() => handleLoad(t)}
                  onUpgrade={() => setShowUpgrade(true)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="templates"
        message="Sign in to access all architecture templates"
        benefits={UPGRADE_BENEFITS.templates}
      />
    </>
  );
}

function TemplateRow({
  template,
  isLocked,
  isLoading,
  disabled,
  onLoad,
  onUpgrade,
}: {
  template: Template;
  isLocked?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  onLoad: () => void;
  onUpgrade?: () => void;
}) {
  const handleClick = () => {
    if (disabled) return;
    isLocked ? onUpgrade?.() : onLoad();
  };

  return (
    <div
      onClick={handleClick}
      className={`group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 border border-transparent ${
        disabled && !isLoading
          ? 'opacity-40 pointer-events-none'
          : isLocked
            ? 'opacity-60 hover:bg-secondary/20 hover:border-border/10 cursor-pointer'
            : 'hover:bg-secondary/40 dark:hover:bg-secondary/25 hover:border-border/15 cursor-pointer'
      }`}
    >
      {/* Icon */}
      <div className="w-12 h-12 shrink-0 rounded-xl bg-secondary/80 border border-border/10 flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-transform duration-200 relative">
        {template.icon}
        {isLocked && (
          <div className="absolute -top-1 -right-1 bg-gray-800 rounded-full p-1">
            <Lock className="w-3 h-3 text-gray-400" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{template.name}</p>
        <p className="text-[11px] text-muted-foreground/90 mt-0.5 line-clamp-1 leading-relaxed">{template.description}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[9px] font-medium rounded-md bg-secondary border border-border/10 text-muted-foreground/80"
            >
              {tag}
            </span>
          ))}
          <span className="text-[10px] text-muted-foreground/50 ml-auto group-hover:text-muted-foreground transition-colors font-mono">
            {template.nodes.length} nodes
          </span>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        disabled={disabled}
        className={`shrink-0 px-4 py-2 text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all duration-200 ${
          isLocked
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-[#1E90FF] hover:bg-[#4dabf7] active:scale-98 text-white'
        }`}
      >
        {isLocked ? 'Sign in' : isLoading ? 'Laying out…' : 'Load'}
      </button>
    </div>
  );
}
