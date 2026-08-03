'use client';

import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { useDiagramStore } from '@/store/diagramStore';

interface UseInlineLabelEditOptions {
  nodeId: string;
  currentLabel: string;
  containerRef?: React.RefObject<HTMLElement | null>;
  /** When true, enter edit mode on mount (e.g. edge-drop created nodes). */
  autoStart?: boolean;
  onCommit?: (newLabel: string) => void;
}

const AUTO_START_FOCUS_MS = 500;
const EMPTY_LABEL_FALLBACK = 'Service';

export function useInlineLabelEdit({
  nodeId,
  currentLabel,
  containerRef,
  autoStart = false,
  onCommit,
}: UseInlineLabelEditOptions) {
  const [isEditing, setIsEditing] = useState(autoStart);
  const [draft, setDraft] = useState(currentLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalLabelRef = useRef(currentLabel);
  const draftRef = useRef(currentLabel);
  // Prevent Enter→unmount→blur from committing a second time with a stale draft.
  const isCommittingRef = useRef(false);
  // autoStart should only open the editor once per mount cycle.
  const didAutoStartRef = useRef(autoStart);
  const ignoreBlurUntilRef = useRef(0);

  useLayoutEffect(() => {
    draftRef.current = draft;
  });

  useEffect(() => {
    if (!isEditing) {
      originalLabelRef.current = currentLabel;
    }
  }, [currentLabel, isEditing]);

  // Only re-enter edit mode for autoStart if we never started (e.g. late prop).
  // Never reopen after an intentional commit — that resets draft to '' and
  // looks like the first Enter "erased" the label.
  // This syncs local state to a one-shot store signal (autoStartLabelEdit) and
  // must run imperatively to avoid racing the commit/unmount blur handlers.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (autoStart && !isEditing && !didAutoStartRef.current && !isCommittingRef.current) {
      didAutoStartRef.current = true;
      ignoreBlurUntilRef.current = Date.now() + AUTO_START_FOCUS_MS;
      setDraft(currentLabel);
      draftRef.current = currentLabel;
      setIsEditing(true);
    }
  }, [autoStart, isEditing, currentLabel]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useLayoutEffect(() => {
    if (!isEditing) return;

    if (autoStart) {
      ignoreBlurUntilRef.current = Date.now() + AUTO_START_FOCUS_MS;
    }

    const focusInput = (selectText: boolean) => {
      const el = inputRef.current;
      if (!el) return;
      if (document.activeElement !== el) {
        el.focus({ preventScroll: true });
      }
      // Only select when the field is still empty — selecting after the user
      // has typed can fight with Enter/blur and feel like the text was wiped.
      if (selectText && !draftRef.current) {
        el.select();
      }
    };

    focusInput(true);

    const reclaim = () => {
      if (Date.now() < ignoreBlurUntilRef.current && !isCommittingRef.current) {
        focusInput(false);
      }
    };

    const timeouts = [0, 16, 50, 100, 200, 350].map((ms) =>
      window.setTimeout(() => focusInput(ms === 0), ms)
    );

    window.addEventListener('pointerup', reclaim, true);
    window.addEventListener('mouseup', reclaim, true);
    window.addEventListener('click', reclaim, true);

    const stopListening = window.setTimeout(() => {
      window.removeEventListener('pointerup', reclaim, true);
      window.removeEventListener('mouseup', reclaim, true);
      window.removeEventListener('click', reclaim, true);
    }, AUTO_START_FOCUS_MS);

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(stopListening);
      window.removeEventListener('pointerup', reclaim, true);
      window.removeEventListener('mouseup', reclaim, true);
      window.removeEventListener('click', reclaim, true);
    };
  }, [isEditing, autoStart]);

  const commit = useCallback(() => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    // Stop blur-reclaim from fighting the unmount that follows commit.
    ignoreBlurUntilRef.current = 0;

    const trimmed = draftRef.current.trim();
    const newLabel = trimmed || originalLabelRef.current || EMPTY_LABEL_FALLBACK;
    const labelChanged = newLabel !== originalLabelRef.current;

    setIsEditing(false);
    setDraft(newLabel);
    draftRef.current = newLabel;
    originalLabelRef.current = newLabel;

    useDiagramStore.getState().updateNodeData(nodeId, {
      label: newLabel,
      autoStartLabelEdit: false,
      ...(labelChanged ? { labelManuallyEdited: true } : {}),
    });

    if (labelChanged) {
      onCommit?.(newLabel);
    }

    // Allow a future manual edit session after this commit finishes.
    queueMicrotask(() => {
      isCommittingRef.current = false;
    });
  }, [nodeId, onCommit]);

  const cancel = useCallback(() => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    ignoreBlurUntilRef.current = 0;

    const restored = originalLabelRef.current || EMPTY_LABEL_FALLBACK;
    setDraft(restored);
    draftRef.current = restored;
    setIsEditing(false);

    useDiagramStore.getState().updateNodeData(nodeId, {
      label: restored,
      autoStartLabelEdit: false,
    });

    queueMicrotask(() => {
      isCommittingRef.current = false;
    });
  }, [nodeId]);

  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (Date.now() < ignoreBlurUntilRef.current || isCommittingRef.current) {
        return;
      }
      const target = e.target as HTMLElement;
      if (containerRef?.current && containerRef.current.contains(target)) {
        return;
      }
      commit();
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, AUTO_START_FOCUS_MS);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, commit, containerRef]);

  const startEdit = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isCommittingRef.current) return;
    originalLabelRef.current = currentLabel;
    setDraft(currentLabel);
    draftRef.current = currentLabel;
    ignoreBlurUntilRef.current = Date.now() + 100;
    setIsEditing(true);
  }, [currentLabel]);

  const handleBlur = useCallback(() => {
    if (isCommittingRef.current) return;
    if (Date.now() < ignoreBlurUntilRef.current) {
      requestAnimationFrame(() => {
        if (isCommittingRef.current) return;
        const el = inputRef.current;
        if (!el) return;
        el.focus({ preventScroll: true });
      });
      return;
    }
    commit();
  }, [commit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
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
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        draftRef.current = e.target.value;
        setDraft(e.target.value);
      },
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      autoFocus: true,
      placeholder: EMPTY_LABEL_FALLBACK,
      className: 'nodrag nopan',
    } as React.InputHTMLAttributes<HTMLInputElement> & { ref: React.RefObject<HTMLInputElement> },
  };
}
