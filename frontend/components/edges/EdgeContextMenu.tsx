import React, { useEffect, useRef, useState, type ElementType } from 'react';
import { useDiagramStore } from '@/store/diagramStore';
import { Trash2, GitBranch, ChevronRight, ArrowUp, ArrowRight, ArrowDown, ArrowLeft, RotateCcw, Route } from 'lucide-react';
import { EDGE_TYPE_CONFIGS, type EdgeType, type PathType, type EdgePortSide } from '@/data/edgeTypes';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';

interface Props {
  edgeId: string;
  position: { x: number; y: number };
  onClose: () => void;
  currentEdgeType?: EdgeType;
  currentPathType?: PathType;
  currentSourceSide?: EdgePortSide;
  currentTargetSide?: EdgePortSide;
  hasCustomWaypoints?: boolean;
}

const EDGE_TYPES: EdgeType[] = ['sync', 'async', 'stream', 'event', 'dep', 'dotted'];
const SIDE_OPTIONS: Array<{ value: EdgePortSide | undefined; label: string; icon: ElementType }> = [
  { value: undefined, label: 'Auto', icon: RotateCcw },
  { value: 'top', label: 'Top', icon: ArrowUp },
  { value: 'right', label: 'Right', icon: ArrowRight },
  { value: 'bottom', label: 'Bottom', icon: ArrowDown },
  { value: 'left', label: 'Left', icon: ArrowLeft },
];

export function EdgeContextMenu({
  edgeId,
  position,
  onClose,
  currentEdgeType,
  currentPathType,
  currentSourceSide,
  currentTargetSide,
  hasCustomWaypoints,
}: Props) {
  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [showSubmenu, setShowSubmenu] = useState<'type' | 'route' | null>(null);
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

  const handleSideChange = (key: 'sourceSide' | 'targetSide', side: EdgePortSide | undefined) => {
    updateEdgeData(edgeId, { [key]: side });
  };

  const handleResetRoute = () => {
    updateEdgeData(edgeId, { customWaypoints: undefined, sourceSide: undefined, targetSide: undefined });
    onClose();
  };

  const activeConfig = EDGE_TYPE_CONFIGS[currentEdgeType || 'sync'];
  const activePathType = currentPathType || activeConfig.pathType;
  const activeSource = SIDE_OPTIONS.find((option) => option.value === currentSourceSide) || SIDE_OPTIONS[0];
  const activeTarget = SIDE_OPTIONS.find((option) => option.value === currentTargetSide) || SIDE_OPTIONS[0];

  return (
    <div
      ref={menuRef}
      className="fixed z-[99999] rounded-lg border border-border bg-card p-1.5 shadow-xl"
      style={{ top, left, width: MENU_W }}
    >
      {/* Change Type Submenu */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onMouseEnter={() => setShowSubmenu('type')}
          onClick={() => setShowSubmenu(showSubmenu === 'type' ? null : 'type')}
          className="w-full justify-between !h-auto !px-3 !py-2"
        >
          <div className="flex items-center gap-2.5">
            <GitBranch size={14} style={{ color: activeConfig.color }} />
            <span>Edge Type</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ color: activeConfig.color }} className="text-[10px] font-semibold">{activeConfig.label}</span>
            <ChevronRight size={12} className="text-muted-foreground" />
          </div>
        </Button>

        {showSubmenu === 'type' && (
          <div
            className="absolute left-full top-0 ml-1 min-w-[120px] rounded-md border border-border bg-card p-1 shadow-lg"
          >
            {EDGE_TYPES.map((type) => {
              const cfg = EDGE_TYPE_CONFIGS[type];
              const isActive = type === currentEdgeType;
              return (
                <Button
                  key={type}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdgeTypeChange(type)}
                  className="w-full justify-start gap-2.5 !h-auto !px-2.5 !py-2"
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
                </Button>
              );
            })}
          </div>
        )}
      </div>


      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onMouseEnter={() => setShowSubmenu('route')}
          onClick={() => setShowSubmenu(showSubmenu === 'route' ? null : 'route')}
          className="w-full justify-between !h-auto !px-3 !py-2"
        >
          <div className="flex items-center gap-2.5">
            <Route size={14} />
            <span>Route Ports</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold">
              {activeSource.label} → {activeTarget.label}
            </span>
            <ChevronRight size={12} className="text-muted-foreground" />
          </div>
        </Button>

        {showSubmenu === 'route' && (
          <div className="absolute left-full top-0 ml-1 grid min-w-[176px] gap-2 rounded-md border border-border bg-card p-2 shadow-lg">
            {(['sourceSide', 'targetSide'] as const).map((key) => {
              const current = key === 'sourceSide' ? currentSourceSide : currentTargetSide;
              return (
                <div key={key} className="grid gap-1">
                  <div className="px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {key === 'sourceSide' ? 'Source' : 'Target'}
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {SIDE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = option.value === current;
                      return (
                        <Button
                          key={`${key}-${option.label}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSideChange(key, option.value)}
                          title={`${key === 'sourceSide' ? 'Source' : 'Target'} ${option.label}`}
                          className={`!h-7 !w-7 ${
                            active
                              ? 'border border-primary bg-primary/10 text-primary'
                              : 'border border-border text-muted-foreground'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasCustomWaypoints && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetRoute}
            className="w-full justify-start gap-2.5 !h-auto !px-3 !py-2"
          >
            <RotateCcw size={14} />
            <span>Reset Route</span>
          </Button>
          <div className="my-1.5 h-px bg-border" />
        </>
      )}

      {!hasCustomWaypoints && <div className="my-1.5 h-px bg-border" />}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        className="w-full justify-start gap-2.5 !h-auto !px-3 !py-2 !text-destructive hover:!bg-destructive/10"
      >
        <Trash2 size={14} />
        <span>Delete Edge</span>
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
