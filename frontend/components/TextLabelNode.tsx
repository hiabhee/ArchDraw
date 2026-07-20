'use client';

import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { NodeProps, useReactFlow, useUpdateNodeInternals } from 'reactflow';
import { NodeHandles } from '@/components/nodes/NodeHandles';

export interface TextLabelNodeData {
  text: string;
  fontSize?: 'small' | 'medium' | 'large' | 'heading';
  bold?: boolean;
  color?: string;
}

export type TextSize = 'small' | 'medium' | 'large' | 'heading';

const FONT_SIZE_MAP: Record<TextSize, number> = {
  small: 24,
  medium: 32,
  large: 48,
  heading: 72,
};

const FONT_WEIGHT_MAP: Record<TextSize, number> = {
  small: 400,
  medium: 500,
  large: 600,
  heading: 700,
};

function TextLabelNodeComponent({ id, data }: NodeProps<TextLabelNodeData>) {
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.text);
  const [currentSize, setCurrentSize] = useState<TextSize>(data.fontSize ?? 'medium');
  const [isBold, setIsBold] = useState(data.bold ?? false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);
  
  const fontSize = FONT_SIZE_MAP[currentSize];
  const fontWeight = isBold ? 700 : FONT_WEIGHT_MAP[currentSize];
  const color = data.color ?? 'hsl(var(--foreground))';

  const SIZE_ORDER: TextSize[] = useMemo(() => ['small', 'medium', 'large', 'heading'], []);

  const [prevDataVals, setPrevDataVals] = useState([data.text, data.fontSize, data.bold]);
  
  if (
    data.text !== prevDataVals[0] || 
    data.fontSize !== prevDataVals[1] || 
    data.bold !== prevDataVals[2]
  ) {
    setPrevDataVals([data.text, data.fontSize, data.bold]);
    setText(data.text);
    setCurrentSize(data.fontSize ?? 'medium');
    setIsBold(data.bold ?? false);
  }
  
  const updateNodeFontSize = useCallback((size: TextSize) => {
    setNodes((nds) => nds.map((n) => 
      n.id === id ? { ...n, data: { ...n.data, fontSize: size } } : n
    ));
  }, [id, setNodes]);
  
  const updateNodeBold = useCallback((bold: boolean) => {
    setNodes((nds) => nds.map((n) => 
      n.id === id ? { ...n, data: { ...n.data, bold } } : n
    ));
  }, [id, setNodes]);
  
  const increaseSize = useCallback(() => {
    const idx = SIZE_ORDER.indexOf(currentSize);
    if (idx < SIZE_ORDER.length - 1) {
      updateNodeFontSize(SIZE_ORDER[idx + 1]);
    }
  }, [currentSize, updateNodeFontSize, SIZE_ORDER]);
  
  const decreaseSize = useCallback(() => {
    const idx = SIZE_ORDER.indexOf(currentSize);
    if (idx > 0) {
      updateNodeFontSize(SIZE_ORDER[idx - 1]);
    }
  }, [currentSize, updateNodeFontSize, SIZE_ORDER]);

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setCurrentSize(data.fontSize ?? 'medium');
    setIsBold(data.bold ?? false);
    setText(data.text);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [data.fontSize, data.bold, data.text]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    setNodes((nds) => nds.map((n) => 
      n.id === id ? { ...n, data: { ...n.data, text, fontSize: currentSize, bold: isBold } } : n
    ));
  }, [id, text, currentSize, isBold, setNodes]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 30)}px`;
    }
  }, [text, editing]);

  useEffect(() => {
    if (!editing) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      
      if (isMod && e.key === 'b') {
        e.preventDefault();
        const newBold = !isBold;
        setIsBold(newBold);
        updateNodeBold(newBold);
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
  }, [editing, increaseSize, decreaseSize, isBold, updateNodeBold]);

  useEffect(() => {
    if (!editing) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (containerRef.current && !containerRef.current.contains(target)) {
        commitEdit();
      }
    };
    
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editing, commitEdit]);

  const handleStyle = {
    width: 12,
    height: 12,
    background: 'var(--node-card-bg, #ffffff)',
    border: '2px solid var(--node-accent, #0d9488)',
    borderRadius: '50%',
  };

  return (
    <div
      ref={containerRef}
      style={{ 
        position: 'relative', 
        minWidth: 60, 
        width: 'fit-content', 
        height: 'fit-content',
      }}
      onDoubleClick={startEdit}
      className="text-label-node"
    >
      <NodeHandles handleStyle={handleStyle} nodeId={id} />

      {editing && (
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            pointerEvents: 'all',
            marginTop: 8,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="flex items-center gap-0.5 bg-card/95 backdrop-blur-sm border border-border rounded-md px-1.5 py-1 shadow-lg"
            style={{ width: 'fit-content', flexShrink: 0 }}
          >
            <button
              onClick={() => {
                const newBold = !isBold;
                setIsBold(newBold);
                updateNodeBold(newBold);
              }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className={`w-8 h-8 shrink-0 flex items-center justify-center rounded text-xs font-bold select-none ${
                isBold 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'bg-transparent text-muted-foreground hover:bg-muted'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              title="Bold (Cmd+B)"
            >
              B
            </button>
            <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
            {SIZE_ORDER.map((size, index) => (
              <button
                key={`${size}-${index}`}
                onClick={() => {
                  setCurrentSize(size);
                  updateNodeFontSize(size);
                }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className={`w-8 h-8 shrink-0 flex items-center justify-center rounded text-xs font-bold select-none ${
                  currentSize === size
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'bg-transparent text-muted-foreground hover:bg-muted'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                title={size.charAt(0).toUpperCase() + size.slice(1)}
              >
                {{ small: 'S', medium: 'M', large: 'L', heading: 'H' }[size]}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') commitEdit();
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              fontSize,
              fontWeight,
              color,
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              outline: 'none',
              borderRadius: 4,
              resize: 'none',
              padding: '8px',
              fontFamily: 'inherit',
              lineHeight: 1.3,
              minWidth: 100,
              maxWidth: 300,
              width: 200,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
            rows={1}
            placeholder="Type something..."
          />
        </div>
      )}

      <span
        style={{
          fontSize,
          fontWeight,
          color,
          lineHeight: 1.3,
          whiteSpace: 'pre-wrap',
          cursor: 'default',
          display: 'block',
          padding: '4px',
          userSelect: 'none',
        }}
      >
        {text || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Double-click to edit</span>}
      </span>
    </div>
  );
}

export const TextLabelNode = memo(TextLabelNodeComponent);
