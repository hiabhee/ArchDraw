'use client';

import { memo, useCallback, useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { NodeProps, NodeToolbar, Position, useUpdateNodeInternals } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { NodeHandles } from '@/components/canvas/nodes/NodeHandles';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { useCanvasTheme } from '@/lib/theme/appTheme';
import { useDiagramStore } from '@/store/diagramStore';
import {
  TEXT_LABEL_FONT_SIZE,
  TEXT_LABEL_FONT_WEIGHT,
  TEXT_LABEL_SWATCHES,
  estimateTextNodeSize,
  resolveTextLabelColor,
  type TextSize,
} from '@/lib/diagram/nodes/textSizing';

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

export type { TextSize } from '@/lib/diagram/nodes/textSizing';

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

const STYLE_SIZES: TextSize[] = ['small', 'medium', 'large', 'heading'];
const SIZE_LETTER: Record<TextSize, string> = { small: 'S', medium: 'M', large: 'L', heading: 'H' };

const STYLE_BUTTON =
  'h-7 min-w-7 px-1.5 inline-flex items-center justify-center rounded-md text-xs font-semibold select-none transition-colors duration-150';
const STYLE_BUTTON_IDLE = 'text-text-secondary hover:bg-muted hover:text-text-primary';
const STYLE_BUTTON_ON = 'bg-brand/15 text-brand-text ring-1 ring-brand/40';

interface TextLabelStyleBarProps {
  size: TextSize;
  bold: boolean;
  color: string;
  onSize: (size: TextSize) => void;
  onBold: () => void;
  onColor: (color: string) => void;
  onDelete: () => void;
}

/**
 * Floating style bar shown above a selected text label (Excalidraw-style).
 * Token-only colors so it reads on both the light and the night canvas.
 */
function TextLabelStyleBar({ size, bold, color, onSize, onBold, onColor, onDelete }: TextLabelStyleBarProps) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      role="toolbar"
      aria-label="Text style"
      className="nodrag nopan flex items-center gap-0.5 rounded-lg border border-border bg-surface-panel px-1.5 py-1 shadow-lg ring-1 ring-black/10"
      onMouseDown={stop}
      onClick={stop}
      onDoubleClick={stop}
    >
      <button
        type="button"
        aria-pressed={bold}
        title="Bold (Cmd+B)"
        onClick={onBold}
        className={`${STYLE_BUTTON} font-bold ${bold ? STYLE_BUTTON_ON : STYLE_BUTTON_IDLE}`}
      >
        B
      </button>
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
      {STYLE_SIZES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={size === option}
          title={option.charAt(0).toUpperCase() + option.slice(1)}
          onClick={() => onSize(option)}
          className={`${STYLE_BUTTON} ${size === option ? STYLE_BUTTON_ON : STYLE_BUTTON_IDLE}`}
        >
          {SIZE_LETTER[option]}
        </button>
      ))}
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
      {TEXT_LABEL_SWATCHES.map((swatch) => {
        const active = (color || '') === swatch.color;
        return (
          <button
            key={swatch.id}
            type="button"
            aria-pressed={active}
            title={swatch.label}
            onClick={() => onColor(swatch.color)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150 hover:bg-muted ${
              active ? 'ring-1 ring-brand/60 bg-brand/10' : ''
            }`}
          >
            <span
              aria-hidden
              className={`block h-3.5 w-3.5 rounded-full border border-black/10 ${swatch.color ? '' : 'bg-text-primary'}`}
              style={swatch.color ? { backgroundColor: swatch.color } : undefined}
            />
          </button>
        );
      })}
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
      <button
        type="button"
        title="Delete (Del)"
        aria-label="Delete text"
        onClick={onDelete}
        className={`${STYLE_BUTTON} ${STYLE_BUTTON_IDLE} hover:text-destructive`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

function TextLabelNodeComponent({ id, data, selected }: NodeProps<TextLabelNodeData>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const { isDark } = useCanvasTheme();
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

  const { readOnly } = useCanvasView();
  const persistTextLabel = useCallback(
    (patch: Partial<TextLabelNodeData>) => {
      if (readOnly) return;
      useDiagramStore.getState().updateNodeData(id, patch);
    },
    [id, readOnly],
  );

  /** Style-bar changes are undoable: one history step per click, then the persisted patch. */
  const applyStyle = useCallback(
    (patch: Partial<TextLabelNodeData>) => {
      if (readOnly) return;
      // updateNodeData records the undo step itself.
      persistTextLabel(patch);
    },
    [persistTextLabel, readOnly],
  );

  const syncNodeDimensions = useCallback(
    (content: string, size: TextSize) => {
      if (readOnly) return;
      const dims = estimateTextNodeSize(content || 'Text', size);
      useDiagramStore.getState().updateNodeSize(id, { width: dims.width, height: dims.height });
    },
    [id, readOnly],
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
      className={`text-label-node${selected && !editing ? ' rounded-md ring-1 ring-brand/50' : ''}`}
    >
      <NodeHandles handleStyle={handleStyle} nodeId={id} />

      {selected && !editing && !readOnly && (
        <NodeToolbar isVisible position={Position.Top} offset={12}>
          <TextLabelStyleBar
            size={currentSize}
            bold={isBold}
            color={data.color ?? ''}
            onSize={(size) => {
              setCurrentSize(size);
              applyStyle({ fontSize: size });
              syncNodeDimensions(resolvedText, size);
            }}
            onBold={() => {
              setIsBold(!isBold);
              applyStyle({ bold: !isBold });
            }}
            onColor={(color) => applyStyle({ color })}
            onDelete={() => useDiagramStore.getState().deleteSelected()}
          />
        </NodeToolbar>
      )}

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
