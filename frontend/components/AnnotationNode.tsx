'use client';

import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow, useUpdateNodeInternals } from 'reactflow';
import { hexToRgba } from '@/lib/utils';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import {
  ANNOTATION_FONT_SIZE,
  ANNOTATION_FONT_WEIGHT,
  type TextSize,
} from '@/lib/utils/textSizing';

export interface AnnotationNodeData {
  title?: string;
  titleSize?: TextSize;
  titleBold?: boolean;
  body?: string;
  bodySize?: TextSize;
  bodyBold?: boolean;
}

const FONT_SIZE_MAP: Record<TextSize, number> = ANNOTATION_FONT_SIZE;

const FONT_WEIGHT_MAP: Record<TextSize, number> = ANNOTATION_FONT_WEIGHT;

interface SizeButtonProps {
  size: TextSize;
  currentSize: TextSize;
  onClick: () => void;
}

function SizeButton({ size, currentSize, onClick }: SizeButtonProps) {
  const labels = { small: 'S', medium: 'M', large: 'L', heading: 'H' };
  const isActive = currentSize === size;
  
  return (
    <button
      onClick={onClick}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className={`w-8 h-8 shrink-0 flex items-center justify-center rounded text-xs font-bold select-none ${
        isActive 
          ? 'bg-primary text-primary-foreground shadow-sm' 
          : 'bg-transparent text-muted-foreground hover:bg-muted'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      title={size.charAt(0).toUpperCase() + size.slice(1)}
    >
      {labels[size]}
    </button>
  );
}

function AnnotationNodeComponent({ id, data, selected }: NodeProps<AnnotationNodeData>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const { setNodes } = useReactFlow();
  
  // Use state only for the values being edited, initialized from props
  const [title, setTitle] = useState(data.title ?? '');
  const [body, setBody] = useState(data.body ?? '');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [activeField, setActiveField] = useState<'title' | 'body' | null>(null);
  
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const SIZE_ORDER: TextSize[] = useMemo(() => ['small', 'medium', 'large', 'heading'], []);
  
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  // Derived values from data prop (single source of truth)
  const titleSize = data.titleSize ?? 'heading';
  const titleBold = data.titleBold ?? true;
  const bodySize = data.bodySize ?? 'medium';
  const bodyBold = data.bodyBold ?? false;

  const currentSize = activeField === 'title' ? titleSize : bodySize;
  const currentBold = activeField === 'title' ? titleBold : bodyBold;
  
  const updateTitleSize = useCallback((size: TextSize) => {
    setNodes((nds) => nds.map((n) => 
      n.id === id ? { ...n, data: { ...n.data, titleSize: size } } : n
    ));
  }, [id, setNodes]);
  
  const updateTitleBold = useCallback((bold: boolean) => {
    setNodes((nds) => nds.map((n) => 
      n.id === id ? { ...n, data: { ...n.data, titleBold: bold } } : n
    ));
  }, [id, setNodes]);
  
  const updateBodySize = useCallback((size: TextSize) => {
    setNodes((nds) => nds.map((n) => 
      n.id === id ? { ...n, data: { ...n.data, bodySize: size } } : n
    ));
  }, [id, setNodes]);
  
  const updateBodyBold = useCallback((bold: boolean) => {
    setNodes((nds) => nds.map((n) => 
      n.id === id ? { ...n, data: { ...n.data, bodyBold: bold } } : n
    ));
  }, [id, setNodes]);
  
  const setCurrentSize = useCallback((size: TextSize) => {
    if (activeField === 'title') {
      updateTitleSize(size);
    } else {
      updateBodySize(size);
    }
  }, [activeField, updateTitleSize, updateBodySize]);
  
  const setCurrentBold = useCallback((bold: boolean) => {
    if (activeField === 'title') {
      updateTitleBold(bold);
    } else {
      updateBodyBold(bold);
    }
  }, [activeField, updateTitleBold, updateBodyBold]);

  const increaseSize = useCallback(() => {
    const idx = SIZE_ORDER.indexOf(currentSize);
    if (idx < SIZE_ORDER.length - 1) setCurrentSize(SIZE_ORDER[idx + 1]);
  }, [currentSize, SIZE_ORDER, setCurrentSize]);

  const decreaseSize = useCallback(() => {
    const idx = SIZE_ORDER.indexOf(currentSize);
    if (idx > 0) setCurrentSize(SIZE_ORDER[idx - 1]);
  }, [currentSize, SIZE_ORDER, setCurrentSize]);

  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    setActiveField(null);
    setNodes((nds) => nds.map((n) => 
      n.id === id ? { ...n, data: { ...n.data, title, titleSize, titleBold } } : n
    ));
  }, [id, title, titleSize, titleBold, setNodes]);

  const commitBody = useCallback(() => {
    setEditingBody(false);
    setActiveField(null);
    setNodes((nds) => nds.map((n) => 
      n.id === id ? { ...n, data: { ...n.data, body, bodySize, bodyBold } } : n
    ));
  }, [id, body, bodySize, bodyBold, setNodes]);

  useEffect(() => {
    if (!editingTitle && !editingBody) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      
      if (isMod && e.key === 'b') {
        e.preventDefault();
        setCurrentBold(!currentBold);
        return;
      }
      
      if (isMod && e.shiftKey && (e.key === '.' || e.key === '>')) {
        e.preventDefault();
        increaseSize();
        return;
      }
      
      if (isMod && e.shiftKey && (e.key === ',' || e.key === '<')) {
        e.preventDefault();
        decreaseSize();
        return;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingTitle, editingBody, currentBold, increaseSize, decreaseSize, setCurrentBold]);

  useEffect(() => {
    const isEditing = editingTitle || editingBody;
    if (!isEditing) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (containerRef.current && !containerRef.current.contains(target)) {
        if (editingTitle) commitTitle();
        if (editingBody) commitBody();
      }
    };
    
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingTitle, editingBody, commitTitle, commitBody]);

  const handleStyle = {
    width: 12,
    height: 12,
    background: 'var(--node-card-bg, #ffffff)',
    border: '2px solid var(--node-accent, #0d9488)',
    borderRadius: '50%',
  };

  const renderSizeToolbar = () => (
    <div 
      className="flex items-center gap-0.5 bg-card/95 backdrop-blur-sm border border-border rounded-md px-1.5 py-1 shadow-lg"
      style={{ width: 'fit-content', flexShrink: 0 }}
    >
      <button
        onClick={() => setCurrentBold(!currentBold)}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className={`w-8 h-8 shrink-0 flex items-center justify-center rounded text-xs font-bold select-none ${
          currentBold 
            ? 'bg-primary text-primary-foreground shadow-sm' 
            : 'bg-transparent text-muted-foreground hover:bg-muted'
        }`}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        title="Bold (Cmd+B)"
      >
        B
      </button>
      <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
      {SIZE_ORDER.map((size) => (
        <SizeButton
          key={size}
          size={size}
          currentSize={currentSize}
          onClick={() => setCurrentSize(size)}
        />
      ))}
    </div>
  );

  return (
    <>
      <NodeResizer
        minWidth={160}
        minHeight={100}
        isVisible={!!selected}
        lineStyle={{ borderColor: 'hsl(var(--border))', borderWidth: 1 }}
        handleStyle={{ width: 8, height: 8, background: 'hsl(var(--muted-foreground))', borderRadius: 2 }}
      />

      <div
        ref={containerRef}
        className="annotation-node"
        style={{
          width: '100%',
          height: '100%',
          minWidth: 0,
          border: `1px solid hsl(var(--border))`,
          borderRadius: 8,
          background: 'hsl(var(--card))',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          padding: '10px 12px',
          gap: 4,
          boxShadow: selected ? '0 0 0 2px hsl(var(--ring)/0.3)' : undefined,
        }}
      >
        {/* ── Handles — only render directions actually referenced by edges ── */}
        <NodeHandles handleStyle={handleStyle} nodeId={id} />

        {editingTitle && (
          <div 
            className="nodrag nopan"
            style={{ marginBottom: 4, pointerEvents: 'all' }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {renderSizeToolbar()}
          </div>
        )}

        {editingTitle ? (
          <input
            ref={titleRef}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); e.stopPropagation(); }}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={() => setActiveField('title')}
            placeholder="Title..."
            className="nodrag nopan"
            style={{
              fontSize: FONT_SIZE_MAP[titleSize],
              fontWeight: titleBold ? 700 : FONT_WEIGHT_MAP[titleSize],
              color: 'hsl(var(--foreground))',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              minWidth: 50,
              maxWidth: '100%',
              padding: 0,
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            onDoubleClick={(e) => { 
              e.stopPropagation();
              setEditingTitle(true); 
              setActiveField('title');
              setTimeout(() => titleRef.current?.focus(), 0); 
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              fontSize: FONT_SIZE_MAP[titleSize],
              fontWeight: titleBold ? 700 : FONT_WEIGHT_MAP[titleSize],
              color: title ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              cursor: 'text',
              userSelect: 'none',
              minHeight: 20,
            }}
          >
            {title || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Double-click to add title</span>}
          </div>
        )}

        <div style={{ height: 1, background: 'hsl(var(--border))', flexShrink: 0 }} />

        {editingBody && (
          <div 
            className="nodrag nopan"
            style={{ marginTop: 4, pointerEvents: 'all' }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {renderSizeToolbar()}
          </div>
        )}

        {editingBody ? (
          <textarea
            ref={bodyRef}
            value={body}
            autoFocus
            onChange={(e) => setBody(e.target.value)}
            onBlur={commitBody}
            onKeyDown={(e) => { if (e.key === 'Escape') commitBody(); e.stopPropagation(); }}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={() => setActiveField('body')}
            placeholder="Add notes..."
            className="nodrag nopan"
            style={{
              fontSize: FONT_SIZE_MAP[bodySize],
              fontWeight: bodyBold ? 700 : FONT_WEIGHT_MAP[bodySize],
              color: 'hsl(var(--foreground))',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              flex: 1,
              fontFamily: 'inherit',
              lineHeight: 1.5,
              width: '100%',
              minHeight: 40,
              maxHeight: '100%',
              padding: 0,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          />
        ) : (
          <div
            onDoubleClick={(e) => { 
              e.stopPropagation();
              setEditingBody(true); 
              setActiveField('body');
              setTimeout(() => bodyRef.current?.focus(), 0); 
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              fontSize: FONT_SIZE_MAP[bodySize],
              fontWeight: bodyBold ? 700 : FONT_WEIGHT_MAP[bodySize],
              color: body ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              cursor: 'text',
              userSelect: 'none',
              flex: 1,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              minHeight: 40,
            }}
          >
            {body || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Double-click to add notes...</span>}
          </div>
        )}
      </div>
    </>
  );
}

export const AnnotationNode = memo(AnnotationNodeComponent);
