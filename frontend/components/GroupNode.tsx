'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme';
import { hexToRgba } from '@/lib/utils';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { getConcernColor, CONCERN_COLORS } from '@/lib/theme/stylingConstants';
import { getShapePrimitives } from '@/lib/theme/shapeGeometry';
import { applyShapeSurface, getStrokeRenderer, renderSketchSurface, type RenderSurface } from '@/lib/theme/renderStyles';
import { useDiagramAesthetics } from '@/lib/theme/useDiagramAesthetics';
import '@reactflow/node-resizer/dist/style.css';
import './nodes/nodeStyles.css';

export default function GroupNode({ id, data, selected }: NodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const { isDark } = useCanvasTheme();
  const aesthetics = useDiagramAesthetics();
  const sketch = aesthetics.renderStyleId === 'sketch';

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setBox({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Sketch groups keep the concern tint at a softer opacity so the dashed
  // boundary reads as a penciled swimlane but still carries the color cue.
  const bg = sketch
    ? isDark ? hexToRgba(color, 0.06) : hexToRgba(color, 0.04)
    : isDark ? hexToRgba(color, 0.09) : hexToRgba(color, 0.05);
  const borderColor = selected
    ? isDark
      ? hexToRgba(color, 0.65)
      : hexToRgba(color, 0.6)
    : sketch
      ? isDark
        ? hexToRgba(color, 0.30)
        : hexToRgba(color, 0.25)
      : isDark
        ? hexToRgba(color, 0.38)
        : hexToRgba(color, 0.32);

  const borderWidth = selected ? 1.5 : 1;
  const borderStyle: 'dashed' | 'solid' = sketch ? 'dashed' : 'solid';

  // Sketch body: rough rounded-rect (wobbly dashed border + tinted solid
  // fill) replacing the crisp CSS border. Same geometry → renderer path as
  // SystemNode / ShapeNode. Recomputed on resize via `box`.
  const sketchBody = useMemo(() => {
    if (!sketch || box.width <= 0) return '';
    const w = box.width + 4;
    const h = box.height + 4;
    const prims = getShapePrimitives('rounded-rectangle', w, h).map((p) =>
      p.rx ? { ...p, rx: Math.max(p.rx, Math.round(aesthetics.borderRadius)) } : p,
    );
    const surface: RenderSurface = {
      fill: bg,
      stroke: borderColor,
      strokeWidth: borderWidth,
    };
    return renderSketchSurface({
      primitives: prims,
      surface,
      seedId: id,
      isDark,
      shape: 'rounded-rectangle',
    });
  }, [sketch, box.width, box.height, bg, borderColor, borderWidth, aesthetics.borderRadius, id, isDark]);

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
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        // In sketch the rough SVG rect is the surface — drop the CSS bg/border.
        backgroundColor: sketch ? 'transparent' : bg,
        border: sketch ? 'none' : `${borderWidth}px ${borderStyle} ${borderColor}`,
        borderRadius: sketch ? 0 : 12,
        position: 'relative',
        boxSizing: 'border-box',
        cursor: 'pointer',
        boxShadow: 'none',
        ['--node-accent' as string]: color,
        ['--node-card-bg' as string]: sketch
          ? aesthetics.colors.nodeFill
          : isDark ? '#1a1d24' : '#ffffff',
      }}
      onClick={handleContainerClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragStart={(e) => e.preventDefault()}
    >
      {sketch && sketchBody && (
        <svg
          style={{
            position: 'absolute',
            top: -2,
            left: -2,
            width: box.width + 4,
            height: box.height + 4,
            zIndex: 0,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
          dangerouslySetInnerHTML={{ __html: sketchBody }}
        />
      )}
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
        className={sketch ? 'group-label' : undefined}
        style={{
          position: 'absolute',
          top: 16,
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
