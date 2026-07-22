'use client';

import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { useDiagramStore } from '@/store/diagramStore';

interface UseInlineLabelEditOptions {
  nodeId: string;
  currentLabel: string;
  containerRef?: React.RefObject<HTMLElement | null>;
  onCommit?: (newLabel: string) => void;
}

// Module-level map: tracks node IDs that should auto-start editing on mount.
// Populated by Canvas.tsx before React renders the node, consumed once during
// the useState initializer (no store update during render).
const pendingEdits = new Map<string, boolean>();
const claimedPendingEdits = new Set<string>();

export function consumePendingEdit(nodeId: string) {
  console.log('[consumePendingEdit] Setting pending edit for node:', nodeId);
  pendingEdits.set(nodeId, true);
}

export function useInlineLabelEdit({
  nodeId,
  currentLabel,
  containerRef,
  onCommit,
}: UseInlineLabelEditOptions) {
  const [isEditing, setIsEditing] = useState(() => {
    const hasPending = pendingEdits.has(nodeId) && !claimedPendingEdits.has(nodeId);
    console.log('[useInlineLabelEdit] Init for node:', nodeId, 'hasPending:', hasPending, 'pendingEdits:', Array.from(pendingEdits.keys()));
    if (hasPending) {
      claimedPendingEdits.add(nodeId);
      // Schedule cleanup of the Map entry after this render completes
      queueMicrotask(() => pendingEdits.delete(nodeId));
      return true;
    }
    return false;
  });
  const [draft, setDraft] = useState(currentLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalLabelRef = useRef(currentLabel);

  // Check for pending edits on mount (in case useState initializer missed it)
  useEffect(() => {
    if (!isEditing && pendingEdits.has(nodeId) && !claimedPendingEdits.has(nodeId)) {
      console.log('[useInlineLabelEdit] Detected pending edit in useEffect for:', nodeId);
      claimedPendingEdits.add(nodeId);
      queueMicrotask(() => pendingEdits.delete(nodeId));
      setIsEditing(true);
      setDraft(currentLabel);
    }
  }, [nodeId, currentLabel, isEditing]);

  useEffect(() => {
    if (!isEditing) {
      originalLabelRef.current = currentLabel;
    }
  }, [currentLabel, isEditing]);

  useLayoutEffect(() => {
    if (isEditing && inputRef.current) {
      // Multiple focus attempts to ensure it works
      inputRef.current.focus();
      inputRef.current.select();
      
      // Additional delayed focus attempt for edge-drop case
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
      
      // One more attempt with setTimeout as fallback
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isEditing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    const newLabel = trimmed || originalLabelRef.current;
    setIsEditing(false);
    setDraft(newLabel);

    if (newLabel !== originalLabelRef.current) {
      useDiagramStore.getState().updateNodeData(nodeId, {
        label: newLabel,
        labelManuallyEdited: true,
      });
      onCommit?.(newLabel);
    }
  }, [draft, nodeId, onCommit]);

  const cancel = useCallback(() => {
    setDraft(originalLabelRef.current);
    setIsEditing(false);
  }, []);

  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (containerRef?.current && containerRef.current.contains(target)) {
        return;
      }
      commit();
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, commit, containerRef]);

  const startEdit = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    originalLabelRef.current = currentLabel;
    setDraft(currentLabel);
    setIsEditing(true);
  }, [currentLabel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        cancel();
      }
    },
    [commit, cancel]
  );

  return {
    isEditing,
    draft,
    setDraft,
    startEdit,
    commit,
    cancel,
    inputRef,
    inputProps: {
      ref: inputRef,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: handleKeyDown,
      onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
      autoFocus: true,
      className: 'nodrag',
    } as React.InputHTMLAttributes<HTMLInputElement> & { ref: React.RefObject<HTMLInputElement> },
  };
}
