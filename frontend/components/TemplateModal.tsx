'use client';

import { useState } from 'react';
import { X, Search, LayoutTemplate } from 'lucide-react';
import { TEMPLATES, type Template } from '@/data/templates/index';
import { useDiagramStore } from '@/store/diagramStore';
import { getLayoutedElements } from '@/lib/layoutUtils';
import { toast } from 'sonner';

interface Props { onClose: () => void }

export function TemplateModal({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const { nodes, loadTemplate, fitView, addCanvas } = useDiagramStore();
  const renameCanvas = useDiagramStore((s) => s.renameCanvas);

  const filtered = TEMPLATES.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
  );

  const handleLoad = (t: Template) => {
    const { nodes: ln, edges: le } = getLayoutedElements(t.nodes, t.edges, 'LR');
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
    apply(t, ln, le);
  };

  const apply = (t: Template, ln = getLayoutedElements(t.nodes, t.edges, 'LR').nodes, le = getLayoutedElements(t.nodes, t.edges, 'LR').edges) => {
    const { activeCanvasId } = useDiagramStore.getState();
    renameCanvas(activeCanvasId, t.name);
    loadTemplate(ln, le);
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
                <TemplateRow key={t.id} template={t} onLoad={() => handleLoad(t)} />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TemplateRow({ template, onLoad }: { template: Template; onLoad: () => void }) {
  return (
    <div 
      onClick={onLoad}
      className="group flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-secondary/40 dark:hover:bg-secondary/25 border border-transparent hover:border-border/15 transition-all duration-200 cursor-pointer"
    >
      {/* Icon */}
      <div className="w-12 h-12 shrink-0 rounded-xl bg-secondary/80 border border-border/10 flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-transform duration-200">
        {template.icon}
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
          onLoad();
        }}
        className="shrink-0 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-sm hover:shadow transition-all duration-200 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        Load
      </button>
    </div>
  );
}
