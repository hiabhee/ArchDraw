'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { EdgeLabelRenderer, useStore, type ReactFlowState } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { Trash2, Edit3, Check, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';

interface Props {
  edgeId: string;
  currentLabel?: string;
  labelX: number;
  labelY: number;
}

export function EdgeToolbar({ edgeId, currentLabel, labelX, labelY }: Props) {
  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const zoom = useStore((s: ReactFlowState) => s.transform[2]);
  const rawScale = zoom ? 1 / zoom : 1;
  const labelScale = Math.min(1.4, Math.max(0.85, rawScale));

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentLabel || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const [prevCurrentLabel, setPrevCurrentLabel] = useState(currentLabel);
  if (!isEditing && currentLabel !== prevCurrentLabel) {
    setPrevCurrentLabel(currentLabel);
    setEditValue(currentLabel || '');
  }

  const handleSaveLabel = useCallback(() => {
    updateEdgeData(edgeId, { label: editValue });
    setIsEditing(false);
  }, [edgeId, editValue, updateEdgeData]);

  const handleCancelEdit = useCallback(() => {
    setEditValue(currentLabel || '');
    setIsEditing(false);
  }, [currentLabel]);

  const handleDeleteConfirm = useCallback(() => {
    deleteEdge(edgeId);
    setConfirmDelete(false);
  }, [edgeId, deleteEdge]);

  return (
    <EdgeLabelRenderer>
      <div
        className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 shadow-lg"
        style={{
          position: 'absolute',
          transform: `translate(${labelX}px, ${labelY - 24}px) scale(${labelScale}) translate(-50%, -100%)`,
          transformOrigin: '0 0',
          pointerEvents: 'all',
          zIndex: 20,
        }}
      >
        {isEditing ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveLabel();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className="w-24 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
              placeholder="Label..."
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSaveLabel}
              className="!h-6 !w-6 !text-emerald-500 hover:!text-emerald-400"
              title="Save label"
            >
              <Check className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancelEdit}
              className="!h-6 !w-6"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="!h-6 gap-1 !px-2"
            title="Add or edit label"
          >
            <Edit3 className="w-3 h-3" />
            <span className="max-w-[100px] truncate text-[10px] text-muted-foreground">
              {currentLabel || 'Label'}
            </span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setConfirmDelete(true)}
          className="!h-6 !w-6 hover:!text-destructive"
          title="Delete edge"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
        title="Delete edge?"
        description="This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={handleDeleteConfirm}
      />
    </EdgeLabelRenderer>
  );
}
