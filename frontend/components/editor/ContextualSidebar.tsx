'use client';

import { useState, useMemo } from 'react';
import { X, Type, Layers, ExternalLink, ChevronRight, Info, Zap, Trash2, Pencil } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { useTutorialStore } from '@/store/tutorialStore';
import { componentKnowledgeBase, getComponentKnowledge } from '@/lib/knowledge/componentKnowledge';
import { TIER_THEME } from '@/lib/tierColors';
import type { TierType } from '@/lib/theme/stylingConstants';

interface ContextualSidebarProps {
  nodeId: string;
  onClose: () => void;
}

export function ContextualSidebar({ nodeId, onClose }: ContextualSidebarProps) {
  const { nodes, updateNodeData, removeNode } = useDiagramStore();
  const node = nodes.find(n => n.id === nodeId);
  const [isEditing, setIsEditing] = useState(false);
  
  const knowledge = useMemo(() => {
    if (!node) return null;
    return getComponentKnowledge(node.data.label) || 
           getComponentKnowledge((node.data as Record<string, unknown>).componentType as string || '') || 
           null;
  }, [node]);

  if (!node) return null;

  const tier = (node.data.layer || 'compute').toLowerCase() as TierType;
  const theme = TIER_THEME[tier] || TIER_THEME.compute;

  return (
    <aside 
      className="fixed top-20 right-4 w-80 max-h-[calc(100vh-100px)] overflow-y-auto z-40 bg-card rounded-2xl shadow-2xl border border-border animate-in slide-in-from-right-4 duration-300 sm:max-w-xs max-w-[calc(100vw-32px)]"
    >
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ background: node.data.color || theme.main }}
          >
            {node.data.label?.[0]?.toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground truncate max-w-[180px]">
              {node.data.label}
            </h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {node.data.category}
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Quick Actions */}
        <div className="flex gap-2">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent hover:bg-accent/80 text-xs font-medium transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button 
            onClick={() => { removeNode(nodeId); onClose(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>

        {/* Description / Metadata */}
        <div className="space-y-4">
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Overview</h4>
            </div>
            {isEditing ? (
              <textarea
                value={node.data.description || ''}
                onChange={(e) => updateNodeData(nodeId, { description: e.target.value })}
                className="w-full p-3 rounded-xl bg-accent/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                rows={3}
                placeholder="What does this service do?"
              />
            ) : (
              <p className="text-sm text-foreground/80 leading-relaxed italic">
                {node.data.description || 'No description provided.'}
              </p>
            )}
          </section>

          {knowledge && (
            <>
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Why it matters</h4>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {knowledge.whyItMatters || knowledge.purpose}
                </p>
              </section>

              {knowledge.concepts && knowledge.concepts.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Key Concepts</h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {knowledge.concepts.map(concept => (
                      <span 
                        key={concept}
                        className="px-2 py-0.5 rounded-md bg-accent text-[10px] text-muted-foreground border border-border/50"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Links / Resources */}
        {knowledge?.realWorldFact && (
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
            <h5 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Real-world Insight
            </h5>
            <p className="text-xs text-foreground/70 leading-relaxed">
              {knowledge.realWorldFact}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
