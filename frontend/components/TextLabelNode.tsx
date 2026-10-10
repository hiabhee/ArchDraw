'use client';

import { memo, useCallback, useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { NodeProps, useUpdateNodeInternals } from 'reactflow';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { useDiagramStore } from '@/store/diagramStore';
import {
  TEXT_LABEL_FONT_SIZE,
  TEXT_LABEL_FONT_WEIGHT,
  estimateTextNodeSize,
  resolveTextLabelColor,
  type TextSize,
} from '@/lib/utils/textSizing';

export interface TextLabelNodeData {
  text?: string;
  label?: string;
  fontSize?: TextSize;
  bold?: boolean;
  color?: string;
  anchor?: 'top' | 'subgraph' | 'node' | 'none';
  anchorTarget?: string;
  autoStartTextEdit?: boolean;
}

export type { TextSize } from '@/lib/utils/textSizing';

/** Compact editor chrome — independent of the rendered label size (S/M/L/H). */
const EDIT_INPUT_FONT_SIZE = 14;
const EDIT_INPUT_MIN_WIDTH = 220;
const EDIT_INPUT_MAX_WIDTH = 560;
const EDIT_INPUT_HEIGHT = 32;
const AUTO_START_FOCUS_MS = 400;

function resolveTextLabelContent(data: TextLabelNodeData): string {
  const raw = data.text ?? data.label;
  return typeof raw === 'string' ? raw : '';
}

function TextLabelNodeComponent({ id, data }: NodeProps<TextLabelNodeData>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const isDark = useDiagramStore((s) => s.darkMode);
  const resolvedText = resolveTextLabelContent(data);
  const textColor = resolveTextLabelColor(data.color, isDark);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(resolvedText);
  const [currentSize, setCurrentSize] = useState<TextSize>(data.fontSize ?? 'medium');
  const [isBold, setIsBold] = useState(data.bold ?? false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editInputWidth, setEditInputWidth] = useState(EDIT_INPUT_MIN_WIDTH);
  const didAutoStartRef = useRef(false);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, text, currentSize]);

  const fontSize = TEXT_LABEL_FONT_SIZE[currentSize];
  const fontWeight = isBold ? 700 : TEXT_LABEL_FONT_WEIGHT[currentSize];

  const SIZE_ORDER: TextSize[] = useMemo(() => ['small', 'medium', 'large', 'heading'], []);

  const [prevDataVals, setPrevDataVals] = useState([
    resolvedText,
    data.fontSize,
    data.bold,
    data.autoStartTextEdit,
  ]);

  if (
    resolvedText !== prevDataVals[0] ||
    data.fontSize !== prevDataVals[1] ||
    data.bold !== prevDataVals[2] ||
    data.autoStartTextEdit !== prevDataVals[3]
  ) {
    setPrevDataVals([resolvedText, data.fontSize, data.bold, data.autoStartTextEdit]);
    if (!editing) {
      setText(resolvedText);
      setCurrentSize(data.fontSize ?? 'medium');
      setIsBold(data.bold ?? false);
    }
  }

  const persistTextLabel = useCallback(
    (patch: Partial<TextLabelNodeData>) => {
      useDiagramStore.getState().updateNodeData(id, patch);
    },
    [id],
  );

  const syncNodeDimensions = useCallback(
    (content: string, size: TextSize) => {
      const dims = estimateTextNodeSize(content || 'Text', size);
      useDiagramStore.getState().updateNodeSize(id, { width: dims.width, height: dims.height });
    },
    [id],
  );

  const updateNodeFontSize = useCallback(
    (size: TextSize) => {
      setCurrentSize(size);
      persistTextLabel({ fontSize: size });
      syncNodeDimensions(text, size);
    },
    [persistTextLabel, syncNodeDimensions, text],
  );

  const updateNodeBold = useCallback(
    (bold: boolean) => {
      setIsBold(bold);
      persistTextLabel({ bold });
    },
    [persistTextLabel],
  );

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

  const startEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditing(true);
      setCurrentSize(data.fontSize ?? 'medium');
      setIsBold(data.bold ?? false);
      setText(resolveTextLabelContent(data));
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [data],
  );

  const commitEdit = useCallback(() => {
    setEditing(false);
    const committed = text;
    persistTextLabel({
      text: committed,
      label: committed,
      fontSize: currentSize,
      bold: isBold,
      autoStartTextEdit: false,
    });
    syncNodeDimensions(committed, currentSize);
  }, [text, currentSize, isBold, persistTextLabel, syncNodeDimensions]);

  useLayoutEffect(() => {
    if (!editing || !mirrorRef.current) return;
    const measured = mirrorRef.current.offsetWidth + 22;
    setEditInputWidth(
      Math.min(EDIT_INPUT_MAX_WIDTH, Math.max(EDIT_INPUT_MIN_WIDTH, measured)),
    );
  }, [editing, text, isBold]);

  // One-shot auto-start when the store sets autoStartTextEdit (e.g. T key):
  // must run imperatively to enter edit mode before the store clears the flag,
  // matching the pattern in useInlineLabelEdit.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!data.autoStartTextEdit || didAutoStartRef.current) return;
    didAutoStartRef.current = true;
    setEditing(true);
    setText('');
    persistTextLabel({ autoStartTextEdit: false });

    const focusInput = () => inputRef.current?.focus({ preventScroll: true });
    focusInput();
    const timeouts = [0, 16, 50, 100].map((ms) => window.setTimeout(focusInput, ms));
    return () => timeouts.forEach(clearTimeout);
  }, [data.autoStartTextEdit, persistTextLabel]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!editing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'b') {
        e.preventDefault();
        const newBold = !isBold;
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
    }, AUTO_START_FOCUS_MS);

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

      {editing ? (
        <div
          className="nodrag nopan"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            pointerEvents: 'all',
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
                updateNodeBold(newBold);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
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
                onClick={() => updateNodeFontSize(size)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
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
          <div style={{ position: 'relative', width: editInputWidth }}>
            <span
              ref={mirrorRef}
              aria-hidden
              className="invisible absolute left-0 top-0 whitespace-pre pointer-events-none"
              style={{
                fontSize: EDIT_INPUT_FONT_SIZE,
                fontWeight: isBold ? 600 : 400,
                fontFamily: 'inherit',
                padding: '0 10px',
              }}
            >
              {text || 'Type label text…'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') commitEdit();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitEdit();
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                fontSize: EDIT_INPUT_FONT_SIZE,
                fontWeight: isBold ? 600 : 400,
                color: textColor,
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                outline: 'none',
                borderRadius: 6,
                padding: '0 10px',
                fontFamily: 'inherit',
                lineHeight: `${EDIT_INPUT_HEIGHT}px`,
                height: EDIT_INPUT_HEIGHT,
                width: editInputWidth,
                maxWidth: EDIT_INPUT_MAX_WIDTH,
                boxSizing: 'border-box',
                display: 'block',
              }}
              placeholder="Type label text…"
            />
          </div>
        </div>
      ) : (
        <span
          style={{
            fontSize,
            fontWeight,
            color: textColor,
            lineHeight: 1.3,
            whiteSpace: 'pre-wrap',
            cursor: 'default',
            display: 'block',
            padding: '4px',
            userSelect: 'none',
          }}
        >
          {text || (
            <span className="text-text-muted italic opacity-60">Double-click to edit</span>
          )}
        </span>
      )}
    </div>
  );
}

export const TextLabelNode = memo(TextLabelNodeComponent);
