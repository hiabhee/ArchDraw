'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  Sparkles,
  Plus,
  FolderOpen,
  ChevronRight,
  GraduationCap,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useDiagramStore } from '@/store/diagramStore';
import { analytics } from '@/lib/analytics';
import type { Template } from '@/data/templates';

interface DashboardClientProps {
  templates: Template[];
  aiPrompts: string[];
}

export function DashboardClient({ templates, aiPrompts }: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initialized } = useAuthStore();
  const { canvases, addCanvas, switchCanvas } = useDiagramStore();
  const [now] = useState(() => Date.now());

  const handleNewCanvas = (fromTemplate?: string) => {
    analytics.track({
      event_type: 'click',
      event_name: 'new_canvas',
      page_path: window.location.pathname,
      payload: { from_template: fromTemplate || null },
    });
    if (fromTemplate) {
      router.push(`/editor?template=${fromTemplate}`);
    } else {
      addCanvas();
      router.push('/editor');
    }
  };

  const handleOpenCanvas = (id: string) => {
    analytics.track({
      event_type: 'click',
      event_name: 'open_canvas',
      page_path: window.location.pathname,
      payload: { canvas_id: id },
    });
    switchCanvas(id);
    router.push('/editor');
  };

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  const searchQuery = searchParams.get('q') || '';

  // Compute actual canvas metrics
  const totalCanvases = canvases.length;

  // Filter and sort actual canvases
  const filteredCanvases = Array.from(new Map(canvases.map(c => [c.id, c])).values())
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const sortedCanvases = filteredCanvases
    .sort((a, b) => {
      const aTime = a.lastAccessedAt || a.updatedAt || 0;
      const bTime = b.lastAccessedAt || b.updatedAt || 0;
      return bTime - aTime;
    });

  const displayCanvases = searchQuery ? sortedCanvases : sortedCanvases.slice(0, 4);

  // Dynamic formatting for relative time
  const getRelativeTime = (timestamp?: number) => {
    if (!timestamp) return 'Just now';
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Determine indicator color based on size
  const getIndicatorColor = (nodeCount: number) => {
    if (nodeCount === 0) return 'bg-gray-400';
    if (nodeCount < 5) return 'bg-[#3B82F6]';
    if (nodeCount < 10) return 'bg-[#10B981]';
    return 'bg-[#F59E0B]';
  };

  const checklistItems = [
    {
      title: 'Blank Canvas',
      desc: 'Start a system design layout from scratch',
      action: 'Create',
      icon: Plus,
      onClick: () => handleNewCanvas(),
    },
    {
      title: 'Architecture Templates',
      desc: 'Choose from 10+ pre-compiled diagram stacks',
      action: 'Browse',
      icon: FolderOpen,
      onClick: () => router.push('/dashboard/templates'),
    },
    {
      title: 'AI Generation',
      desc: 'Create diagrams in seconds using simple text prompts',
      action: 'Generate',
      icon: Sparkles,
      onClick: () => handleNewCanvas(),
    },
    {
      title: 'System Design Tutorials',
      desc: 'Interactive guides on learning standard topologies',
      action: 'Learn',
      icon: GraduationCap,
      onClick: () => router.push('/dashboard/learn'),
    },
    {
      title: 'Documentation',
      desc: 'Check keyboard shortcuts and system specs',
      action: 'Read',
      icon: BookOpen,
      onClick: () => router.push('/docs'),
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-[1280px] mx-auto">


      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        
        {/* LEFT COLUMN: Metrics, Chart, and Projects */}
        <div className="space-y-6">


          {/* Projects List */}
          <div className="border border-border-default rounded-xl p-5 bg-surface-panel shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-sm font-semibold text-text-primary">
                {searchQuery ? 'Matching Diagrams' : 'Recent Diagrams'}
              </h3>
              <button 
                onClick={() => router.push('/editor')}
                className="text-xs font-semibold text-accent hover:text-accent-hover flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {displayCanvases.length > 0 ? (
              <div className="divide-y divide-border-default/60">
                {displayCanvases.map((canvas) => {
                  const nodeCount = canvas.nodes?.length || 0;
                  const edgeCount = canvas.edges?.length || 0;
                  return (
                    <div
                      key={canvas.id}
                      onClick={() => handleOpenCanvas(canvas.id)}
                      className="flex items-center justify-between py-3.5 px-2 hover:bg-surface-page/60 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${getIndicatorColor(nodeCount)}`} />
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                            {canvas.name}
                          </h4>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {nodeCount} components • {edgeCount} connections
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-text-muted">
                          {getRelativeTime(canvas.lastAccessedAt || canvas.updatedAt)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-text-muted/60 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 border border-dashed border-border-strong rounded-xl bg-surface-page/30">
                <FolderOpen className="w-8 h-8 text-text-muted/50 mx-auto mb-2.5" />
                <p className="text-xs text-text-primary font-semibold">
                  {searchQuery ? 'No matching diagrams' : 'No diagrams yet'}
                </p>
                <p className="text-[10px] text-text-muted mt-1">
                  {searchQuery ? 'Try searching for a different name' : 'Get started by creating your first system layout!'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => handleNewCanvas()}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create Canvas</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Long New Canvas Button */}
          <button
            onClick={() => handleNewCanvas()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed border-accent/40 bg-accent/5 hover:bg-accent/10 hover:border-accent text-accent text-sm font-semibold transition-all duration-200 cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            <span>New Canvas</span>
          </button>
        </div>

        {/* RIGHT COLUMN: Checklist and Limits */}
        <div className="space-y-6">
          {/* Start Project & Checklist Card */}
          <div className="border border-border-default rounded-xl p-5 bg-surface-panel shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Start your next project</h3>
              <p className="text-[11px] text-text-muted mt-0.5">Quickly assemble and compile structures.</p>
            </div>

            {/* Checklist items */}
            <div className="space-y-1">
              {checklistItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 hover:bg-surface-page/60 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-page border border-border-default shrink-0 text-text-secondary">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-text-primary truncate">{item.title}</h4>
                        <p className="text-[10px] text-text-muted truncate mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={item.onClick}
                      className="px-3 py-1 bg-surface-page hover:bg-accent hover:text-white border border-border-default hover:border-accent text-[10px] font-semibold rounded-lg text-text-primary transition-all cursor-pointer select-none shrink-0"
                    >
                      {item.action}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Limits Progress Card */}
          <div className="border border-border-default rounded-xl p-5 bg-surface-panel shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Usage Limits</h3>
              <p className="text-[11px] text-text-muted mt-0.5">Workspace storage and AI resource counts.</p>
            </div>

            {/* Progress Indicators */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-[11px] font-medium mb-1.5">
                  <span className="text-text-primary">Canvases Used</span>
                  <span className="text-text-secondary">{totalCanvases} / 5</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-page border border-border-default/60 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((totalCanvases / 5) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-medium mb-1.5">
                  <span className="text-text-primary">AI Credits</span>
                  <span className="text-text-secondary">25 / 100</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-page border border-border-default/60 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: '25%' }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border-default/60 flex items-center justify-between gap-3">
              <span className="text-[10px] text-text-muted font-medium">Usage resets next month</span>
              <button className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer shadow-sm active:scale-[0.98]">
                Upgrade
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
