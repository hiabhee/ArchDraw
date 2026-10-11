'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Check, AlertCircle, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDiagramStore } from '@/store/diagramStore';
import { useShallow } from 'zustand/react/shallow';
import { reactFlowToMermaid } from '@/lib/ai/pipeline/mermaid-pipeline/mermaidTranslator';
import { runMermaidPipeline } from '@/lib/diagram/mermaid/pipeline';
import { mergePreservingLayout } from '@/lib/diagram/mermaid/mergePreservingLayout';
import type { Edge, Node } from 'reactflow';
import { toast } from 'sonner';

interface MermaidCodePanelProps {
  onClose: () => void;
}

function hashNodesEdges(nodes: Record<string, unknown>[], edges: Record<string, unknown>[]): string {
  let h = `${nodes.length}:${edges.length}`;
  for (const n of nodes) {
    const data = n.data as Record<string, unknown> | undefined;
    h += `|${n.id}:${n.type}:${(n as { parentNode?: string }).parentNode || ''}:${data?.label ?? ''}:${data?.shape ?? ''}:${data?.direction ?? ''}`;
  }
  for (const e of edges) {
    const data = e.data as Record<string, unknown> | undefined;
    h += `|${e.id}:${e.source}-${e.target}:${e.label ?? data?.label ?? ''}:${data?.edgeVariant ?? ''}:${data?.connectionType ?? ''}:${data?.edgeType ?? ''}`;
  }
  return h;
}

export function MermaidCodePanel({ onClose }: MermaidCodePanelProps) {
  const { nodes, edges, importDiagram } = useDiagramStore(useShallow((s) => ({ nodes: s.nodes, edges: s.edges, importDiagram: s.importDiagram })));
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
    } catch {
      toast.error('Failed to copy code');
    }
  };

  // Real-time parsed update function
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (!newCode.trim()) {
        setError('Diagram code cannot be empty.');
        return;
      }

      if (newCode === lastProcessedRef.current) return;

      try {
        const result = await runMermaidPipeline(newCode);

        if (!result.success) {
          setError((result.error?.message ?? result.warnings.join('; ')) || 'Failed to render Mermaid diagram.');
          return;
        }

        const store = useDiagramStore.getState();
        const existingNodes = store.nodes;
        const currentPresetId = store.activeLayoutPresetId;
        const newDirection = result.data.direction; // 'LR' or 'TD'

        // Determine if direction changed
        const currentDirection = currentPresetId === 'layered-lr' ? 'LR' : 'TD';
        const directionChanged = newDirection && newDirection !== currentDirection;

        const { nodes: processedNodes, edges: processedEdges } = mergePreservingLayout(
          existingNodes,
          { nodes: result.data.nodes as Node[], edges: result.data.edges as Edge[] },
          { directionChanged: Boolean(directionChanged) },
        );

        if (processedNodes.length === 0 && processedEdges.length === 0) {
          setError('No nodes or edges were parsed from this Mermaid code. Check that it contains at least one node and try again.');
          return;
        }

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
      className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] top-[72px] sm:left-auto sm:right-4 sm:top-[80px] sm:bottom-[180px] w-auto sm:w-96 md:w-[450px] z-50 flex flex-col overflow-hidden bg-card/95 backdrop-blur-md border border-border/40 shadow-soft-3 rounded-2xl max-h-[calc(100dvh-200px)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-border/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-2 w-2 rounded-full bg-primary shrink-0" />
          <h2 className="text-sm font-semibold text-foreground truncate">Mermaid Code</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-brand-bg transition-all"
            title="Copy Code"
            aria-label="Copy code"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-brand-bg transition-all"
            title="Close Panel"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col gap-3 overflow-hidden min-h-0">
        <textarea
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          onFocus={() => { isFocusedRef.current = true; }}
          onBlur={() => { isFocusedRef.current = false; }}
          spellCheck={false}
          className="flex-1 w-full p-3 sm:p-4 font-mono text-sm sm:text-xs text-foreground bg-muted/20 border border-border/40 focus:border-border focus:ring-0 focus-visible:outline-none focus-visible:ring-0 outline-none rounded-xl resize-none leading-relaxed transition-colors [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
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
