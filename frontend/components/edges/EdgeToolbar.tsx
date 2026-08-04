'use client';

import { useState, useRef, useEffect, useMemo, useCallback, type ElementType } from 'react';
import { EdgeLabelRenderer, useStore, type ReactFlowState } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { Trash2, Edit3, Check, X, ChevronDown, ArrowUp, ArrowRight, ArrowDown, ArrowLeft, RotateCcw } from 'lucide-react';
import { EDGE_TYPE_CONFIGS, type EdgeType, type PathType, type EdgePortSide } from '@/data/edgeTypes';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';

interface Props {
  edgeId: string;
  currentLabel?: string;
  currentEdgeType?: EdgeType;
  currentPathType?: PathType;
  currentSourceSide?: EdgePortSide;
  currentTargetSide?: EdgePortSide;
  hasCustomWaypoints?: boolean;
  labelX: number;
  labelY: number;
}

const EDGE_TYPES: EdgeType[] = ['sync', 'async', 'stream', 'event', 'dep', 'dotted'];
const SIDE_OPTIONS: Array<{ value: EdgePortSide | undefined; label: string; icon: ElementType }> = [
  { value: undefined, label: 'Auto', icon: RotateCcw },
  { value: 'top', label: 'Top', icon: ArrowUp },
  { value: 'right', label: 'Right', icon: ArrowRight },
  { value: 'bottom', label: 'Bottom', icon: ArrowDown },
  { value: 'left', label: 'Left', icon: ArrowLeft },
];

export function EdgeToolbar({
  edgeId,
  currentLabel,
  currentEdgeType,
  currentPathType,
  currentSourceSide,
  currentTargetSide,
  hasCustomWaypoints,
  labelX,
  labelY
}: Props) {
  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const zoom = useStore((s: ReactFlowState) => s.transform[2]);
  const labelScale = Math.min(Math.max(1 / zoom, 1), 2);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentLabel || '');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showRouteMenu, setShowRouteMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const routeMenuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  // Use state reset only when not editing, to follow prop changes
  const [prevCurrentLabel, setPrevCurrentLabel] = useState(currentLabel);
  if (!isEditing && currentLabel !== prevCurrentLabel) {
    setPrevCurrentLabel(currentLabel);
    setEditValue(currentLabel || '');
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (typeMenuRef.current && !typeMenuRef.current.contains(target)) {
        setShowTypeMenu(false);
      }
      if (routeMenuRef.current && !routeMenuRef.current.contains(target)) {
        setShowRouteMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  
  const handleSaveLabel = useCallback(() => {
    updateEdgeData(edgeId, { label: editValue });
    setIsEditing(false);
  }, [edgeId, editValue, updateEdgeData]);
  
  const handleCancelEdit = useCallback(() => {
    setEditValue(currentLabel || '');
    setIsEditing(false);
  }, [currentLabel]);
  
  const handleDelete = useCallback(() => {
    setConfirmDelete(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    deleteEdge(edgeId);
    setConfirmDelete(false);
  }, [edgeId, deleteEdge]);

  const handleResetRoute = useCallback(() => {
    updateEdgeData(edgeId, { customWaypoints: undefined, sourceSide: undefined, targetSide: undefined });
  }, [edgeId, updateEdgeData]);

  const handleEdgeTypeChange = useCallback((type: EdgeType) => {
    updateEdgeData(edgeId, { edgeType: type });
    setShowTypeMenu(false);
  }, [edgeId, updateEdgeData]);

  const handleSideChange = useCallback((key: 'sourceSide' | 'targetSide', side: EdgePortSide | undefined) => {
    updateEdgeData(edgeId, { [key]: side });
  }, [edgeId, updateEdgeData]);

  const activeConfig = useMemo(() => 
    EDGE_TYPE_CONFIGS[currentEdgeType || 'sync'],
    [currentEdgeType]
  );

  const activeSource = SIDE_OPTIONS.find((option) => option.value === currentSourceSide) || SIDE_OPTIONS[0];
  const activeTarget = SIDE_OPTIONS.find((option) => option.value === currentTargetSide) || SIDE_OPTIONS[0];
  const ActiveSourceIcon = activeSource.icon;
  const ActiveTargetIcon = activeTarget.icon;

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
        {/* Edge Type Selector */}
        <div className="relative">
          <button
            onClick={() => { setShowTypeMenu(!showTypeMenu); }}
            title="Change edge type"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase cursor-pointer"
            style={{
              background: `${activeConfig.color}20`,
              border: `1px solid ${activeConfig.color}20`,
              color: activeConfig.color,
            }}
          >
            {activeConfig.label}
            <ChevronDown className="w-3 h-3" />
          </button>

          {showTypeMenu && (
            <div
              ref={typeMenuRef}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 min-w-[100px] rounded-lg border border-border bg-card p-1 shadow-lg"
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
                    className="w-full justify-start gap-2 rounded !h-auto !px-2 !py-1.5"
                    style={isActive ? { background: `${cfg.color}20`, color: cfg.color } : {}}
                  >
                    <svg width="16" height="4" viewBox="0 0 16 4" className="rounded">
                      <line
                        x1="0" y1="2" x2="16" y2="2"
                        stroke={cfg.color}
                        strokeWidth="2"
                        strokeDasharray={cfg.dash || 'none'}
                        opacity={cfg.animated ? 0.6 : 1}
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
            onClick={() => setShowRouteMenu(!showRouteMenu)}
            title="Edit route ports"
            className="!h-auto !px-1.5 !py-0.5 gap-1"
          >
            <ActiveSourceIcon className="w-3 h-3" />
            <span className="text-[9px]">→</span>
            <ActiveTargetIcon className="w-3 h-3" />
            <ChevronDown className="w-3 h-3" />
          </Button>

          {showRouteMenu && (
            <div
              ref={routeMenuRef}
              className="absolute bottom-full left-1/2 mb-1.5 grid min-w-[168px] -translate-x-1/2 gap-1 rounded-lg border border-border bg-card p-2 shadow-lg"
            >
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
              className="w-20 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
              placeholder="Label..."
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSaveLabel}
              className="!h-6 !w-6 !text-emerald-500 hover:!text-emerald-400"
            >
              <Check className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancelEdit}
              className="!h-6 !w-6"
            >
              <X className="w-3 h-3" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              className="!h-6 !w-6"
              title="Edit label"
            >
              <Edit3 className="w-3 h-3" />
            </Button>
            <span className="max-w-[100px] truncate text-[10px] text-muted-foreground">
              {currentLabel || 'Add label'}
            </span>
          </>
        )}

        {hasCustomWaypoints && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetRoute}
            className="!h-6 !w-6"
            title="Reset route to auto"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
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
