'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { createNode } from '@/lib/factory';
import { getViewportCenter } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useModelStore } from '@/lib/ai/utils/modelStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useOnboarding } from '@/components/onboarding/useOnboarding';
import { componentRegistry } from '@/lib/componentRegistry';
import { toast } from 'sonner';
import { analytics } from '@/lib/analytics';
import type { GenerationProgress } from '@/lib/ai/types';
import { ContextualSidebar } from '@/components/editor/ContextualSidebar';
import { isGitHubRepoUrl } from '@/lib/utils/githubUrl';
import {
  generateDiagramFromPrompt,
  generateDiagramFromRepo,
  mergeGeneratedNodes,
  inferDiagramDirection,
  extractRepoName,
  GenerationServiceError,
} from '@/lib/ai/generationService';
import { COMPONENT_TYPES } from '@/components/CreateComponentModal';
import type { CreateComponentData, ComponentToEdit } from '@/components/CreateComponentModal';
import { relayoutCanvasViaMermaid } from '@/lib/mermaid/relayout';
import { CanvasSkeleton } from '@/components/CanvasSkeleton';
import { getUserTier } from '@/lib/userQuotas';

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
    selectedNodeId, selectedNodeIds, selectedEdgeId, nodes, sidebarOpen, setSidebarOpen, 
    importDiagram, importSequenceDiagram, fitView, renameCanvas, 
    activeCanvasId, sequenceDiagrams, canvases,
    startGeneration, markPipelineDone, markPipelineError
  } = useDiagramStore();
  const { user } = useAuthStore();
  const tier = getUserTier(user?.id);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editComponent, setEditComponent] = useState<ComponentToEdit | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const guestCanvas = canvases.find(c => c.id === 'guest-canvas');
  const showExpirationNudge = !user && guestCanvas && guestCanvas.createdAt && (Date.now() - (guestCanvas.createdAt || 0) > 72 * 60 * 60 * 1000);
  const [canvasSidebarOpen, setCanvasSidebarOpen] = useState(false);
  const [showRepoIngestModal, setShowRepoIngestModal] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`archdraw-last-prompt:${activeCanvasId}`);
    }
    return null;
  });
  const [lastSize, setLastSize] = useState<'small' | 'medium' | 'large'>('medium');

  const isSequenceDiagram = !!sequenceDiagrams[activeCanvasId];
  const isMobile = useIsMobile();

  // Sync lastPrompt when switching canvases
  useEffect(() => {
    setLastPrompt(localStorage.getItem(`archdraw-last-prompt:${activeCanvasId}`));
  }, [activeCanvasId]);

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
      // Prevent all global shortcuts if user is typing in an input or contentEditable
      const active = document.activeElement as HTMLElement;
      const activeTag = active?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || active?.getAttribute('contenteditable') === 'true') return;

      // f key — fit view
      if (e.key === 'f') {
        e.preventDefault();
        if (reactFlowRef.instance?.fitView) {
          reactFlowRef.instance.fitView({ padding: 0.0, duration: 200 });
        }
        return;
      }

      // t key — add text label at viewport center
      if (e.key === 't') {
        e.preventDefault();
        const { pushHistory, appendNode } = useDiagramStore.getState();
        const pos = getViewportCenter();
        pushHistory();
        appendNode(createNode('textLabelNode', 'Label', pos, { type: 'textLabelNode', data: { text: 'Label', fontSize: 'medium' } }));
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
  }, [setSidebarOpen, setCanvasSidebarOpen]);

  useEffect(() => {
    const handleOpen = () => setShowRepoIngestModal(true);
    window.addEventListener('open-repo-ingest', handleOpen);
    return () => window.removeEventListener('open-repo-ingest', handleOpen);
  }, []);

  const handleGenerationComplete = useCallback(async (result: { type?: string; nodes?: unknown[]; edges?: unknown[]; metadata?: Record<string, unknown> }, canvasName: string, cached = false) => {
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
      }) as Node[];

      const processedEdges = (result.edges as Record<string, unknown>[]).map((edge) => ({
        ...edge,
        type: 'simpleFloating',
      })) as Edge[];

      const store = useDiagramStore.getState();
      const styleTheme = (result.metadata?.styleTheme || result.metadata?.theme) as string | undefined;
      if (styleTheme) {
        store.setDiagramStyleTheme(styleTheme);
      }

      // Apply the same layout transformation the horizontal/vertical layout
      // toggler performs so freshly generated diagrams are laid out properly
      // (parent groups resized to contain nested children) without requiring a
      // manual toggle. Falls back to the AI pipeline's own layout on failure.
      const direction = inferDiagramDirection(result);
      const activePresetId = direction ?? store.activeLayoutPresetId;
      const mermaidDirection = activePresetId === 'layered-tb' ? 'TD' : 'LR';
      const relayouted = await relayoutCanvasViaMermaid(processedNodes, processedEdges, mermaidDirection);
      const finalNodes = relayouted.success ? relayouted.nodes : processedNodes;
      const finalEdges = relayouted.success ? relayouted.edges : processedEdges;

      const { nodes: mergedNodes, edges: mergedEdges } = mergeGeneratedNodes(
        store.nodes,
        store.edges,
        finalNodes,
        finalEdges,
      );

      if (store.nodes.length > 0) {
        store.pushHistory();
        store.setNodes(mergedNodes);
        store.setEdges(mergedEdges);
      } else {
        importDiagram(finalNodes, finalEdges);
      }

      if (direction) {
        store.setActiveLayoutPresetId(direction);
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


  const handleGenerate = async (description: string, detailLevelOrSize?: 1 | 2 | 3 | 'small' | 'medium' | 'large') => {
    const selectedModel = useModelStore.getState().selectedModel;
    setProgress(null);
    setLastPrompt(description);
    localStorage.setItem(`archdraw-last-prompt:${activeCanvasId}`, description);
    const generationStart = Date.now();
    const resolvedDetailLevel = typeof detailLevelOrSize === 'number' ? detailLevelOrSize : detailLevelOrSize === 'small' ? 1 : detailLevelOrSize === 'medium' ? 2 : 3;
    const detailLevel = resolvedDetailLevel;
    const diagramSize = detailLevel === 1 ? 'small' : detailLevel === 2 ? 'medium' : 'large';
    setLastSize(diagramSize);

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

    startGeneration();

    try {
      if (isGitHubRepoUrl(description)) {
        const parsed = await generateDiagramFromRepo(description, detailLevel, (p) => setProgress(p));
        importDiagram(parsed.nodes, parsed.edges);
        renameCanvas(activeCanvasId, canvasName);
        setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
        markPipelineDone();
        toast.success(`Generated repo diagram: ${parsed.nodeCount} nodes, ${parsed.edgeCount} edges`);
        analytics.track({
          event_type: 'diagram_generated',
          page_path: window.location.pathname,
          payload: {
            model: 'repo-ingest',
            diagram_size: 'medium',
            duration_ms: Date.now() - generationStart,
            is_repo_url: true,
            node_count: parsed.nodeCount,
            edge_count: parsed.edgeCount,
          },
        });
        return;
      }

      const responseData = await generateDiagramFromPrompt(
        { description, detailLevel, model: selectedModel },
        (p) => setProgress(p),
      );
      
      markPipelineDone();
      handleGenerationComplete(responseData.data, canvasName);

      analytics.track({
        event_type: 'diagram_generated',
        page_path: window.location.pathname,
        payload: {
          model: selectedModel,
          detail_level: detailLevel,
          diagram_size: diagramSize,
          duration_ms: Date.now() - generationStart,
          is_repo_url: false,
          node_count: responseData.data?.nodes?.length,
          edge_count: responseData.data?.edges?.length,
        },
      });

    } catch (err) {
      const message = err instanceof GenerationServiceError ? err.message : (err instanceof Error ? err.message : 'Generation failed');
      markPipelineError(message);
      setProgress({
        phase: 'error',
        iteration: 0,
        currentAgent: 'error',
        score: 0,
        message,
        progress: 0,
      });
      toast.error(message);

      analytics.track({
        event_type: 'diagram_generated',
        page_path: window.location.pathname,
        payload: {
          model: selectedModel || 'unknown',
          detail_level: detailLevel,
          diagram_size: diagramSize,
          duration_ms: Date.now() - generationStart,
          success: false,
          error: message,
        },
      });
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

        {(selectedNodeId || selectedNodeIds.length > 0 || selectedEdgeId) && <PropertiesPanel />}
        
        <CommandPalette />
        <OnboardingOverlay />
          <FloatingAIBar 
          onGenerate={handleGenerate} 
          onToggleCode={() => setShowCodePanel(prev => !prev)}
          showCode={showCodePanel}
          hideCodeButton={isSequenceDiagram}
          isCanvasEmpty={nodes.length === 0}
          onRegenerate={lastPrompt ? (level) => handleGenerate(lastPrompt, level) : undefined}
          hasLastPrompt={!!lastPrompt}
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
