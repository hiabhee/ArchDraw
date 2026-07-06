'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Node, Edge } from 'reactflow';
import dynamic from 'next/dynamic';
import { Toolbar } from '@/components/Toolbar';
import { ComponentSidebar } from '@/components/ComponentSidebar';
import { CanvasSidebar } from '@/components/CanvasSidebar';
import { reactFlowRef } from '@/lib/reactFlowRef';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { FloatingAIBar } from '@/components/FloatingAIBar';
import { AnimatePresence } from 'framer-motion';
import { GenerationProgressDisplay } from '@/components/GenerationProgress';
import { useDiagramStore } from '@/store/diagramStore';
import { useAuthStore } from '@/store/authStore';
import { useModelStore } from '@/lib/ai/utils/modelStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useOnboarding } from '@/components/onboarding/useOnboarding';
import { componentRegistry } from '@/lib/componentRegistry';
import { toast } from 'sonner';
import type { GenerationProgress } from '@/lib/ai/types';
import { ContextualSidebar } from '@/components/editor/ContextualSidebar';
import { parseRepoNdjsonToReactFlow } from '@/lib/utils/parseRepoNdjson';
import { COMPONENT_TYPES } from '@/components/CreateComponentModal';
import type { CreateComponentData, ComponentToEdit } from '@/components/CreateComponentModal';
import { CanvasSkeleton } from '@/components/CanvasSkeleton';

const CommandPalette = dynamic(() => import('@/components/CommandPalette').then(m => ({ default: m.CommandPalette })), { ssr: false });
const MermaidCodePanel = dynamic(() => import('@/components/MermaidCodePanel').then(m => ({ default: m.MermaidCodePanel })), { ssr: false });
const SequenceDiagramViewer = dynamic(() => import('@/components/SequenceDiagramViewer').then(m => ({ default: m.SequenceDiagramViewer })), { ssr: false });
const CreateComponentModal = dynamic(() => import('@/components/CreateComponentModal').then(m => ({ default: m.CreateComponentModal })), { ssr: false });
const RepoDiagramGenerator = dynamic(() => import('@/components/RepoDiagramGenerator').then(m => ({ default: m.RepoDiagramGenerator })), { ssr: false });
const OnboardingOverlay = dynamic(() => import('@/components/onboarding/OnboardingOverlay').then(m => ({ default: m.OnboardingOverlay })), { ssr: false });
const Canvas = dynamic(() => import('@/components/Canvas').then(m => ({ default: m.Canvas })), {
  ssr: false,
  loading: () => <CanvasSkeleton />,
});

function generateCanvasName(prompt: string): string {
  const words = prompt.trim().split(/\s+/);
  const filtered = words.filter(w => 
    !['a', 'an', 'the', 'for', 'with', 'and', 'or', 'to', 'of', 'in', 'on', 'at', 'by', 'is', 'are', 'was', 'were', 'be', 'build', 'design', 'create', 'make', 'generate', 'architecture', 'diagram', 'system'].includes(w.toLowerCase())
  );
  
  const topic = filtered.slice(0, 3).join(' ');
  return topic ? `${topic.charAt(0).toUpperCase() + topic.slice(1)} diagram` : 'AI Diagram';
}

export default function EditorPage() {
  const { 
    selectedNodeId, selectedEdgeId, nodes, sidebarOpen, setSidebarOpen, 
    importDiagram, importSequenceDiagram, fitView, renameCanvas, 
    activeCanvasId, sequenceDiagrams, canvases,
    markPipelineDone, markPipelineError
  } = useDiagramStore();
  const { user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editComponent, setEditComponent] = useState<ComponentToEdit | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const guestCanvas = canvases.find(c => c.id === 'guest-canvas');
  const showExpirationNudge = !user && guestCanvas && guestCanvas.createdAt && (Date.now() - (guestCanvas.createdAt || 0) > 72 * 60 * 60 * 1000);
  const [canvasSidebarOpen, setCanvasSidebarOpen] = useState(false);
  const [showRepoIngestModal, setShowRepoIngestModal] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);

  const isSequenceDiagram = !!sequenceDiagrams[activeCanvasId];

  // Auto-close code panel if entering sequence diagram mode
  useEffect(() => {
    if (isSequenceDiagram) {
      setShowCodePanel(false);
    }
  }, [isSequenceDiagram]);
  
  // Refs for useEffect to avoid dependency issues
  const sidebarOpenRef = useRef(sidebarOpen);
  const canvasSidebarOpenRef = useRef(canvasSidebarOpen);
  sidebarOpenRef.current = sidebarOpen;
  canvasSidebarOpenRef.current = canvasSidebarOpen;

  // Initialize onboarding (auto-open + drag detection)
  useOnboarding();




  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Prevent all global shortcuts if user is typing in an input
      const activeTag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      // f key — fit view
      if (e.key === 'f') {
        e.preventDefault();
        if (reactFlowRef.instance?.fitView) {
          reactFlowRef.instance.fitView({ padding: 0.0, duration: 200 });
        }
        return;
      }

      const { undo, redo, deleteSelected } = useDiagramStore.getState();
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }

      // Cmd/Ctrl + Shift + N: Create new component
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditComponent(null);
        setShowCreateModal(true);
      }

      // Cmd/Ctrl + K: Open command palette (not canvas sidebar)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Command palette handles its own Cmd+K, don't open canvas sidebar
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Unsaved changes warning for guests
  useEffect(() => {
    const isGuest = !user;
    const hasNodes = nodes.length > 0;
    const handler = (e: BeforeUnloadEvent) => {
      if (isGuest && hasNodes) {
        e.preventDefault();
        e.returnValue = 'You have unsaved work. Sign in to save your diagrams.';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [user, nodes.length]);

  // Canvas sidebar event listeners - also close component sidebar when canvas sidebar opens
  useEffect(() => {
    const openHandler = () => {
      if (sidebarOpenRef.current) setSidebarOpen(false);
      setCanvasSidebarOpen(true);
    };
    const closeHandler = () => {
      setCanvasSidebarOpen(false);
    };
    const toggleHandler = () => {
      if (!canvasSidebarOpenRef.current && sidebarOpenRef.current) {
        setSidebarOpen(false);
      }
      setCanvasSidebarOpen(prev => !prev);
    };
    window.addEventListener('open-canvas-sidebar', openHandler);
    window.addEventListener('close-canvas-sidebar', closeHandler);
    window.addEventListener('toggle-canvas-sidebar', toggleHandler);
    return () => {
      window.removeEventListener('open-canvas-sidebar', openHandler);
      window.removeEventListener('close-canvas-sidebar', closeHandler);
      window.removeEventListener('toggle-canvas-sidebar', toggleHandler);
    };
  }, [setSidebarOpen]);

  useEffect(() => {
    const handleOpen = () => setShowRepoIngestModal(true);
    window.addEventListener('open-repo-ingest', handleOpen);
    return () => window.removeEventListener('open-repo-ingest', handleOpen);
  }, []);

  const handleGenerationComplete = useCallback((result: { type?: string; nodes?: unknown[]; edges?: unknown[]; metadata?: Record<string, unknown> }, canvasName: string, cached = false) => {
    if (result.type === 'sequence') {
      const mermaidSyntax = result.metadata?.mermaidSyntax as string;
      const title = (result.metadata?.title as string) || canvasName;
      
      importSequenceDiagram(mermaidSyntax, title);
      
      const { activeCanvasId } = useDiagramStore.getState();
      renameCanvas(activeCanvasId, title);
      
      setProgress({
        phase: 'complete',
        iteration: 0,
        currentAgent: 'complete',
        score: 0,
        message: `Created sequence diagram with ${(result.metadata?.actors as unknown[])?.length || 0} actors`,
        progress: 100,
      });

      toast.success(`Generated sequence diagram: ${title}`);
      return;
    }

    if (result.nodes && result.edges) {
      const processedNodes = (result.nodes as Record<string, unknown>[]).map((node) => {
        const isGroup = node.type === 'groupNode' || (node.data as Record<string, unknown>)?.isGroup;
        return {
          ...node,
          type: isGroup ? 'groupNode' : (node.type as string || 'systemNode'),
        };
      });

      const processedEdges = (result.edges as Record<string, unknown>[]).map((edge) => ({
        ...edge,
        type: 'simpleFloating',
      }));

      const store = useDiagramStore.getState();
      const existingNodes = store.nodes;
      const existingEdges = store.edges;

      if (existingNodes.length > 0) {
        const maxX = Math.max(...existingNodes.map(
          n => n.position.x + (n.width ?? 200)
        ), 0);
        const offsetX = maxX + 250;

        const offsetNodes = (processedNodes as Node[]).map(n => ({
          ...n,
          position: { x: n.position.x + offsetX, y: n.position.y },
        }));

        store.pushHistory();
        store.setNodes([...existingNodes, ...offsetNodes]);
        store.setEdges([...existingEdges, ...processedEdges as Edge[]]);
      } else {
        importDiagram(processedNodes as Node[], processedEdges as Edge[]);
      }

      const generatedDiagramType = result.metadata?.diagramType as string;
      if (generatedDiagramType === 'graph LR') {
        store.setActiveLayoutPresetId('layered-lr');
      } else if (generatedDiagramType === 'graph TD') {
        store.setActiveLayoutPresetId('layered-tb');
      }

      renameCanvas(store.activeCanvasId, canvasName);
      
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
      
      if (cached) {
        toast.success(`Loaded cached diagram: ${result.nodes.length} nodes`);
      } else {
        toast.success(`Generated ${result.nodes.length} nodes and ${result.edges.length} edges`);
      }
    }

    setProgress({
      phase: 'complete',
      iteration: (result.metadata?.iterations as number) || 0,
      currentAgent: 'complete',
      score: (result.metadata?.score as number) || 0,
      message: `Created ${(result.metadata?.totalNodes as number) || result.nodes?.length || 0} nodes`,
      progress: 100,
    });
  }, [fitView, importDiagram, importSequenceDiagram, renameCanvas]);

  const isGitHubRepoUrl = (value: string): boolean => {
    const cleaned = value.trim().replace(/\/+$/, '');
    return /^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+?)(?:\.git)?$/.test(cleaned);
  };

  const extractRepoName = (url: string): string => {
    try {
      const cleanUrl = url.trim().replace(/\/+$/, '');
      const parts = cleanUrl.split('/');
      return parts[parts.length - 1] || 'Repository';
    } catch {
      return 'Repository';
    }
  };


  const handleGenerate = async (description: string, diagramSize?: 'small' | 'medium' | 'large') => {
    const selectedModel = useModelStore.getState().selectedModel;
    setProgress(null);

    const canvasName = isGitHubRepoUrl(description)
      ? `${extractRepoName(description)} Architecture`
      : generateCanvasName(description);

    renameCanvas(activeCanvasId, canvasName);

    // Sync layout preset dropdown with prompt layout direction
    if (!isGitHubRepoUrl(description)) {
      const promptLower = description.toLowerCase();
      const isHorizontalRequested = promptLower.includes('horizontal') || promptLower.includes('horizontally') || promptLower.includes('left-to-right') || promptLower.includes('left to right') || promptLower.includes('graph lr') || promptLower.includes('horizontal layout');
      if (isHorizontalRequested) {
        useDiagramStore.getState().setActiveLayoutPresetId('layered-lr');
      } else {
        useDiagramStore.getState().setActiveLayoutPresetId('layered-tb');
      }
    }

    try {
      // GitHub repo ingest path — same input box, different pipeline
      if (isGitHubRepoUrl(description)) {
        setProgress({
          phase: 'generating',
          iteration: 0,
          currentAgent: 'repo-ingest',
          score: 0,
          message: 'Analyzing GitHub repository...',
          progress: 10,
        });

        const response = await fetch('/api/repo-diagram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl: description.trim() }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Repo ingest failed');
        }

        const { nodes: rfNodes, edges: rfEdges } = parseRepoNdjsonToReactFlow(data.ndjson);
        if (rfNodes.length === 0) {
          throw new Error('No architectural components could be detected in this repository.');
        }

        importDiagram(rfNodes, rfEdges);
        renameCanvas(activeCanvasId, canvasName);
        setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);

        setProgress({
          phase: 'complete',
          iteration: 0,
          currentAgent: 'complete',
          score: 0,
          message: `Ingested repo: ${rfNodes.length} nodes`,
          progress: 100,
        });

        toast.success(`Generated repo diagram: ${rfNodes.length} nodes, ${rfEdges.length} edges`);
        return;
      }

      const payload: {
        description: string;
        diagramSize?: 'small' | 'medium' | 'large';
        model?: string;
        stream: boolean;
      } = { description, diagramSize, model: selectedModel, stream: true };

      // Use standard JSON endpoint
      const response = await fetch('/api/generate-diagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Generation failed');
      }

      const responseData = await response.json();
      
      if (responseData.progress && responseData.progress.length > 0) {
        const lastProgress = responseData.progress[responseData.progress.length - 1];
        setProgress(lastProgress);
      }
      
      handleGenerationComplete(responseData.data, canvasName);
      markPipelineDone();

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      markPipelineError(message);
      setProgress({
        phase: 'error',
        iteration: 0,
        currentAgent: 'error',
        score: 0,
        message: message,
        progress: 0,
      });
      toast.error(message);
    } finally {
      setTimeout(() => {
        setProgress(null);
      }, 2000);
    }
  };

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 overflow-hidden bg-[hsl(var(--canvas-bg))]" style={{ touchAction: 'manipulation' }}>
        {sequenceDiagrams[activeCanvasId] ? (
          <SequenceDiagramViewer />
        ) : (
          <Canvas />
        )}
        
        <Toolbar />

        {showExpirationNudge && (
          <div className="absolute top-[calc(env(safe-area-inset-top,0px)+64px)] sm:top-[80px] left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-2 sm:px-4">
            <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-3 bg-[#1e293b]/95 backdrop-blur border border-amber-500/30 rounded-xl shadow-xl">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-amber-500 text-base shrink-0">⚠️</span>
                <p className="text-xs text-[#f1f5f9] font-medium leading-normal">
                  Guest work expires soon. <strong>Sign in</strong> to save.
                </p>
              </div>
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('trigger-share'));
                }}
                className="px-3 py-1.5 bg-[#f1f5f9] text-[#0f172a] text-xs font-semibold rounded-lg hover:bg-[#e2e8f0] transition-colors shrink-0"
              >
                Sign In
              </button>
            </div>
          </div>
        )}
        
        {canvasSidebarOpen && (
          <CanvasSidebar onClose={() => setCanvasSidebarOpen(false)} />
        )}
        
        {sidebarOpen && (
          <ComponentSidebar
            onOpenCreateModal={() => setShowCreateModal(true)}
          />
        )}
        
        {(selectedNodeId && !selectedEdgeId) && (
          <ContextualSidebar 
            nodeId={selectedNodeId} 
            onClose={() => useDiagramStore.getState().setSelectedNodeId(null)} 
          />
        )}
        
        {selectedEdgeId && <PropertiesPanel />}
        
        <CommandPalette />
        <OnboardingOverlay />
        <FloatingAIBar 
          onGenerate={handleGenerate} 
          onToggleCode={() => setShowCodePanel(prev => !prev)}
          showCode={showCodePanel}
          hideCodeButton={isSequenceDiagram}
          isCanvasEmpty={nodes.length === 0}
        />
        <AnimatePresence>
          {showCodePanel && !isSequenceDiagram && (
            <MermaidCodePanel onClose={() => setShowCodePanel(false)} />
          )}
        </AnimatePresence>
        <GenerationProgressDisplay 
          progress={progress} 
          onCancel={() => {
            setProgress(null);
          }}
        />
        <CreateComponentModal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); setEditComponent(null); }}
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
            setShowCreateModal(false);
            setEditComponent(null);
            window.dispatchEvent(new CustomEvent('custom-component-added'));
          }}
          onUpdate={(id: string, data: CreateComponentData) => {
            const typeInfo = COMPONENT_TYPES.find(t => t.id === data.type);
            componentRegistry.updateCustomComponent(id, {
              label: data.name,
              category: typeInfo?.label || 'Other',
              color: typeInfo?.color || '#6B7280',
              description: data.description,
            });
            setShowCreateModal(false);
            setEditComponent(null);
            window.dispatchEvent(new CustomEvent('custom-component-added'));
          }}
          existingNames={componentRegistry.getAll().map(c => c.label.toLowerCase())}
          editComponent={editComponent}
        />
        {showRepoIngestModal && (
          <RepoDiagramGenerator onClose={() => setShowRepoIngestModal(false)} />
        )}
      </div>
    </ErrorBoundary>
  );
}
