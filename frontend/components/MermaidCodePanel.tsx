'use client';

import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { X, Check, AlertCircle, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDiagramStore } from '@/store/diagramStore';
import { reactFlowToMermaid } from '@/lib/ai/pipeline/mermaid-pipeline/mermaidTranslator';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { toast } from 'sonner';

interface MermaidCodePanelProps {
  onClose: () => void;
}

interface MappedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  width: number;
  height: number;
  style?: CSSProperties;
  zIndex?: number;
  absX: number;
  absY: number;
  parentId?: string;
  parentNode?: string;
  extent?: 'parent' | [[number, number], [number, number]];
}

function hashNodesEdges(nodes: Record<string, unknown>[], edges: Record<string, unknown>[]): string {
  let h = `${nodes.length}:${edges.length}`;
  for (const n of nodes) h += `|${n.id}:${n.type}:${(n as { parentNode?: string }).parentNode || ''}`;
  for (const e of edges) h += `|${e.id}:${e.source}-${e.target}`;
  return h;
}

export function MermaidCodePanel({ onClose }: MermaidCodePanelProps) {
  const { nodes, edges, importDiagram } = useDiagramStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isFocusedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProcessedRef = useRef<string>('');


  const activeLayoutPresetId = useDiagramStore((s) => s.activeLayoutPresetId);
  const mermaidDirection = activeLayoutPresetId === 'layered-lr' ? 'LR' : 'TD';

  // Sync canvas changes to code panel only when structure actually changes
  const structureHash = useMemo(() => hashNodesEdges(nodes, edges), [nodes, edges]);
  useEffect(() => {
    if (isFocusedRef.current) return;
    const currentMermaid = reactFlowToMermaid(nodes, edges, mermaidDirection);
    setCode(currentMermaid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureHash, mermaidDirection]);

  // Copy code handler
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Mermaid code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  // Real-time parsed update function
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!newCode.trim()) {
        setError('Diagram code cannot be empty.');
        return;
      }

      if (newCode === lastProcessedRef.current) return;

      try {
        const result = runMermaidPipeline(newCode);

        if (!result.success) {
          setError(result.warnings.join('; '));
          return;
        }

        const store = useDiagramStore.getState();
        const existingNodes = store.nodes;
        const currentPresetId = store.activeLayoutPresetId;
        const newDirection = result.direction; // 'LR' or 'TD'

        // Determine if direction changed
        const currentDirection = currentPresetId === 'layered-lr' ? 'LR' : 'TD';
        const directionChanged = newDirection && newDirection !== currentDirection;

        // Helper to resolve absolute position of an existing node in the store
        const getExistingAbsPos = (nodeId: string) => {
          const node = existingNodes.find(n => n.id === nodeId);
          if (!node) return null;
          if (node.parentNode) {
            const parent = existingNodes.find(p => p.id === node.parentNode);
            if (parent) {
              return { x: node.position.x + parent.position.x, y: node.position.y + parent.position.y };
            }
          }
          return { x: node.position.x, y: node.position.y };
        };

        // Helper to resolve absolute position of a parsed node in the pipeline's layout
        const getParsedAbsPos = (nodeId: string) => {
          const node = result.nodes.find(n => n.id === nodeId);
          if (!node) return null;
          if (node.parentNode) {
            const parent = result.nodes.find(p => p.id === node.parentNode);
            if (parent) {
              return { x: node.position.x + parent.position.x, y: node.position.y + parent.position.y };
            }
          }
          return { x: node.position.x, y: node.position.y };
        };

        // Calculate layout delta shift (average distance offset of matching existing leaf nodes)
        let sumDeltaX = 0;
        let sumDeltaY = 0;
        let matchedCount = 0;

        result.nodes.forEach(node => {
          const isGroup = node.type === 'groupNode' || (node.data?.isGroup as boolean);
          if (isGroup) return;

          const existingAbs = getExistingAbsPos(node.id);
          const parsedAbs = getParsedAbsPos(node.id);
          if (existingAbs && parsedAbs) {
            sumDeltaX += (existingAbs.x - parsedAbs.x);
            sumDeltaY += (existingAbs.y - parsedAbs.y);
            matchedCount++;
          }
        });

        const avgDeltaX = matchedCount > 0 ? sumDeltaX / matchedCount : 0;
        const avgDeltaY = matchedCount > 0 ? sumDeltaY / matchedCount : 0;

        // Map parsed nodes
        const processedNodesMap = new Map<string, MappedNode>();
        const subgraphs = new Map<string, MappedNode>();
        const childIdsByParent = new Map<string, string[]>();

        const hexToRgba = (hex: string, alpha: number): string => {
          const cleanHex = hex.startsWith('#') ? hex : '#2563EB';
          const r = parseInt(cleanHex.slice(1, 3), 16) || 37;
          const g = parseInt(cleanHex.slice(3, 5), 16) || 99;
          const b = parseInt(cleanHex.slice(5, 7), 16) || 235;
          return `rgba(${r},${g},${b},${alpha})`;
        };

        result.nodes.forEach(node => {
          const isGroup = node.type === 'groupNode' || (node.data?.isGroup as boolean);
          const existingNode = existingNodes.find(n => n.id === node.id);
          const preserveNode = existingNode && !isGroup && !directionChanged;

          let absX = 0;
          let absY = 0;

          const parsedAbs = getParsedAbsPos(node.id);
          if (parsedAbs) {
            absX = parsedAbs.x;
            absY = parsedAbs.y;
          }

          if (preserveNode) {
            const existingAbs = getExistingAbsPos(node.id);
            if (existingAbs) {
              absX = existingAbs.x;
              absY = existingAbs.y;
            }
          } else if (!isGroup) {
            // Apply delta shift for new leaf nodes to align with existing nodes' space
            absX += avgDeltaX;
            absY += avgDeltaY;
          }

          // Check if label or subtitle changed in editor
          const labelChanged = existingNode && (
            node.data?.label !== existingNode.data?.label || 
            node.data?.subtitle !== existingNode.data?.subtitle
          );

          const width = (preserveNode && !labelChanged) ? (existingNode.width ?? node.width ?? 100) : (node.width ?? 100);
          const height = (preserveNode && !labelChanged) ? (existingNode.height ?? node.height ?? 60) : (node.height ?? 60);
          const nodeStyle = (preserveNode && !labelChanged) 
            ? (existingNode.style ? { ...existingNode.style } : (node.style ? { ...node.style } : undefined))
            : (node.style ? { ...node.style } : undefined);

          const mappedNode: MappedNode = {
            id: node.id,
            type: isGroup ? 'groupNode' : (existingNode?.type || 'shapeNode'),
            position: directionChanged ? { ...node.position } : { x: absX, y: absY },
            data: { 
              ...(existingNode?.data || {}),
              ...node.data
            },
            width,
            height,
            style: nodeStyle,
            zIndex: node.zIndex,
            absX,
            absY,
          };

          if (node.parentNode) {
            mappedNode.parentId = node.parentNode;
            mappedNode.parentNode = node.parentNode;
            mappedNode.extent = 'parent';
          }

          if (isGroup) {
            subgraphs.set(node.id, mappedNode);
          } else {
            processedNodesMap.set(node.id, mappedNode);
          }
        });

        // If direction did NOT change, recompute the bounding boxes of subgraphs (group nodes)
        // using the preserved/updated coordinates of their leaf child nodes.
        if (!directionChanged && subgraphs.size > 0) {
          processedNodesMap.forEach(node => {
            if (node.parentNode && subgraphs.has(node.parentNode)) {
              if (!childIdsByParent.has(node.parentNode)) {
                childIdsByParent.set(node.parentNode, []);
              }
              childIdsByParent.get(node.parentNode)!.push(node.id);
            }
          });

          subgraphs.forEach((subgraph, subId) => {
            const childIds = childIdsByParent.get(subId) || [];
            if (childIds.length > 0) {
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              
              childIds.forEach(childId => {
                const child = processedNodesMap.get(childId)!;
                const cx = child.absX;
                const cy = child.absY;
                const cw = child.width ?? 0;
                const ch = child.height ?? 0;
                if (cx < minX) minX = cx;
                if (cy < minY) minY = cy;
                if (cx + cw > maxX) maxX = cx + cw;
                if (cy + ch > maxY) maxY = cy + ch;
              });

              if (minX !== Infinity) {
                const pad = 40; // SUBGRAPH_PADDING
                const labelPad = 64;
                const newWidth = maxX - minX + pad * 2;
                const newHeight = maxY - minY + pad + labelPad;
                const newX = minX - pad;
                const newY = minY - labelPad;

                subgraph.position = { x: newX, y: newY };
                subgraph.width = newWidth;
                subgraph.height = newHeight;
                
                const groupColor = (subgraph.data?.color as string) || (subgraph.data?.groupColor as string) || '#2563EB';
                const bgRgba = hexToRgba(groupColor, 0.08);

                subgraph.style = {
                  ...(subgraph.style as CSSProperties || {}),
                  width: newWidth,
                  height: newHeight,
                  backgroundColor: bgRgba,
                  borderColor: groupColor,
                  borderRadius: '12px',
                } as CSSProperties;

                // Readjust children to be relative to parent new position
                childIds.forEach(childId => {
                  const child = processedNodesMap.get(childId)!;
                  child.position = {
                    x: child.absX - newX,
                    y: child.absY - newY,
                  };
                });
              }
            } else {
              // subgraph with no children
              const existingNode = existingNodes.find(n => n.id === subId);
              if (existingNode && !directionChanged) {
                subgraph.position = { ...existingNode.position };
                subgraph.width = existingNode.width ?? subgraph.width;
                subgraph.height = existingNode.height ?? subgraph.height;
                subgraph.style = existingNode.style;
              } else {
                subgraph.position = { x: subgraph.absX, y: subgraph.absY };
              }
            }
          });
        }

        // For all nodes, if they have no parentNode and direction did not change, set position to their absolute coordinate
        if (!directionChanged) {
          processedNodesMap.forEach(node => {
            if (!node.parentNode) {
              node.position = { x: node.absX, y: node.absY };
            }
          });
          
          subgraphs.forEach(subgraph => {
            const childIds = childIdsByParent.get(subgraph.id) || [];
            if (childIds.length === 0) {
              const existingNode = existingNodes.find(n => n.id === subgraph.id);
              if (existingNode) {
                subgraph.position = { ...existingNode.position };
              } else {
                subgraph.position = { x: subgraph.absX, y: subgraph.absY };
              }
            }
          });
        }

        const processedNodes = [
          ...Array.from(subgraphs.values()),
          ...Array.from(processedNodesMap.values())
        ];

        const processedEdges = result.edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          type: 'simpleFloating',
          label: edge.label,
          data: edge.data,
          animated: edge.animated,
        }));

        importDiagram(processedNodes, processedEdges);

        if (directionChanged) {
          store.setActiveLayoutPresetId(newDirection === 'LR' ? 'layered-lr' : 'layered-tb');
        }

        lastProcessedRef.current = newCode;
        setError(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Pipeline error: ${msg}`);
      }
    }, 400);
  };

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 20, stiffness: 150 }}
      className="fixed right-4 top-[80px] bottom-[180px] w-96 md:w-[450px] z-50 flex flex-col overflow-hidden bg-card/95 backdrop-blur-md border border-border/40 shadow-soft-3 rounded-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/10">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-primary" />
          <h2 className="text-sm font-semibold text-foreground">Mermaid Code Editor</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="floating-icon-btn !w-8 !h-8"
            title="Copy Code"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="floating-icon-btn !w-8 !h-8"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
        <textarea
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          onFocus={() => { isFocusedRef.current = true; }}
          onBlur={() => { isFocusedRef.current = false; }}
          spellCheck={false}
          className="flex-1 w-full p-4 font-mono text-xs text-foreground bg-muted/20 border border-border/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none rounded-xl resize-none leading-relaxed transition-all"
          placeholder="graph TD&#10;  subgraph CLIENT[&quot;Client Tier&quot;]&#10;    CV[&quot;Customer View&quot;]&#10;  end"
        />

        {/* Status / Errors */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Syntax Error</p>
                <p className="opacity-90 leading-relaxed break-words">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
