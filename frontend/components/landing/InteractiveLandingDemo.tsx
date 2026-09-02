import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  ReactFlowProvider,
  addEdge,
  ConnectionLineType,
  useReactFlow,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Undo2, Redo2, LayoutGrid, Sun, Moon, Share2, Download,
  Sparkles, Database, Server, Globe, Activity,
  Send, ChevronDown, Plus, Folder, Trash2, MoreHorizontal,
  Layers, MessageSquare, BookOpen, Square, HelpCircle, Code, Mic,
  PanelLeftClose, FolderOpen, LayoutDashboard, ChevronLeft, Slash, MousePointer2
} from 'lucide-react';
import dagre from 'dagre';
import { toast } from 'sonner';
import { DEMO_NODE_TYPES, DEMO_EDGE_TYPES } from './landing-demo/DemoNodes';
import { PRESETS } from './landing-demo/presets';
import '@/components/nodes/nodeStyles.css';

export default function InteractiveLandingDemo() {
  return (
    <ReactFlowProvider>
      <InteractiveLandingDemoContent />
    </ReactFlowProvider>
  );
}

function InteractiveLandingDemoContent() {
  const [activeChip, setActiveChip] = useState<'loadBalancer'>('loadBalancer');
  const [nodes, setNodes, onNodesChange] = useNodesState(PRESETS.loadBalancer.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(PRESETS.loadBalancer.edges);
  const [title, setTitle] = useState(PRESETS.loadBalancer.title);
  const [inputText, setInputText] = useState('');
  const [isDemoDark, setIsDemoDark] = useState(false);

  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitView({ padding: 0.15 });
      });
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [fitView]);

  // Undo/Redo States
  const [history, setHistory] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([
    { nodes: PRESETS.loadBalancer.nodes, edges: PRESETS.loadBalancer.edges }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const updateNodeLabel = useCallback((nodeId: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              label: newLabel,
              groupLabel: newLabel,
            },
          };
        }
        return n;
      })
    );
  }, [setNodes]);

  const displayNodes = useMemo(() => 
    nodes.map(n => ({ 
      ...n, 
      data: { 
        ...n.data, 
        isDemoDark,
        onRename: updateNodeLabel,
      } 
    })), 
    [nodes, isDemoDark, updateNodeLabel]
  );

  // Sync state whenever a chip is clicked
  const handleChipSelect = (chipId: 'loadBalancer') => {
    setActiveChip(chipId);
    const data = PRESETS[chipId];
    setTitle(data.title);
    setNodes(JSON.parse(JSON.stringify(data.nodes)));
    setEdges(JSON.parse(JSON.stringify(data.edges)));

    const nextHistory = [{ nodes: JSON.parse(JSON.stringify(data.nodes)), edges: JSON.parse(JSON.stringify(data.edges)) }];
    setHistory(nextHistory);
    setHistoryIndex(0);
  };

  // Push new state to history
  const pushState = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({
      nodes: JSON.parse(JSON.stringify(newNodes)),
      edges: JSON.parse(JSON.stringify(newEdges)),
    });
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }, [history, historyIndex]);

  // Node Drag Ending pushes to history
  const onNodeDragStop = useCallback(() => {
    pushState(nodes, edges);
  }, [nodes, edges, pushState]);

  // Undo implementation
  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setNodes(JSON.parse(JSON.stringify(history[nextIdx].nodes)));
      setEdges(JSON.parse(JSON.stringify(history[nextIdx].edges)));
    } else {
      toast.info('Nothing to undo');
    }
  };

  // Redo implementation
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setNodes(JSON.parse(JSON.stringify(history[nextIdx].nodes)));
      setEdges(JSON.parse(JSON.stringify(history[nextIdx].edges)));
    } else {
      toast.info('Nothing to redo');
    }
  };

  // Dagre Layout Rearranging
  const handleLayoutArrange = () => {
    const g = new dagre.graphlib.Graph({ compound: true });
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 160, ranksep: 200 });

    const groups = nodes.filter(n => n.type === 'demoGroup');
    const leafs = nodes.filter(n => n.type === 'demoNode');

    groups.forEach(group => {
      g.setNode(group.id, { width: group.style?.width as number || 360, height: group.style?.height as number || 160 });
    });

    leafs.forEach(node => {
      g.setNode(node.id, { width: 200, height: 72 });
      if (node.parentId) {
        g.setParent(node.id, node.parentId);
      }
    });

    edges.forEach(edge => {
      g.setEdge(edge.source, edge.target);
    });

    try {
      dagre.layout(g);

      const nextNodes = nodes.map(node => {
        const dagreNode = g.node(node.id);
        if (!dagreNode) return node;

        let x = dagreNode.x - (node.type === 'demoGroup' ? (node.style?.width as number || 360) : 200) / 2;
        let y = dagreNode.y - (node.type === 'demoGroup' ? (node.style?.height as number || 160) : 72) / 2;

        if (node.parentId) {
          const parentDagreNode = g.node(node.parentId);
          if (parentDagreNode) {
            const parentX = parentDagreNode.x - (groups.find(g => g.id === node.parentId)?.style?.width as number || 360) / 2;
            const parentY = parentDagreNode.y - (groups.find(g => g.id === node.parentId)?.style?.height as number || 160) / 2;
            x = x - parentX;
            y = y - parentY;
          }
        }

        // Snap to 20px grid increment
        x = Math.round(x / 20) * 20;
        y = Math.round(y / 20) * 20;

        return {
          ...node,
          position: { x, y }
        };
      });

      setNodes(nextNodes);
      pushState(nextNodes, edges);
      toast.success('Rearranged diagram layout');
    } catch (e) {
      toast.error('Could not layout diagram');
    }
  };

  // Submit Prompt input resolves to nearest preset
  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    handleChipSelect('loadBalancer');
    setInputText('');
    toast.success(`Generated: ${PRESETS.loadBalancer.title}`);
  };

  // Model State
  const [selectedModel, setSelectedModel] = useState('OpenAI GPT-4o');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // onConnect handler
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `e-${Date.now()}`,
        type: 'straight',
        className: 'flow-dotted-edge',
        style: { stroke: '#475569', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
      };
      const nextEdges = addEdge(newEdge, edges);
      setEdges(nextEdges);
      pushState(nodes, nextEdges);
      toast.success('Connected nodes');
    },
    [setEdges, nodes, edges, pushState]
  );

  // Add Node handler
  const handleAddNode = useCallback(() => {
    const newId = `node-${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type: 'demoNode',
      position: { x: 280, y: 120 },
      data: { 
        label: `Compute Service`, 
        subtitle: 'Node.js App', 
        layer: 'compute', 
        icon: '💻' 
      },
      draggable: true,
    };
    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    pushState(nextNodes, edges);
    toast.success('Added new compute node');
  }, [setNodes, nodes, edges, pushState]);

  // Delete Selected handler
  const handleDeleteSelected = useCallback(() => {
    const selectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    const selectedEdgeIds = new Set(edges.filter(e => e.selected).map(e => e.id));

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) {
      toast.info('No nodes or edges selected to delete');
      return;
    }

    const nextNodes = nodes.filter(n => !selectedNodeIds.has(n.id));
    const nextEdges = edges.filter(e => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target));

    setNodes(nextNodes);
    setEdges(nextEdges);
    pushState(nextNodes, nextEdges);
    toast.success('Deleted selected elements');
  }, [nodes, edges, setNodes, setEdges, pushState]);

  return (
    <div className={`w-full h-[400px] sm:h-[560px] lg:h-[740px] rounded-2xl overflow-hidden shadow-2xl relative border transition-colors duration-300 demo-theme-container ${
      isDemoDark 
        ? 'dark bg-[#090b0d] text-[#f7f8f8] border-[#202327]' 
        : 'bg-surface-panel text-text-primary border-border-default'
    }`}>
      <style jsx global>{`
        @keyframes flowDash {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        .flow-dotted-edge path.react-flow__edge-path {
          stroke-dasharray: 4 4;
          animation: flowDash 0.8s linear infinite;
        }
        .react-flow__edge-text {
          font-family: monospace;
          font-size: 9px;
          font-weight: 600;
        }
        .react-flow__edge-textbg {
          rx: 6px;
          ry: 6px;
        }
      `}</style>

      {/* Top Navigation Control Bar */}
      <div className="absolute top-3 left-0 right-0 px-4 z-10">
        <div className={`w-full rounded-2xl border px-4 py-2.5 flex items-center justify-between shadow-2xl transition-all duration-300 ${
          isDemoDark ? 'bg-[#0c0d10] border-[#202327]' : 'bg-white border-[#cbd5e1]'
        }`}>
          {/* Left panel items */}
          <div className="flex items-center gap-2">
            <button className={`p-1.5 rounded-lg transition-all ${
              isDemoDark ? 'text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-[#15171a]' : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
            }`} title="Toggle sidebar">
              <PanelLeftClose className="w-4 h-4" />
            </button>
            <button className={`p-1.5 rounded-lg transition-all ${
              isDemoDark ? 'text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-[#15171a]' : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
            }`} title="Open file">
              <FolderOpen className="w-4 h-4" />
            </button>
            <div className={`px-2 py-1 rounded-lg flex items-center gap-1 text-[11px] font-semibold transition-all cursor-pointer ${
              isDemoDark ? 'bg-[#18191c] text-[#f7f8f8]' : 'bg-[#f1f5f9] text-[#0f172a]'
            }`}>
              <LayoutDashboard className="w-3.5 h-3.5 text-[#1E90FF]" />
              <span>Dashboard</span>
            </div>
            <ChevronLeft className={`w-3.5 h-3.5 ${isDemoDark ? 'text-[#3f444e]' : 'text-[#cbd5e1]'}`} />
            
            {/* Title display */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all ${
              isDemoDark ? 'bg-[#121316] border-[#23252a] text-[#f7f8f8]' : 'bg-[#f1f5f9] border-[#cbd5e1] text-[#0f172a]'
            }`}>
              <span>{title}</span>
              <ChevronDown className="w-3 h-3 text-[#8a8f98]" />
            </div>

            <button 
              onClick={handleAddNode}
              className={`p-1.5 rounded-lg transition-all ${
                isDemoDark ? 'text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-[#15171a]' : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
              }`} 
              title="Add node"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Center panel items */}
          <div className="hidden lg:flex items-center gap-2">
            <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded transition-all ${
              isDemoDark ? 'bg-[#18191c] text-[#8a8f98]' : 'bg-[#e2e8f0] text-[#64748b]'
            }`}>
              {nodes.filter(n => n.type !== 'demoGroup' && n.type !== 'spacerNode').length} nodes | {edges.length} edges
            </span>

            {/* Undo/Redo */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className={`p-1.5 rounded-lg disabled:opacity-35 transition-colors ${
                  isDemoDark ? 'text-[#8a8f98] hover:text-white hover:bg-[#15171a]' : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                }`}
                title="Undo"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className={`p-1.5 rounded-lg disabled:opacity-35 transition-colors ${
                  isDemoDark ? 'text-[#8a8f98] hover:text-white hover:bg-[#15171a]' : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                }`}
                title="Redo"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right panel items */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div 
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 cursor-pointer text-[10px] font-semibold transition-all ${
                  isDemoDark ? 'bg-[#121316] border-[#23252a] text-[#f7f8f8]' : 'bg-[#f1f5f9] border-[#cbd5e1] text-[#0f172a]'
                }`}
              >
                <span>{selectedModel}</span>
                <ChevronDown className="w-3 h-3 text-[#8a8f98]" />
              </div>
              {modelDropdownOpen && (
                <div className={`absolute right-0 mt-1 w-36 rounded-lg border shadow-xl z-50 text-[10px] flex flex-col py-1 overflow-hidden transition-all ${
                  isDemoDark ? 'bg-[#0c0d10] border-[#202327] text-[#8a8f98]' : 'bg-white border-[#cbd5e1] text-[#64748b]'
                }`}>
                  {['OpenAI GPT-4o', 'Gemini 1.5 Pro', 'Claude 3.5 Sonnet'].map((model) => (
                    <button
                      key={model}
                      onClick={() => {
                        setSelectedModel(model);
                        setModelDropdownOpen(false);
                        toast.success(`Switched model to ${model}`);
                      }}
                      className={`px-3 py-1.5 text-left transition-all hover:bg-slate-100 dark:hover:bg-[#15171a] ${
                        selectedModel === model ? 'text-[#1E90FF] font-semibold' : ''
                      }`}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className={`w-px h-4 ${isDemoDark ? 'bg-[#23252a]' : 'bg-[#cbd5e1]'}`} />

            <button
              onClick={() => setIsDemoDark(!isDemoDark)}
              className={`p-1.5 rounded-lg border transition-all ${
                isDemoDark ? 'border-[#23252a] text-amber-500 hover:bg-[#15171a]' : 'border-[#cbd5e1] text-blue-500 hover:bg-[#f1f5f9]'
              }`}
              title="Toggle theme"
            >
              {isDemoDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            
            <button 
              onClick={handleDeleteSelected}
              className={`p-1.5 rounded-lg border transition-all ${
                isDemoDark ? 'border-[#23252a] text-[#8a8f98] hover:text-white hover:bg-[#15171a]' : 'border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
              }`}
              title="Delete selected"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            
            <button 
              className={`p-1.5 rounded-lg border transition-all ${
                isDemoDark ? 'border-[#23252a] text-[#8a8f98] hover:text-white hover:bg-[#15171a]' : 'border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
              }`}
              title="Share diagram"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button 
              className={`p-1.5 rounded-lg border transition-all ${
                isDemoDark ? 'border-[#23252a] text-[#8a8f98] hover:text-white hover:bg-[#15171a]' : 'border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
              }`}
              title="Download image"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button 
              className={`p-1.5 rounded-lg border transition-all ${
                isDemoDark ? 'border-[#23252a] text-[#8a8f98] hover:text-white hover:bg-[#15171a]' : 'border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
              }`}
              title="More options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main viewport canvas */}
      <div className="absolute inset-0 z-0" ref={containerRef}>
        {/* Left Floating Tool Palette */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-3 items-center">
          {/* Main vertical drawer card */}
          <div className={`p-2 rounded-2xl border flex flex-col gap-2.5 shadow-2xl transition-all duration-300 ${
            isDemoDark ? 'bg-[#0c0d10] border-[#202327] text-[#8a8f98]' : 'bg-white border-[#cbd5e1] text-[#64748b]'
          }`}>
            <button className={`p-2 rounded-xl transition-all ${
              isDemoDark ? 'hover:text-[#f7f8f8] hover:bg-[#15171a]' : 'hover:text-[#0f172a] hover:bg-[#f1f5f9]'
            }`} title="Blocks/Shapes">
              <LayoutGrid className="w-4 h-4 text-[#1E90FF]" />
            </button>
            <button className={`p-2 rounded-xl transition-all ${
              isDemoDark ? 'hover:text-[#f7f8f8] hover:bg-[#15171a]' : 'hover:text-[#0f172a] hover:bg-[#f1f5f9]'
            }`} title="Layers">
              <Layers className="w-4 h-4" />
            </button>
            <button className={`p-2 rounded-xl transition-all ${
              isDemoDark ? 'hover:text-[#f7f8f8] hover:bg-[#15171a]' : 'hover:text-[#0f172a] hover:bg-[#f1f5f9]'
            }`} title="Rectangle">
              <Square className="w-4 h-4" />
            </button>
            <button className={`p-2 rounded-xl transition-all ${
              isDemoDark ? 'hover:text-[#f7f8f8] hover:bg-[#15171a]' : 'hover:text-[#0f172a] hover:bg-[#f1f5f9]'
            }`} title="Line">
              <Slash className="w-4 h-4 -rotate-45" />
            </button>
            
            <span className={`w-6 h-px self-center ${isDemoDark ? 'bg-[#202327]' : 'bg-[#e2e8f0]'}`} />

            <button 
              onClick={handleAddNode}
              className={`p-2 rounded-xl transition-all ${
                isDemoDark ? 'hover:text-[#f7f8f8] hover:bg-[#15171a]' : 'hover:text-[#0f172a] hover:bg-[#f1f5f9]'
              }`} 
              title="Add Connection"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodesChange={(changes) => {
            const nextNodes = applyNodeChanges(changes, nodes);
            setNodes(nextNodes);
          }}
          onEdgesChange={(changes) => {
            const nextEdges = applyEdgeChanges(changes, edges);
            setEdges(nextEdges);
          }}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          nodeTypes={DEMO_NODE_TYPES}
          edgeTypes={DEMO_EDGE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          preventScrolling={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          maxZoom={1.5}
          snapToGrid={true}
          snapGrid={[20, 20]}
          connectionLineType={ConnectionLineType.SmoothStep}
          edgesFocusable={false}
          edgesUpdatable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={24} 
            size={2} 
            color={isDemoDark ? '#4b5563' : '#cbd5e1'} 
          />
        </ReactFlow>
      </div>

      {/* Bottom Floating prompt control bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[720px] z-10 flex flex-col items-center gap-3">
        {/* Input box */}
        <form onSubmit={handlePromptSubmit} className={`w-full flex items-center justify-between rounded-[20px] border p-1 pr-1.5 shadow-2xl transition-all duration-300 ${
          isDemoDark ? 'bg-[#0c0d10] border-[#202327]' : 'bg-white border-[#cbd5e1]'
        }`}>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pl-0.5">
            {/* Plus Button */}
            <button 
              type="button" 
              onClick={handleAddNode}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${
                isDemoDark ? 'bg-[#202327] text-[#8a8f98] hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
              }`}
              title="Add compute node"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Describe your architecture, or paste a GitHub repo link..."
              className={`bg-transparent border-none outline-none text-xs w-full py-1 px-1.5 min-w-0 font-normal ${
                isDemoDark ? 'text-white placeholder-[#62666d]' : 'text-[#0f172a] placeholder-[#94a3b8]'
              }`}
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {/* Green Status Dot */}
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_8px_#10b981] shrink-0" />

            {/* Code Toggle */}
            <button type="button" className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-[10px] font-semibold border transition-all ${
              isDemoDark ? 'border-[#23252a] text-[#8a8f98] hover:text-white' : 'border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]'
            }`}>
              <Code className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
            <button type="button" className={`p-1.5 rounded-lg text-[#8a8f98] hover:text-white`}>
              <Mic className="w-3.5 h-3.5" />
            </button>
            <button
              type="submit"
              className="w-8 h-8 rounded-full bg-[#5e6ad2] hover:bg-[#828fff] text-white flex items-center justify-center shrink-0 transition-colors shadow-md cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
