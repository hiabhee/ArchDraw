'use client';
import { useState, useRef, useEffect } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme';
import { hexToRgba } from '@/lib/utils';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { getConcernColor, CONCERN_COLORS } from '@/lib/theme/stylingConstants';
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

  const dataRec = data as {
    accentColor?: string;
    groupColor?: string;
    color?: string;
    layer?: string;
    tier?: string;
    groupLabel?: string;
    label?: string;
  };

  const concernHint = dataRec.layer || dataRec.tier || dataRec.label || dataRec.groupLabel;
  const color =
    dataRec.accentColor ||
    dataRec.groupColor ||
    dataRec.color ||
    getConcernColor(concernHint) ||
    CONCERN_COLORS.compute.color;

  const bg = isDark ? hexToRgba(color, 0.09) : hexToRgba(color, 0.05);
  const borderColor = isDark
    ? selected
      ? hexToRgba(color, 0.65)
      : hexToRgba(color, 0.38)
    : selected
      ? hexToRgba(color, 0.6)
      : hexToRgba(color, 0.32);

  const borderWidth = selected ? 1.5 : 1;

  const tagText = isDark ? hexToRgba(color, 0.9) : color;
  const tagBg = isDark ? 'transparent' : 'transparent';

  const label = dataRec.groupLabel || dataRec.label || '';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleContainerClick = (_e: React.MouseEvent) => {
    // Let ReactFlow handle selection.
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

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

  void handleContainerClick;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: bg,
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius: 12,
        position: 'relative',
        boxSizing: 'border-box',
        cursor: 'pointer',
        boxShadow: 'none',
        ['--node-accent' as string]: color,
        ['--node-card-bg' as string]: isDark ? '#1a1d24' : '#ffffff',
      }}
      onClick={handleContainerClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragStart={(e) => e.preventDefault()}
    >
      <NodeResizer
        isVisible={!!selected || isHovered}
        minWidth={150}
        minHeight={100}
        lineStyle={{ borderColor: hexToRgba(color, 0.4) }}
        handleStyle={{
          width: 10,
          height: 10,
          background: isDark ? '#1a1d24' : '#ffffff',
          border: `1.5px solid ${hexToRgba(color, 0.7)}`,
          borderRadius: 2,
        }}
        onResizeEnd={handleResizeEnd}
      />
      {/* Quiet caption label */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: 0,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'none',
          color: tagText,
          background: tagBg,
          border: 'none',
          borderRadius: 0,
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          minWidth: 40,
          boxShadow: 'none',
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
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.04em',
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
