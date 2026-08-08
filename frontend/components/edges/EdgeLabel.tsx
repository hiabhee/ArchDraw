'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDiagramStore } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme';

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

  const pillStyle: React.CSSProperties = {
    background: knockout,
    color: lineColor
      ? (isDark ? mixHex(lineColor, '#e2e8f0', 0.55) : mixHex(lineColor, '#334155', 0.45))
      : isDark ? '#94a3b8' : '#64748b',
    borderRadius: 3,
    border: isDark
      ? '1px solid rgba(148, 163, 184, 0.28)'
      : '1px solid rgba(15, 23, 42, 0.12)',
    fontSize: 9,
    fontFamily: 'Inter, "IBM Plex Sans", system-ui, sans-serif',
    fontWeight: 500,
    padding: '2px 6px',
    lineHeight: 1.2,
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
