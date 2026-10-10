'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDiagramStore } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme';
import { useDiagramAesthetics } from '@/lib/theme/useDiagramAesthetics';
import {
  SKETCH_INK_LIGHT_TITLE,
  SKETCH_INK_DARK_TITLE,
  SKETCH_PAPER_TINT,
  SKETCH_PAPER_DARK,
  SKETCH_PAPER_DARK_BORDER,
  SKETCH_INK_LIGHT_BORDER,
} from '@/lib/theme/renderStyles';

interface EdgeLabelProps {
  edgeId: string;
  label?: string;
  labelX: number;
  labelY: number;
  color?: string;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

/** Blend two hex colors into a fully opaque color. t = fraction of the first. */
function mixHex(a: string, b: string, t: number): string {
  const pa = /^#([0-9a-fA-F]{6})$/.exec(a);
  const pb = /^#([0-9a-fA-F]{6})$/.exec(b);
  if (!pa || !pb) return a;
  const na = parseInt(pa[1], 16);
  const nb = parseInt(pb[1], 16);
  const r = Math.round(((na >> 16) & 0xff) * t + ((nb >> 16) & 0xff) * (1 - t));
  const g = Math.round(((na >> 8) & 0xff) * t + ((nb >> 8) & 0xff) * (1 - t));
  const bl = Math.round((na & 0xff) * t + (nb & 0xff) * (1 - t));
  return `rgb(${r}, ${g}, ${bl})`;
}

export function EdgeLabel({
  edgeId,
  label,
  color,
  editing: controlledEditing,
  onEditingChange,
}: EdgeLabelProps) {
  const { isDark } = useCanvasTheme();
  const { renderStyleId } = useDiagramAesthetics();
  const updateEdgeLabel = useDiagramStore((s) => s.updateEdgeLabel);

  const isControlled = controlledEditing !== undefined;
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = isControlled ? controlledEditing : internalEditing;

  const setEditing = useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalEditing(value);
      onEditingChange?.(value);
    },
    [isControlled, onEditingChange],
  );

  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const getCleanedText = useCallback((txt?: string): string => {
    if (!txt) return '';
    return txt.trim();
  }, []);

  const displayText = label?.trim() ? getCleanedText(label) : null;

  const enterEdit = useCallback(() => {
    setDraft(label?.trim() ?? '');
    setEditing(true);
  }, [label, setEditing]);

  const commit = useCallback(() => {
    const cleaned = getCleanedText(draft);
    updateEdgeLabel(edgeId, cleaned);
    setEditing(false);
  }, [edgeId, draft, updateEdgeLabel, getCleanedText, setEditing]);

  const cancel = useCallback(() => {
    setEditing(false);
  }, [setEditing]);

  // When entering controlled editing (or the label changes while editing),
  // resync the draft with the current label. Done during render so there is
  // no stale-input flash after paint.
  const [prevSync, setPrevSync] = useState<{ label?: string; controlled: boolean | undefined }>({
    label,
    controlled: controlledEditing,
  });
  if (controlledEditing && (controlledEditing !== prevSync.controlled || label !== prevSync.label)) {
    setDraft(label?.trim() ?? '');
    setPrevSync({ label, controlled: controlledEditing });
  }

  useEffect(() => {
    if (editing) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [editing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
    e.stopPropagation();
  };

  const inputWidth = Math.max(80, Math.min(150, draft.length * 6 + 32));

  const lineColor = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined;
  // Match canvas fill so the label looks transparent but punches a gap in the edge.
  const knockout = 'hsl(var(--canvas-bg))';
  const sketch = renderStyleId === 'sketch';
  const brutal = renderStyleId === 'neubrutalism';

  // Sketch labels sit on a paper/chalk pill — text is warm ink, tinted only
  // when the user hand-picked an edge color. Brutal labels use a solid pill
  // with a heavy border. Precision labels bleed into slate via knockout.
  const textColor = lineColor
    ? sketch
      ? isDark
        ? mixHex(lineColor, SKETCH_INK_DARK_TITLE, 0.3)
        : mixHex(lineColor, SKETCH_INK_LIGHT_TITLE, 0.3)
      : (isDark ? mixHex(lineColor, '#e2e8f0', 0.55) : mixHex(lineColor, '#334155', 0.45))
    : sketch
      ? isDark ? SKETCH_INK_DARK_TITLE : SKETCH_INK_LIGHT_TITLE
      : isDark ? '#94a3b8' : '#64748b';

  const pillStyle: React.CSSProperties = sketch
    ? {
        background: isDark ? SKETCH_PAPER_DARK : SKETCH_PAPER_TINT,
        color: textColor,
        fontSize: 11,
        borderRadius: 5,
        border: isDark
          ? `1px solid ${SKETCH_PAPER_DARK_BORDER}`
          : `1px solid ${SKETCH_INK_LIGHT_BORDER}`,
        padding: '2px 7px',
        lineHeight: 1.3,
        textAlign: 'center',
        outline: 'none',
        boxShadow: 'none',
        position: 'relative',
        zIndex: 1000,
        textTransform: 'none',
        letterSpacing: '0.01em',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
      }
    : brutal
      ? {
          background: 'var(--arch-node-fill, #ffffff)',
          color: textColor,
          fontSize: 11,
          borderRadius: 5,
          border: '1.5px solid var(--arch-node-stroke, #1a1a1a)',
          boxShadow: '2px 2px 0px var(--arch-node-stroke, #1a1a1a)',
          fontFamily: 'var(--arch-font-edge-label, monospace)',
          fontWeight: 600,
          padding: '3px 8px',
          lineHeight: 1.3,
          textAlign: 'center',
          outline: 'none',
          position: 'relative',
          zIndex: 1000,
          textTransform: 'none',
          letterSpacing: '0.02em',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          verticalAlign: 'middle',
        }
    : {
        background: knockout,
        color: textColor,
        borderRadius: 4,
        border: isDark
          ? '1px solid rgba(148, 163, 184, 0.28)'
          : '1px solid rgba(15, 23, 42, 0.12)',
        fontSize: 10.5,
        fontFamily: 'Inter, "IBM Plex Sans", system-ui, -apple-system, sans-serif',
        fontWeight: 500,
        padding: '3px 7px',
        lineHeight: 1.35,
        textAlign: 'center',
        outline: 'none',
        boxShadow: 'none',
        position: 'relative',
        zIndex: 1000,
        textTransform: 'none',
        letterSpacing: '0.01em',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
      };

  if (!displayText && !editing) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      {editing ? (
        <motion.input
          key="edit"
          ref={inputRef}
          className={sketch || brutal ? 'edge-label-pill' : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder="LABEL"
          autoFocus
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          style={{
            ...pillStyle,
            width: inputWidth,
            cursor: 'text',
          }}
        />
      ) : (
        <motion.span
          key="read"
          className={sketch || brutal ? 'edge-label-pill' : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            enterEdit();
          }}
          title="Double-click to edit"
          style={{
            ...pillStyle,
            cursor: 'text',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {displayText}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
