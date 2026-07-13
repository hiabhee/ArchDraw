import React, { useEffect, useRef, useState } from 'react';
import { useDiagramStore } from '@/store/diagramStore';
import { Trash2, GitBranch, Spline, ChevronRight } from 'lucide-react';
import { EDGE_TYPE_CONFIGS, type EdgeType, type PathType } from '@/data/edgeTypes';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Props {
  edgeId: string;
  position: { x: number; y: number };
  onClose: () => void;
  currentEdgeType?: EdgeType;
  currentPathType?: PathType;
}

const EDGE_TYPES: EdgeType[] = ['sync', 'async', 'stream', 'event', 'dep', 'dotted'];

export function EdgeContextMenu({ edgeId, position, onClose, currentEdgeType, currentPathType }: Props) {
  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [showSubmenu, setShowSubmenu] = useState<'type' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const MENU_W = 160;
  const MENU_H = 180;
  const left = Math.min(position.x, window.innerWidth - MENU_W - 8);
  const top  = Math.min(position.y, window.innerHeight - MENU_H - 8);

  const handleDelete = () => {
    setConfirmDelete(true);
  };

  const handleDeleteConfirm = () => {
    deleteEdge(edgeId);
    onClose();
    setConfirmDelete(false);
  };

  const handleEdgeTypeChange = (type: EdgeType) => {
    updateEdgeData(edgeId, { edgeType: type });
    onClose();
  };



  const activeConfig = EDGE_TYPE_CONFIGS[currentEdgeType || 'sync'];
  const activePathType = currentPathType || activeConfig.pathType;

  return (
    <div
      ref={menuRef}
      className="fixed z-[99999] rounded-lg border border-border bg-card p-1.5 shadow-xl"
      style={{ top, left, width: MENU_W }}
    >
      {/* Change Type Submenu */}
      <div className="relative">
        <button
          onMouseEnter={() => setShowSubmenu('type')}
          onClick={() => setShowSubmenu(showSubmenu === 'type' ? null : 'type')}
          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            showSubmenu === 'type' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <GitBranch size={14} style={{ color: activeConfig.color }} />
            <span>Edge Type</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ color: activeConfig.color }} className="text-[10px] font-semibold">{activeConfig.label}</span>
            <ChevronRight size={12} className="text-muted-foreground" />
          </div>
        </button>
        
        {showSubmenu === 'type' && (
          <div
            className="absolute left-full top-0 ml-1 min-w-[120px] rounded-md border border-border bg-card p-1 shadow-lg"
          >
            {EDGE_TYPES.map((type) => {
              const cfg = EDGE_TYPE_CONFIGS[type];
              const isActive = type === currentEdgeType;
              return (
                <button
                  key={type}
                  onClick={() => handleEdgeTypeChange(type)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                  style={isActive ? { background: `${cfg.color}20` } : {}}
                >
                  <svg width="24" height="4" viewBox="0 0 24 4" className="rounded">
                    <line
                      x1="0" y1="2" x2="24" y2="2"
                      stroke={cfg.color}
                      strokeWidth="2"
                      strokeDasharray={cfg.dash || 'none'}
                      opacity={cfg.animated ? 0.7 : 1}
                    />
                  </svg>
                  {cfg.label}
                </button>
              );
            })}
          </div>
        )}
      </div>



      <div className="my-1.5 h-px bg-border" />

      <button
        onClick={handleDelete}
        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        <Trash2 size={14} />
        <span>Delete Edge</span>
      </button>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete edge?"
        description="This action cannot be undone."
        confirmText="Delete"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
