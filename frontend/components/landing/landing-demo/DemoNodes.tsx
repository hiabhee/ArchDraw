import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import SimpleFloatingEdge from '@/components/edges/SimpleFloatingEdge';
import {
  getTierColorNormalized,
  getDarkCategoryStyle,
  hexToRgba,
  STATUS_COLORS,
} from './demoColors';
import type { DemoNodeData, DemoGroupData } from './demoTypes';

// Custom Dotted Node Component
function DemoNode({ id, data, selected }: { id: string; data: DemoNodeData; selected: boolean }) {
  const isDark = data.isDemoDark !== false;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim() && data.onRename) {
      data.onRename(id, editValue.trim());
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

  const tierColor = getTierColorNormalized(data.layer);
  const accentColor = data.accentColor || data.color || tierColor || '#0f766e';
  const statusColor = STATUS_COLORS[(data.status || 'healthy') as keyof typeof STATUS_COLORS];
  const showStatus = data.status && data.status !== 'healthy';

  const catStyle = getDarkCategoryStyle(data.layer);

  return (
    <div
      className={`node-wrapper${selected ? ' selected' : ''}`}
      style={{
        ['--node-accent' as string]: accentColor,
        ['--node-accent-soft' as string]: hexToRgba(accentColor, 0.04),
        ['--node-accent-bg' as string]: `${accentColor}12`,
        ['--node-glow' as string]: catStyle.glow,
        ['--node-glow-border' as string]: catStyle.border,
        ['--node-status-color' as string]: statusColor,
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-[#1E90FF] !border-0" style={{ zIndex: 10 }} />
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-[#1E90FF] !border-0" style={{ zIndex: 10 }} />

      <div
        className="group node-card"
        style={{
          width: data.nodeWidth || 200,
          minWidth: data.nodeWidth || 200,
          minHeight: data.nodeHeight || 72,
        }}
      >
        <div className="node-header">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-slate-800 dark:text-slate-100 w-full p-0 m-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className="node-title select-none cursor-pointer"
              title="Double-click to rename"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
                setEditValue(data.label || '');
              }}
            >
              {data.label}
            </p>
          )}
        </div>
        <div className="node-footer">
          {data.subtitle && (
            <p className="node-subtitle" title={data.subtitle}>
              {data.subtitle}
            </p>
          )}
          {showStatus && (
            <div className="node-status-dot" />
          )}
        </div>
      </div>
    </div>
  );
}

// Custom Dotted Group Component
function DemoGroup({ id, data, selected }: { id: string; data: DemoGroupData; selected: boolean }) {
  const isDark = data.isDemoDark !== false;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.groupLabel || data.label || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim() && data.onRename) {
      data.onRename(id, editValue.trim());
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

  const color =
    data.accentColor ||
    data.groupColor ||
    data.color ||
    getTierColorNormalized(data.layer || data.groupLabel || data.label);

  const bg = isDark ? hexToRgba(color, 0.04) : hexToRgba(color, 0.035);
  const borderColor = isDark
    ? selected
      ? hexToRgba(color, 0.55)
      : 'rgba(255, 255, 255, 0.12)'
    : selected
      ? hexToRgba(color, 0.55)
      : 'rgba(15, 23, 42, 0.12)';

  const borderWidth = selected ? 1.5 : 1;
  const tagText = isDark ? '#94a3b8' : '#64748b';

  const label = data.groupLabel || data.label || '';

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
      }}
    >
      <NodeResizer
        color={color}
        isVisible={selected}
        minWidth={100}
        minHeight={100}
      />
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
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          boxShadow: 'none',
          zIndex: 10,
          cursor: 'pointer',
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
          setEditValue(label || '');
        }}
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
              textTransform: 'none',
              color: tagText,
              width: '100%',
              cursor: 'text',
              padding: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span>{label || 'Group'}</span>
        )}
      </div>
    </div>
  );
}

function SpacerNode() {
  return <div style={{ width: 1, height: 1 }} />;
}

// Custom NodeTypes registration
export const DEMO_NODE_TYPES = {
  demoNode: DemoNode,
  demoGroup: DemoGroup,
  spacerNode: SpacerNode,
};

// Custom EdgeTypes registration
export const DEMO_EDGE_TYPES = {
  custom: SimpleFloatingEdge,
  simpleFloating: SimpleFloatingEdge,
  floating: SimpleFloatingEdge,
  default: SimpleFloatingEdge,
  straight: SimpleFloatingEdge,
};
