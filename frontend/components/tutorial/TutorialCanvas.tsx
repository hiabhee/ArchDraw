'use client';

import { useCallback, DragEvent, useState, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Background, BackgroundVariant, Controls,
  ReactFlowProvider, useReactFlow,
  ConnectionLineType, ConnectionMode,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeProps,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { SystemNode } from '@/components/SystemNode';
import type { NodeData } from '@/store/diagramStore';
import { ShapeNode } from '@/components/ShapeNode';
import { GroupNode } from '@/components/GroupNode';
import { TextLabelNode } from '@/components/TextLabelNode';
import { AnnotationNode } from '@/components/AnnotationNode';
import SimpleFloatingEdge from '@/components/edges/SimpleFloatingEdge';
import { useTutorialStore, useTutorialHelpers, sanitizeNode, sanitizeEdge } from '@/store/tutorialStore';
import { createNode, isBlankInitComponent } from '@/lib/factory';
import { SVGEdgeMarkerDefs } from '@/lib/utils/edgeColorUtils';
import { DIAGRAM_CONSTANTS, EDGE_MARKER } from '@/constants/diagram';
import { assignEdgeColors } from '@/lib/edgeColors';
import { getStepRequirements, isNodeTypeMet, isEdgeMet } from '@/lib/tutorialValidation';
const EDGE_TYPES = {
  custom: SimpleFloatingEdge,
  simpleFloating: SimpleFloatingEdge,
  floating: SimpleFloatingEdge,
  default: SimpleFloatingEdge,
  smoothstep: SimpleFloatingEdge,
  flow: SimpleFloatingEdge,
  async: SimpleFloatingEdge,
  sync: SimpleFloatingEdge,
  stream: SimpleFloatingEdge,
  event: SimpleFloatingEdge,
  dep: SimpleFloatingEdge,
  dotted: SimpleFloatingEdge,
};
import { ComponentPalette } from '@/components/tutorial/ComponentPalette';
import { CORE_COMPONENTS as components } from '@/lib/componentRegistry';
import { COMPONENT_TOOLTIPS, type RichTooltipData } from '@/data/componentTooltips';

export interface NodeDetailsInfo {
  label: string;
  category?: string;
  color?: string;
  description?: string;
  role?: string;
  whyItMatters?: string;
  realWorldFact?: string;
  tradeoff?: string;
  interviewTip?: string;
  concepts?: string[];
}

type ComponentEntry = { id: string; label: string; category: string; color: string; description?: string };
const componentMap = new Map<string, ComponentEntry>(
  (components as ComponentEntry[]).map((c) => [c.label.toLowerCase(), c])
);

function findComponentMeta(label: string): ComponentEntry | undefined {
  const key = label.toLowerCase();
  if (componentMap.has(key)) return componentMap.get(key);
  // fuzzy: find first entry whose label contains the node label or vice versa
  for (const [k, v] of componentMap) {
    if (k.includes(key) || key.includes(k)) return v;
  }
  return undefined;
}

function buildNodeDetails(label: string, data: { category?: string; color?: string }): NodeDetailsInfo {
  const meta = findComponentMeta(label);
  const rich: RichTooltipData | undefined = COMPONENT_TOOLTIPS[label];
  return {
    label,
    category: data.category ?? meta?.category,
    color: data.color ?? meta?.color,
    description: meta?.description,
    role: rich?.role,
    whyItMatters: rich?.whyItMatters,
    realWorldFact: rich?.realWorldFact,
    tradeoff: rich?.tradeoff,
    interviewTip: rich?.interviewTip,
    concepts: rich?.concepts,
  };
}

function TutorialSystemNodeWrapper(props: NodeProps<NodeData>) {
  const { highlightFrom, highlightTo } = useTutorialStore();

  const nodeLabelLower = (props.data.label ?? '').toLowerCase().trim();
  const isHighlighted: 'source' | 'target' | null =
    highlightFrom && nodeLabelLower.includes(highlightFrom.toLowerCase()) ? 'source' :
    highlightTo && nodeLabelLower.includes(highlightTo.toLowerCase()) ? 'target' :
    null;

  return (
    <div
      className={`${isHighlighted === 'source' ? 'ring-2 ring-gray-500 ring-offset-2 ring-offset-white' : ''} ${isHighlighted === 'target' ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white' : ''} rounded-lg transition-all duration-300`}
      style={{
        boxShadow: isHighlighted === 'source' ? '0 0 20px rgba(107,114,128,0.4), inset 0 0 15px rgba(107,114,128,0.1)' :
                   isHighlighted === 'target' ? '0 0 20px rgba(16,185,129,0.4), inset 0 0 15px rgba(16,185,129,0.1)' : 'none',
      }}
    >
      <SystemNode {...props} />
    </div>
  );
}

const NODE_TYPES = {
  systemNode:        TutorialSystemNodeWrapper,
  architectureNode:  TutorialSystemNodeWrapper,
  baseNode:          TutorialSystemNodeWrapper,
  databaseNode:      TutorialSystemNodeWrapper,
  cacheNode:         TutorialSystemNodeWrapper,
  shapeNode:         ShapeNode,
  groupNode:         GroupNode,
  frameNode:         GroupNode,
  serviceNode:       TutorialSystemNodeWrapper,
  textLabelNode:     TextLabelNode,
  annotationNode:    AnnotationNode,
  messageBrokerNode: TutorialSystemNodeWrapper,
  customNode:        TutorialSystemNodeWrapper,
  custom:            TutorialSystemNodeWrapper,
};

interface TutorialCanvasInnerProps {
  theme: 'dark' | 'light';
  tutorialId: string;
  tutorialTitle?: string;
  currentStep?: number;
  totalSteps?: number;
  currentLevel?: number;
  totalLevels?: number;
  onRestart?: () => void;
  onSkip?: () => void;
  onNodeSelect?: (info: NodeDetailsInfo | null) => void;
}

function TutorialCanvasInner({
  theme,
  tutorialId,
  onNodeSelect,
}: TutorialCanvasInnerProps) {
  const isDark = theme === 'dark';
  const canvasBg = isDark ? '#0f172a' : '#f8fafc';
  const dotColor = isDark ? '#475569' : '#64748b';
  const dotOpacity = isDark ? 0.6 : 0.4;
  const emptyIconBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const emptyIconBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const emptyTextPrimary = isDark ? 'text-slate-400' : 'text-slate-500';
  const emptyTextSecondary = isDark ? 'text-slate-600' : 'text-slate-400';
  const kbdStyle = isDark
    ? 'bg-white/[0.08] text-slate-400 border-white/10'
    : 'bg-black/[0.06] text-slate-500 border-black/10';
  const controlsClass = isDark
    ? '!bg-[#0d1117]/90 !backdrop-blur-sm !border !border-white/10 !rounded-lg [&>button]:!border-0 [&>button]:!border-b [&>button]:!border-white/10 [&>button:hover]:!bg-white/5'
    : '!bg-white/90 !backdrop-blur-sm !border !border-black/10 !rounded-lg [&>button]:!border-0 [&>button]:!border-b [&>button]:!border-black/10 [&>button]:hover:!bg-black/5';
  const { nodes, edges, session, setNodes, setEdges, setTutorialNodes, setTutorialEdges, saveProgress, getProgress, hasHydrated, isSwitchingTutorial } = useTutorialStore();
  const reactFlowInstance = useReactFlow();
  const [isMac, setIsMac] = useState(false);
  const [paletteForceOpen, setPaletteForceOpen] = useState(false);
  const [paletteInitialQuery, setPaletteInitialQuery] = useState('');
  const canvasSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTimeout(() => setIsMac(navigator.platform.toUpperCase().includes('MAC')), 0);
  }, []);

  // Restore canvas from richProgress on mount and when tutorialId changes.
  const initialNodesLoadedRef = useRef(false);
  
  // Reset the ref when tutorialId changes
  useEffect(() => {
    initialNodesLoadedRef.current = false;
  }, [tutorialId]);
  
  useEffect(() => {
    if (!hasHydrated) return;
    if (!tutorialId) return;
    if (initialNodesLoadedRef.current) return;
    
    // Nodes were already restored from store via startTutorialByDef
    if (nodes.length > 0) {
      initialNodesLoadedRef.current = true;
      setTimeout(() => reactFlowInstance.fitView({ maxZoom: 0.7 }), 100);
      return;
    }

    const progress = getProgress(tutorialId);
    const savedNodes = progress?.canvasNodes as Node[] | undefined;
    const savedEdges = progress?.canvasEdges as Edge[] | undefined;

    if (savedNodes && savedNodes.length > 0) {
      setNodes(savedNodes);
      setEdges(savedEdges ?? []);
      setTutorialNodes(savedNodes);
      setTutorialEdges(savedEdges ?? []);
      toast.success('Canvas restored', { duration: 2000, position: 'bottom-center' });
      setTimeout(() => reactFlowInstance.fitView({ maxZoom: 0.7 }), 100);
    }
    initialNodesLoadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, tutorialId, getProgress, setNodes, setEdges, setTutorialNodes, setTutorialEdges, reactFlowInstance]);

  // Save canvas nodes/edges + session state to richProgress on change (debounced 1s).
  useEffect(() => {
    if (!tutorialId) return;
    if (isSwitchingTutorial) return;
    if (canvasSaveTimerRef.current) clearTimeout(canvasSaveTimerRef.current);
    canvasSaveTimerRef.current = setTimeout(() => {
      const progress: Parameters<typeof saveProgress>[1] = {
        canvasNodes: nodes.map(sanitizeNode),
        canvasEdges: edges.map(sanitizeEdge),
      };
      if (session) {
        progress.currentLevel = session.levelIndex + 1;
        progress.currentStep = session.stepIndex + 1;
        progress.currentPhase = session.phase;
        progress.completedLevels = session.completedLevelIds.map(Number);
        progress.completedStepIds = session.completedStepIds;
      }
      saveProgress(tutorialId, progress);
    }, 1000);
    return () => {
      if (canvasSaveTimerRef.current) clearTimeout(canvasSaveTimerRef.current);
    };
   
  }, [nodes, edges, session, tutorialId, saveProgress, isSwitchingTutorial]);

  // ── Real-time step detection ─────────────────────────────────────────────
  const { currentStep } = useTutorialHelpers();
  const prevRequirementsMetRef = useRef<string>('');

  useEffect(() => {
    if (!currentStep || !session) return;
    if (session.phase !== 'action' && session.phase !== 'connecting') return;

    const reqs = getStepRequirements(currentStep);
    const allNodeTypes = reqs.requiredNodeTypes;
    const allEdges = reqs.requiredEdges;

    // Build a key of current met state
    const metKey = [
      ...allNodeTypes.map(nt => isNodeTypeMet(nt, nodes) ? '1' : '0'),
      ...allEdges.map(er => isEdgeMet(er.source, er.target, nodes, edges) ? '1' : '0'),
    ].join('');

    const prevKey = prevRequirementsMetRef.current;
    prevRequirementsMetRef.current = metKey;

    // Skip first render
    if (!prevKey) return;

    // Detect newly met requirements
    for (let i = 0; i < allNodeTypes.length; i++) {
      const wasMet = prevKey[i] === '1';
      const isMet = metKey[i] === '1';
      if (!wasMet && isMet) {
        toast.success(`${allNodeTypes[i].replace(/_/g, ' ')} added!`, {
          duration: 2000,
          position: 'bottom-center',
        });
      }
    }

    const nodeOffset = allNodeTypes.length;
    for (let i = 0; i < allEdges.length; i++) {
      const wasMet = prevKey[nodeOffset + i] === '1';
      const isMet = metKey[nodeOffset + i] === '1';
      if (!wasMet && isMet) {
        const er = allEdges[i];
        toast.success(`Connected ${er.sourceLabel} → ${er.targetLabel}!`, {
          duration: 2000,
          position: 'bottom-center',
        });
      }
    }

    // Check if ALL requirements are now met (and weren't before)
    const allMet = metKey.split('').every(c => c === '1');
    const prevAllMet = prevKey.split('').every(c => c === '1');
    if (allMet && !prevAllMet && metKey.length > 0) {
      toast.success('All requirements met! Click "Continue" to proceed.', {
        duration: 3000,
        position: 'bottom-center',
      });
    }
  }, [nodes, edges, currentStep, session]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, nodes);
      setNodes(updated);
      setTutorialNodes(updated);
    },
    [nodes, setNodes, setTutorialNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updated = applyEdgeChanges(changes, edges);
      setEdges(updated);
      setTutorialEdges(updated);
    },
    [edges, setEdges, setTutorialEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdges = addEdge(
        {
          ...connection,
          id: `edge-${Date.now()}`,
          type: 'smoothstep',
          style: { strokeWidth: DIAGRAM_CONSTANTS.edge.strokeWidth, stroke: DIAGRAM_CONSTANTS.edge.stroke },
          markerEnd: EDGE_MARKER,
        },
        edges
      );
      setEdges(newEdges);
      setTutorialEdges(newEdges);
    },
    [edges, setEdges, setTutorialEdges]
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/archdraw');
      if (!raw) return;
      const comp = JSON.parse(raw);
      const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      
      const blank = isBlankInitComponent(comp.id);
      const newNode = createNode(comp.id, blank ? '' : comp.label, position, {
        type: 'systemNode',
        data: {
          componentId: comp.id,
          category: comp.category,
          color: comp.color,
          icon: comp.icon,
          technology: comp.technology,
          ...(blank ? { label: '', autoStartLabelEdit: true } : {}),
        }
      });
      
      const updated = [
        ...nodes,
        newNode,
      ];
      setNodes(updated);
      setTutorialNodes(updated);
    },
    [nodes, setNodes, setTutorialNodes, reactFlowInstance]
  );

  const handleAddComponent = useCallback(
    (component: { id: string; label: string; category: string; color: string; icon?: string }) => {
      const { x, y, zoom } = reactFlowInstance.getViewport();
      const bounds = document.querySelector('.react-flow__renderer')?.getBoundingClientRect();
      const centerX = bounds ? (bounds.width / 2 - x) / zoom : 400;
      const centerY = bounds ? (bounds.height / 2 - y) / zoom : 300;

      const position = {
        x: centerX + (Math.random() * 60 - 30),
        y: centerY + (Math.random() * 60 - 30),
      };

      const blank = isBlankInitComponent(component.id);
      const newNode = createNode(component.id, blank ? '' : component.label, position, {
        type: 'systemNode',
        data: {
          componentId: component.id,
          category: component.category,
          color: component.color,
          icon: component.icon,
          ...(blank ? { label: '', autoStartLabelEdit: true } : {}),
        }
      });

      const updated = [...nodes, newNode];
      setNodes(updated);
      setTutorialNodes(updated);
      toast.success(`Added ${component.label}`, { duration: 1500, position: 'bottom-center' });
    },
    [nodes, setNodes, setTutorialNodes, reactFlowInstance]
  );

  // Exposed so GuidePanel search hint can open palette with a pre-filled query
  const openPaletteWithQuery = useCallback((q: string) => {
    setPaletteInitialQuery(q);
    setPaletteForceOpen(true);
  }, []);

  // Expose to window so GuidePanel (sibling) can call it
  useEffect(() => {
    (window as Window & { __tutorialOpenPalette?: typeof openPaletteWithQuery }).__tutorialOpenPalette = openPaletteWithQuery;
    return () => { delete (window as Window & { __tutorialOpenPalette?: typeof openPaletteWithQuery }).__tutorialOpenPalette; };
  }, [openPaletteWithQuery]);

  // Expose fitView so GuidePanel can re-fit after auto-layout
  const fitCanvas = useCallback(() => {
    reactFlowInstance.fitView({ maxZoom: 0.7 });
  }, [reactFlowInstance]);
  useEffect(() => {
    (window as Window & { __tutorialFitView?: typeof fitCanvas }).__tutorialFitView = fitCanvas;
    return () => { delete (window as Window & { __tutorialFitView?: typeof fitCanvas }).__tutorialFitView; };
  }, [fitCanvas]);

  const coloredEdges = useMemo(() => assignEdgeColors(edges), [edges]);

  return (
    <div className="flex-1 relative flex flex-col">
      <SVGEdgeMarkerDefs />
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={coloredEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodeDoubleClick={(_event, node) => {
            const label = (node.data?.label as string) ?? '';
            if (!label) return;
            onNodeSelect?.(buildNodeDetails(label, {
              category: node.data?.category as string | undefined,
              color: node.data?.color as string | undefined,
            }));
          }}
          onPaneClick={() => onNodeSelect?.(null)}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          elevateNodesOnSelect={false}
          elevateEdgesOnSelect={false}
          connectionMode={ConnectionMode.Loose}
          snapToGrid
          snapGrid={[20, 20]}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
          fitView
          fitViewOptions={{ maxZoom: 0.7 }}
          proOptions={{ hideAttribution: true }}
          connectionLineType={ConnectionLineType.SmoothStep}
          style={{ background: canvasBg }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: { strokeWidth: DIAGRAM_CONSTANTS.edge.strokeWidth, stroke: DIAGRAM_CONSTANTS.edge.stroke },
            markerEnd: EDGE_MARKER,
          }}
          deleteKeyCode={['Backspace', 'Delete', 'Meta+Backspace']}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color={dotColor} style={{ backgroundColor: canvasBg, opacity: dotOpacity }} />
          <Controls
            showInteractive={false}
            className={controlsClass}
          />
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: emptyIconBg, border: `1px solid ${emptyIconBorder}` }}
              >
                <Search className={`w-5 h-5 ${emptyTextSecondary}`} />
              </div>
              <div className="text-center">
                <p className={`${emptyTextPrimary} text-sm font-medium mb-1`}>Follow the guide on the left</p>
                <p className={`${emptyTextSecondary} text-xs`}>
                  Press{' '}
                  <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${kbdStyle}`}>
                    {isMac ? '⌘' : 'Ctrl'}
                  </kbd>
                  {' + '}
                  <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${kbdStyle}`}>
                    K
                  </kbd>
                  {' '}to search and add components
                </p>
              </div>
            </div>
          </div>
        )}

        <div 
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs z-10"
          style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(0,0,0,0.08)', color: '#64748b' }}
        >
          <span>Press</span>
          <kbd className="mx-1 px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: 'rgba(0,0,0,0.06)' }}>Delete</kbd>
          <span>or</span>
          <kbd className="mx-1 px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: 'rgba(0,0,0,0.06)' }}>Backspace</kbd>
          <span>to remove nodes</span>
        </div>
      </div>

      <ComponentPalette
        onAddComponent={handleAddComponent}
        initialQuery={paletteInitialQuery}
        forceOpen={paletteForceOpen}
        onClose={() => setPaletteForceOpen(false)}
      />
    </div>
  );
}

interface TutorialCanvasProps {
  theme?: 'dark' | 'light';
  tutorialId: string;
  tutorialTitle?: string;
  currentStep?: number;
  totalSteps?: number;
  currentLevel?: number;
  totalLevels?: number;
  onRestart?: () => void;
  onSkip?: () => void;
  onNodeSelect?: (info: NodeDetailsInfo | null) => void;
}

export function TutorialCanvas({
  theme = 'dark',
  tutorialId,
  tutorialTitle,
  currentStep,
  totalSteps,
  currentLevel,
  totalLevels,
  onRestart,
  onSkip,
  onNodeSelect,
}: TutorialCanvasProps) {
  return (
    <ReactFlowProvider>
      <TutorialCanvasInner
        theme={theme}
        tutorialId={tutorialId}
        tutorialTitle={tutorialTitle}
        currentStep={currentStep}
        totalSteps={totalSteps}
        currentLevel={currentLevel}
        totalLevels={totalLevels}
        onRestart={onRestart}
        onSkip={onSkip}
        onNodeSelect={onNodeSelect}
      />
    </ReactFlowProvider>
  );
}
