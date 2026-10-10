import React, { useEffect, useRef, useState } from 'react';
import { useDiagramStore } from '@/store/diagramStore';
import { Trash2, Edit3 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';

interface Props {
  edgeId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export function EdgeContextMenu({ edgeId, position, onClose }: Props) {
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const setPendingLabelEdgeId = useDiagramStore((s) => s.setPendingLabelEdgeId);
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const MENU_W = 140;
  const MENU_H = 88;
  const left = Math.min(position.x, window.innerWidth - MENU_W - 8);
  const top = Math.min(position.y, window.innerHeight - MENU_H - 8);

  const handleDeleteConfirm = () => {
    deleteEdge(edgeId);
    onClose();
    setConfirmDelete(false);
  };

  const handleEditLabel = () => {
    setPendingLabelEdgeId(edgeId);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[99999] rounded-lg border border-border bg-card p-1.5 shadow-xl"
      style={{ top, left, width: MENU_W }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleEditLabel}
        className="w-full justify-start gap-2.5 !h-auto !px-3 !py-2"
      >
        <Edit3 size={14} />
        <span>Label</span>
      </Button>

      <div className="my-1.5 h-px bg-border" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirmDelete(true)}
        className="w-full justify-start gap-2.5 !h-auto !px-3 !py-2 !text-destructive hover:!bg-destructive/10"
      >
        <Trash2 size={14} />
        <span>Delete</span>
      </Button>

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
    </div>
  );
}
