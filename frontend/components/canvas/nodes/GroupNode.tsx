'use client';
import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from 'reactflow';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { LiveActivityBadge } from './LiveActivityBadge';
import { useDiagramStore } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme/appTheme';
import { hexToRgba, toHex6 } from '@/lib/utils';
import { NodeHandles } from '@/components/canvas/nodes/NodeHandles';
import { getConcernColor, CONCERN_COLORS } from '@/lib/theme/stylingConstants';
import { getShapePrimitives } from '@/lib/theme/shapeGeometry';
import { BRUTAL_BORDER, BRUTAL_BORDER_DARK, isStudioRenderStyle, renderSketchSurface, type RenderSurface } from '@/lib/theme/renderStyles';
import { useDiagramAesthetics } from '@/lib/theme/useDiagramAesthetics';
import '@reactflow/node-resizer/dist/style.css';
import './nodeStyles.css';

// Pastel #eff6ff etc with 0.08 alpha is invisible on white in precision.
// Groups created after 0d66a6a stored pastel directly; map back to saturated for precision so the tint reads.
const PASTEL_TO_SATURATED: Record<string, string> = {
  '#eff6ff': '#3b82f6',
  '#f0fdf4': '#22c55e',
  '#fefce8': '#f59e0b',
  '#fdf2f8': '#ec4899',
  '#eef2ff': '#2563eb',
  '#fff7ed': '#f97316',
  '#faf5ff': '#a855f7',
  '#f0fdfa': '#14b8a6',
};

function GroupNodeComponent({ id, data, selected }: NodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const { readOnly } = useCanvasView();
  const [isEditing, setIsEditing] = useState(() => !readOnly && Boolean(data.autoStartLabelEdit));
  const [editValue, setEditValue] = useState(() => data.groupLabel || data.label || 'Group');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const { isDark } = useCanvasTheme();
  const aesthetics = useDiagramAesthetics();
  const sketch = aesthetics.renderStyleId === 'sketch';
  const brutal = aesthetics.renderStyleId === 'neubrutalism';
  const studio = isStudioRenderStyle(aesthetics.renderStyleId);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  // `box` only feeds the sketch body; skip per-frame re-renders otherwise.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !sketch) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setBox({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [sketch]);

  const dataRec = data as {
    accentColor?: string;
    groupColor?: string;
    color?: string;
    layer?: string;
    tier?: string;
    groupLabel?: string;
    label?: string;
    autoStartLabelEdit?: boolean;
  };

  // Freshly created groups (createGroup) ask to jump straight into title
  // editing. Clear the one-shot flag so reloading a saved canvas doesn't
  // re-enter edit mode.
  useEffect(() => {
    if (!dataRec.autoStartLabelEdit || readOnly) return;
    useDiagramStore.getState().updateNodeData(id, { autoStartLabelEdit: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount, on creation only
  }, [id]);

  const concernHint = dataRec.layer || dataRec.tier || dataRec.label || dataRec.groupLabel;
  // Stored colors come from imports / MCP / AI and may be #rgb or named;
  // hexToRgba only understands #rrggbb, so normalize or fall back to the concern color.
  const rawColor =
    toHex6(dataRec.accentColor) ||
    toHex6(dataRec.groupColor) ||
    toHex6(dataRec.color) ||
    toHex6(getConcernColor(concernHint, aesthetics.concerns)) ||
    CONCERN_COLORS.compute.color;
  const pastelMapped = PASTEL_TO_SATURATED[rawColor] ?? rawColor;
  // In precision use saturated for visibility; sketch/brutal keep raw (brutal lightens via GroupBackgroundLayer, sketch uses faint hachure)
  const color = !brutal && !sketch ? pastelMapped : rawColor;

  // Brutal plates are now rendered by GroupBackgroundLayer *behind* the
  // edge SVG (inside .react-flow__viewport before .react-flow__edges) so
  // the opaque #dbeafe fill never covers edge paths. Keep the node itself
  // transparent and let the layer provide the visual plate.
  // Precision was invisible with pastel #eff6ff at 0.08 (near-white). Saturated colors at 0.12 read clearly.
  const bg = studio
    ? isDark ? hexToRgba(color, 0.10) : hexToRgba(color, 0.055)
    : brutal
    ? 'transparent'
    : sketch
      ? isDark ? hexToRgba(color, 0.06) : hexToRgba(color, 0.04)
      : isDark ? hexToRgba(color, 0.14) : hexToRgba(color, 0.12);
  const borderColor = studio
    ? selected ? color : isDark ? hexToRgba(color, 0.46) : hexToRgba(color, 0.34)
    : brutal
    ? (isDark ? BRUTAL_BORDER_DARK : BRUTAL_BORDER)
    : selected
      ? isDark
        ? hexToRgba(color, 0.65)
        : hexToRgba(color, 0.6)
      : sketch
        ? isDark
          ? hexToRgba(color, 0.30)
          : hexToRgba(color, 0.25)
        : isDark
          ? hexToRgba(color, 0.42)
          : hexToRgba(color, 0.35);

  const isLoop = !!(dataRec as { isLoop?: boolean; variant?: string }).isLoop || (dataRec as { variant?: string }).variant === 'dashed';
  const borderWidth = brutal ? 3 : studio ? (selected ? 1.5 : 1) : selected ? 1.5 : 1.25;
  const borderStyle: 'dashed' | 'solid' = isLoop || sketch || studio ? 'dashed' : 'solid';

  // Sketch body: rough rounded-rect with light hachure swimlane (penciled zone)
  // Recomputed on resize via `box`. Pass explicit hachure so the warm paper
  // tint gets graphite hatch, matching AGENTS.md board vs zone vocabulary.
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
      fillStyle: 'hachure',
    };
    return renderSketchSurface({
      primitives: prims,
      surface,
      seedId: id,
      isDark,
      shape: 'group',
    });
  }, [sketch, box.width, box.height, bg, borderColor, borderWidth, aesthetics.borderRadius, id, isDark]);

  // Brutal groups use a flat pastel fill + heavy border — the caption must
  // ink like the rest of brutal titles (BRUTAL_TITLE_*), not echo the raw
  // concern color which clashes with the fixed brutal surface (green on
  // light-blue, etc.). Sketch/precision keep the concern tint.
  const tagText = studio
    ? isDark ? '#cbd5e1' : '#52627a'
    : brutal
    ? aesthetics.colors.title
    : isDark
      ? hexToRgba(color, 0.9)
      : color;

  const label = dataRec.groupLabel || dataRec.label || '';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  // First click selects the group (React Flow); clicking the title of an
  // already-selected group renames it. Viewers never edit.
  const handleLabelClick = (e: React.MouseEvent) => {
    if (readOnly || !selected) return;
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(label || 'Group');
  };

  const handleSave = () => {
    if (!readOnly && editValue.trim()) {
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
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        // Sketch: rough SVG is the surface. Brutal: GroupBackgroundLayer
        // behind .react-flow__edges provides the opaque plate so edges stay
        // above it. Keep the node itself transparent in brutal.
        backgroundColor: brutal ? 'transparent' : sketch ? 'transparent' : bg,
        border: brutal ? 'none' : sketch ? 'none' : `${borderWidth}px ${borderStyle} ${borderColor}`,
        borderRadius: sketch ? 0 : brutal ? 8 : studio ? 16 : 12,
        boxShadow: 'none',
        position: 'relative',
        boxSizing: 'border-box',
        cursor: 'pointer',
        ['--node-accent' as string]: color,
        ['--node-card-bg' as string]: sketch
          ? aesthetics.colors.nodeFill
          : isDark ? '#1a1d24' : '#ffffff',
      }}
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
        isVisible={!readOnly && (!!selected || isHovered)}
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
      />
      {/* Quiet caption label - for loop groups, show at bottom with repeat icon */}
      {!isLoop && (
        <div
          className={sketch || brutal ? 'group-label' : undefined}
          style={{
            position: 'absolute',
            top: studio ? 18 : 16,
            left: studio ? 18 : 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: brutal ? '4px 10px' : 0,
            fontSize: brutal ? 12 : studio ? 13 : 11,
            fontWeight: brutal ? 700 : studio ? 600 : 500,
            letterSpacing: '0.04em',
            textTransform: brutal ? 'uppercase' : 'none',
            color: tagText,
            background: 'transparent',
            border: brutal ? `2px solid ${borderColor}` : 'none',
            borderRadius: brutal ? 4 : 0,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            cursor: readOnly ? 'default' : 'pointer',
            minWidth: 40,
            boxShadow: 'none',
          }}
          onClick={handleLabelClick}
          title={readOnly ? undefined : 'Click to edit group name'}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
              className="nodrag nopan"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: brutal ? 12 : studio ? 13 : 11,
                fontWeight: brutal ? 700 : studio ? 600 : 500,
                letterSpacing: '0.04em',
                color: tagText,
                width: '100%',
                cursor: 'text',
                padding: 0,
                textTransform: brutal ? 'uppercase' : 'none',
              }}
            />
          ) : (
            <span>{label || 'Group'}</span>
          )}
        </div>
      )}
      {isLoop && (
        <div
          style={{
            position: 'absolute',
            bottom: -28,
            left: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.01em',
            color: isDark ? 'rgba(148,163,184,0.9)' : 'rgba(100,116,139,0.9)',
            whiteSpace: 'nowrap',
            cursor: readOnly ? 'default' : 'pointer',
          }}
          onClick={handleLabelClick}
          title={readOnly ? undefined : 'Click to edit loop label'}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>↻</span>
          <span>{isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
              className="nodrag nopan"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 11,
                fontWeight: 500,
                color: isDark ? 'rgba(148,163,184,0.9)' : 'rgba(100,116,139,0.9)',
                cursor: 'text',
                padding: 0,
              }}
            />
          ) : (label || 'Group')}</span>
        </div>
      )}

      <NodeHandles nodeId={id} />
      <LiveActivityBadge nodeId={id} />
    </div>
  );
}

const GroupNode = memo(GroupNodeComponent);
export { GroupNode };
export default GroupNode;
