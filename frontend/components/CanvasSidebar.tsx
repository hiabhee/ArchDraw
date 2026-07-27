'use client';

import { useDiagramStore } from '@/store/diagramStore';
import { toast } from 'sonner';
import { X, Pin, Plus, MoreVertical, Trash2, Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';

interface CanvasSidebarProps {
  onClose: () => void;
}

export function CanvasSidebar({ onClose }: CanvasSidebarProps) {
  const {
    canvases,
    activeCanvasId,
    openCanvas,
    closeCanvas,
    togglePinCanvas,
    removeCanvas,
    renameCanvas,
    addCanvas,
  } = useDiagramStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCanvases = canvases
    .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0);
    });

  const handleCanvasClick = (id: string) => {
    openCanvas(id);
    onClose();
  };

  const handleRename = (id: string) => {
    if (editDraft.trim()) {
      renameCanvas(id, editDraft.trim());
    }
    setEditingId(null);
  };

  const handleRemove = (id: string, hasContent: boolean) => {
    if (hasContent) {
      if (confirm('Delete this canvas? This action cannot be undone.')) {
        removeCanvas(id);
        toast.success('Canvas deleted');
      }
    } else {
      removeCanvas(id);
    }
    setContextMenuId(null);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-foreground/10"
          onClick={onClose}
        />

        {/* Floating Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full sm:w-80 max-h-[85vh] sm:max-h-[70vh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl"
        >
          <div className="floating-panel flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">Canvases</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => addCanvas()}
                  className="floating-icon-btn !min-w-[36px] !min-h-[36px] !w-9 !h-9 sm:!w-8 sm:!h-8"
                  title="New canvas"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="floating-icon-btn !min-w-[36px] !min-h-[36px] !w-9 !h-9 sm:!w-8 sm:!h-8"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search canvases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm bg-secondary border-0 rounded-xl w-full"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredCanvases.map((canvas) => (
                <div
                  key={canvas.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    canvas.id === activeCanvasId
                      ? 'bg-[#1E90FF]/10 text-[#1E90FF]'
                      : 'hover:bg-brand'
                  }`}
                  onClick={() => handleCanvasClick(canvas.id)}
                >
                  {canvas.isPinned && (
                    <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  )}

                  {editingId === canvas.id ? (
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onBlur={() => handleRename(canvas.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(canvas.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-transparent outline-none text-sm"
                    />
                  ) : (
                    <span className="flex-1 text-sm truncate">{canvas.name}</span>
                  )}

                  <DropdownMenu open={contextMenuId === canvas.id} onOpenChange={(open) => !open && setContextMenuId(null)}>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-brand transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenuId(canvas.id);
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(canvas.id);
                          setEditDraft(canvas.name);
                          setContextMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-brand transition-colors"
                      >
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinCanvas(canvas.id);
                          setContextMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-brand transition-colors"
                      >
                        {canvas.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(canvas.id, (canvas.nodes?.length || 0) > 0);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {canvases.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No canvases yet
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 text-xs text-muted-foreground/60">
              {canvases.length} canvas{canvases.length !== 1 ? 's' : ''}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
