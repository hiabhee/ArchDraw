'use client';
import { useState, useRef, useEffect } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme';
import { hexToRgba } from '@/lib/utils';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import '@reactflow/node-resizer/dist/style.css';
import './nodes/nodeStyles.css';

export default function GroupNode({ id, data, selected }: NodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { isDark } = useCanvasTheme();

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  const handleResizeEnd = () => {
    const state = useDiagramStore.getState();
    state.saveCanvasToDB(state.activeCanvasId);
  };
  
  const getDeterministicColor = (str: string) => {
    const colors = ['#a855f7', '#22c55e', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const color =
    (data as { accentColor?: string })?.accentColor ||
    (data as { groupColor?: string })?.groupColor ||
    getDeterministicColor(id);

  const bg = isDark ? hexToRgba(color, 0.05) : hexToRgba(color, 0.08);
  const borderColor = isDark 
    ? (selected ? hexToRgba(color, 0.75) : hexToRgba(color, 0.35))
    : (selected ? hexToRgba(color, 0.9) : hexToRgba(color, 0.45));

  const borderStyle = 'dashed';
  const borderWidth = selected ? 2.5 : 2;

  const tagText = isDark ? '#f0f2f7' : hexToRgba(color, 0.95);
  const tagBg = isDark ? '#13151a' : 'rgba(255,255,255,0.95)';
  const tagBorder = isDark ? hexToRgba(color, 0.5) : hexToRgba(color, 0.45);

  const label =
    (data as { groupLabel?: string; label?: string })?.groupLabel ||
    (data as { label?: string })?.label ||
    '';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleContainerClick = (_e: React.MouseEvent) => {
    // Don't stop propagation — let ReactFlow's onNodeClick handle selection.
    // ReactFlow natively supports shift+click multi-select.
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(label || 'Group');
  };

  const handleSave = () => {
    if (editValue.trim()) {
      useDiagramStore.getState().updateNodeData(id, { groupLabel: editValue.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: bg,
        border: `${borderWidth}px ${borderStyle} ${borderColor}`,
        borderRadius: 20,
        position: 'relative',
        boxSizing: 'border-box',
        cursor: 'pointer',
        boxShadow: isDark 
          ? `inset 0 4px 16px rgba(0,0,0,0.6), 0 2px 8px ${hexToRgba(color, 0.08)}` 
          : `0 2px 8px ${hexToRgba(color, 0.05)}`,
      }}
      onClick={handleContainerClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Resize handles — 4 corners + 4 side lines (official React Flow NodeResizer) */}
      <NodeResizer
        isVisible={!!selected || isHovered}
        minWidth={150}
        minHeight={100}
        lineStyle={{ borderColor: hexToRgba(color, 0.55) }}
        handleStyle={{
          width: 12,
          height: 12,
          background: isDark ? '#1a1d24' : '#ffffff',
          border: `2px solid ${hexToRgba(color, 0.9)}`,
          borderRadius: 3,
        }}
        onResizeEnd={handleResizeEnd}
      />
      {/* Text tag - editable */}
      <div
        style={{
          position: 'absolute',
          bottom: -14,
          right: 20,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          fontSize: isDark ? 12 : 9,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: tagText,
          background: tagBg,
          border: `1px solid ${tagBorder}`,
          borderRadius: 999,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          minWidth: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
        onClick={handleLabelClick}
        title="Click to edit group name"
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: isDark ? 12 : 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: tagText,
              width: '100%',
              cursor: 'text',
              padding: 0,
            }}
          />
        ) : (
          <span>{label || 'Group'}</span>
        )}
      </div>

      <NodeHandles nodeId={id} />
    </div>
  );
}

export { GroupNode };