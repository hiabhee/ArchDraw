# Neubrutalism Render Style — Implementation Plan

## What is Neubrutalism?

Neubrutalism (neo-brutalism) is a UI aesthetic characterised by **bold, heavy black borders** (3–4px), **flat saturated fills**, **hard drop-shadows** (offset, no blur — typically 4–6px solid), **bright accent colours**, and **geometric sans-serif typography**. Unlike sketch (wobbly, hand-drawn, warm paper) or precision (thin strokes, soft shadows, white fill), neubrutalism is **loud, blocky, and unapologetically graphic** — think Figma community UI kits, Stripe's早期 dashboard mock-ups, or Vercel's marketing cards.

### Visual vocabulary

| Element | Precision | Sketch | **Neubrutalism** |
|---------|-----------|--------|-----------------|
| Border | 1.25px subtle | 1.48px hand-drawn | **3–3.5px solid black/dark** |
| Fill | `#ffffff` white | Warm paper `#fefcf3` | **Flat saturated pastel / bright tint** |
| Shadow | Soft blur 1–3px | None | **Hard offset 4–6px, 0 blur, solid colour** |
| Typography | Inter / IBM Plex | Patrick Hand / Caveat | **Space Grotesk / JetBrains Mono** |
| Edge stroke | 1.25px thin | rough.js wobble | **2.5–3px solid, no arrowheads → bold filled triangles** |
| Group fill | Solid transparent | Hachure | **Flat saturated pastel + heavy border** |
| Corner radius | 10px (1×) | 11.4px (1.14×) | **6px (0.6×)** — tighter, boxier |
| Icons | Sharp, full colour | Sharp, muted 0.9 | **Sharp, full colour, black stroke ring** |

---

## Architecture: Where changes are needed

The render style system is cleanly layered. Neubrutalism follows the same pattern as sketch — add a new **RenderStylePack**, a new **StrokeRenderer**, a **CSS scope block**, and update all `=== 'sketch'` branches to also handle `'neubrutalism'`.

### Layer map (what touches what)

```
types.ts                    ← add 'neubrutalism' to DiagramRenderStyleId + StrokeEngineId
registry.ts                 ← register NEUBRUTALISM_RENDER_STYLE
neubrutalism.ts             ← NEW: constants + RenderStylePack
strokeRenderer/
  brutalistRenderer.ts      ← NEW: BrutalistStrokeRenderer (crisp but thick + hard shadow)
  index.ts                  ← add 'brutalist' engine case
resolveTokens.ts            ← add neubrutalism colour token overrides
surface.ts                  ← add neubrutalism surface resolution
sketchBody.ts               ← no change (neubrutalism doesn't use rough.js)
nodeStyles.css              ← add [data-render-style='neubrutalism'] scope block
ThemeToggles.tsx            ← cycle precision → sketch → neubrutalism
ShapeNode.tsx               ← pass neubrutalism boolean alongside sketch
shapeShell.tsx              ← add BrutalBody alongside SketchBody
basicShapes.tsx             ← add neubrutalism branch per shape
silhouettes.tsx             ← same
cylinders.tsx               ← same
SimpleFloatingEdge.tsx      ← neubrutalism edge rendering
EdgeLabel.tsx               ← neubrutalism label pill
GroupNode.tsx               ← neubrutalism group surface
SystemNode.tsx              ← neubrutalism card treatment
Canvas.tsx                  ← load font, set data-render-style
SharedCanvasViewer.tsx      ← same
Toolbar.tsx                 ← share URL param ?style=neubrutalism
iconModeFilter.ts           ← keep brand logos in neubrutalism (like precision)
svg-export/
  renderNodes.ts            ← neubrutalism branches
  renderEdges.ts            ← neubrutalism branches
  index.ts                  ← pass renderStyleId through
store/diagram/slices/uiSlice.ts  ← already generic (accepts any DiagramRenderStyleId)
```

---

## Detailed changes by file

### 1. Type system (`lib/theme/renderStyles/types.ts`)

```diff
- export type DiagramRenderStyleId = 'precision' | 'sketch';
+ export type DiagramRenderStyleId = 'precision' | 'sketch' | 'neubrutalism';

- export type StrokeEngineId = 'crisp' | 'rough';
+ export type StrokeEngineId = 'crisp' | 'rough' | 'brutalist';
```

Update `RenderStylePack` to support the new engine. The existing interface already has all the fields neubrutalism needs — no struct changes required.

---

### 2. Neubrutalism constants & style pack (`lib/theme/renderStyles/neubrutalism.ts`) — NEW FILE

**Design tokens:**

```ts
// ── Palette ──
BRUTAL_BORDER         = '#1a1a1a'       // near-black, 3px
BRUTAL_SHADOW         = '#1a1a1a'       // hard offset, same as border
BRUTAL_SHADOW_OFFSET  = 5               // px, no blur

// Light fills (flat pastel tints per concern)
BRUTAL_FILL_LIGHT     = '#ffffff'       // base node fill
BRUTAL_ACCENT_LIGHT   = '#fde047'       // warm yellow accent
BRUTAL_GROUP_LIGHT    = '#dbeafe'       // light blue group
BRUTAL_CANVAS_BG_LIGHT = '#f8fafc'      // very light slate canvas

// Dark mode fills
BRUTAL_FILL_DARK      = '#1e1e2e'       // dark charcoal
BRUTAL_BORDER_DARK    = '#e4e4e7'       // light border on dark
BRUTAL_SHADOW_DARK    = '#000000'
BRUTAL_GROUP_DARK     = '#1e3a5f'
BRUTAL_CANVAS_BG_DARK = '#0f0f1a'

// Title / subtitle
BRUTAL_TITLE_LIGHT    = '#1a1a1a'
BRUTAL_SUBTITLE_LIGHT = '#52525b'
BRUTAL_TITLE_DARK     = '#f4f4f5'
BRUTAL_SUBTITLE_DARK  = '#a1a1aa'

// Edge colours
BRUTAL_EDGE_DEFAULT   = '#1a1a1a'       // thick black edges
BRUTAL_EDGE_PRIMARY   = '#2563eb'       // blue primary
BRUTAL_EDGE_ASYNC     = '#7c3aed'       // violet async
```

**RenderStylePack:**

```ts
export const NEUBRUTALISM_RENDER_STYLE: RenderStylePack = {
  id: 'neubrutalism',
  label: 'Neubrutalism',
  description: 'Bold, heavy borders, hard shadows, flat colour — unapologetically graphic.',
  strokeEngine: 'brutalist',

  fonts: {
    title: '"Space Grotesk", "Inter", system-ui, sans-serif',
    subtitle: '"Space Grotesk", "Inter", system-ui, sans-serif',
    edgeLabel: '"JetBrains Mono", "Space Grotesk", monospace',
    annotation: '"Space Grotesk", system-ui, sans-serif',
    googleFontFamily: 'Space+Grotesk:wght@400;500;600;700',
  },

  geometry: {
    borderRadiusScale: 0.6,          // 10 → 6px — boxier
    strokeWidthScale: 2.6,           // 1.25 → 3.25px — heavy borders
    labelPaddingX: 2,
    labelPaddingY: 1,
    sizeGridNudge: 0,
    dropShadow: 'hard',              // new shadow type (see below)
  },

  edges: {
    pathStyle: 'orthogonal-brutal',  // thick stroke, no wobble
    arrowheadStyle: 'filled-brutal', // large filled triangle
    labelBackground: 'brutal-pill',  // solid background pill
    animatedAsync: true,             // keep animation (clean dashes look good)
  },

  groups: {
    borderStyle: 'brutal-solid',     // 3px solid border
    labelStyle: 'brutalist',         // uppercase, heavy weight
    fillOpacity: 1,
  },

  icons: {
    mode: 'sharp',                   // full colour, like precision
  },
};
```

**Note on `dropShadow`:** The existing type is `'none' | 'soft' | 'sketch'`. Extend to `'none' | 'soft' | 'sketch' | 'hard'`. The `'hard'` value produces an offset solid-colour shadow with 0 blur.

---

### 3. Stroke renderer (`lib/theme/renderStyles/strokeRenderer/`)

#### 3a. New `brutalistRenderer.ts`

This renderer produces **crisp SVG** (like crispRenderer) but with thicker strokes and hard drop-shadows applied as offset `<rect>` or `<use>` + `<feDropShadow>` filter. It does NOT use rough.js.

```ts
export class BrutalistStrokeRenderer implements StrokeRenderer {
  engine = 'brutalist' as const;

  seedFor(id: string): number {
    return hashString(id); // deterministic, same as crisp
  }

  renderPrimitive(primitive: ShapePrimitive, _seed: number): string {
    // Same routing as crispRenderer but:
    // 1. strokeWidth already scaled 2.6× from resolveTokens
    // 2. After each shape element, append a hard-shadow <rect> offset by (5, 5)
    //    with fill = BRUTAL_SHADOW (black) and 0 opacity for inner shapes
    // 3. For fillable bodies, apply a <filter> with feDropShadow(dx=5, dy=5, stdDeviation=0)
  }

  renderEdgePath(d: string, opts: EdgeStrokeOpts, _seed: number): string {
    // Crisp path, but strokeWidth is already heavy from the pack
    return `<path d="${d}" stroke="${opts.stroke}" stroke-width="${opts.strokeWidth}" ... />`;
  }

  renderArrowhead(tip: Point, angle: number, color: string, _seed: number): string {
    // Larger filled equilateral triangle — size 12, spread 7
    // (vs crispRenderer's size 9 / spread 4.5)
  }
}
```

**Key detail — hard shadow strategy:**

For node bodies, the shadow is most cleanly applied via a reusable SVG `<filter>`:

```xml
<filter id="brutal-shadow">
  <feDropShadow dx="5" dy="5" stdDeviation="0" flood-color="#1a1a1a" flood-opacity="1"/>
</filter>
```

This filter is defined once per SVG (canvas or export) and referenced via `filter="url(#brutal-shadow)"`. The `BrutalistStrokeRenderer` outputs the filter definition as a preamble and applies it to the outermost body `<g>`.

#### 3b. Update `strokeRenderer/index.ts`

```diff
+ import { BrutalistStrokeRenderer } from './brutalistRenderer';

+ let brutalistSingleton: BrutalistStrokeRenderer | null = null;

  export function getStrokeRenderer(engine: StrokeEngineId): StrokeRenderer {
+   if (engine === 'brutalist') {
+     if (!brutalistSingleton) brutalistSingleton = new BrutalistStrokeRenderer();
+     return brutalistSingleton;
+   }
    if (engine === 'rough') { ... }
    return crispSingleton;
  }
```

---

### 4. Token resolver (`lib/theme/renderStyles/resolveTokens.ts`)

Add neubrutalism imports and a third branch alongside the sketch overrides:

```diff
+ import {
+   BRUTAL_FILL_LIGHT, BRUTAL_FILL_DARK,
+   BRUTAL_BORDER, BRUTAL_BORDER_DARK,
+   BRUTAL_TITLE_LIGHT, BRUTAL_TITLE_DARK,
+   BRUTAL_SUBTITLE_LIGHT, BRUTAL_SUBTITLE_DARK,
+   BRUTAL_GROUP_LIGHT, BRUTAL_GROUP_DARK,
+   BRUTAL_EDGE_DEFAULT, BRUTAL_EDGE_PRIMARY, BRUTAL_EDGE_ASYNC,
+   BRUTAL_CANVAS_BG_LIGHT, BRUTAL_CANVAS_BG_DARK,
+ } from './neubrutalism';

  // In resolveCanvasTokens:
+ const isNeubrutalism = render.strokeEngine === 'brutalist';

  // CSS vars — add neubrutalism overrides block alongside sketch:
+ '...': isNeubrutalism
+   ? {
+       '--arch-node-fill': opts.isDark ? BRUTAL_FILL_DARK : BRUTAL_FILL_LIGHT,
+       '--arch-node-stroke': BRUTAL_BORDER,
+       '--arch-title': opts.isDark ? BRUTAL_TITLE_DARK : BRUTAL_TITLE_LIGHT,
+       '--arch-subtitle': opts.isDark ? BRUTAL_SUBTITLE_DARK : BRUTAL_SUBTITLE_LIGHT,
+       '--arch-group-fill': opts.isDark ? BRUTAL_GROUP_DARK : BRUTAL_GROUP_LIGHT,
+       '--arch-group-stroke': BRUTAL_BORDER,
+       '--arch-edge-default': BRUTAL_EDGE_DEFAULT,
+       '--arch-edge-primary': BRUTAL_EDGE_PRIMARY,
+       '--arch-edge-async': BRUTAL_EDGE_ASYNC,
+       '--canvas-bg': opts.isDark ? BRUTAL_CANVAS_BG_DARK : BRUTAL_CANVAS_BG_LIGHT,
+       '--arch-stroke-width': `${STROKE_WIDTH * 2.6}px`,
+       '--arch-radius': `${BORDER_RADIUS * 0.6}px`,
+     }
+   : ...existing sketch block...,
```

Also add `isNeubrutalism` conditionals for the resolved `colors.*` values (nodeFill, nodeStroke, title, subtitle, etc.) following the same pattern as the sketch branch.

---

### 5. Surface resolver (`lib/theme/renderStyles/surface.ts`)

In `resolveRenderSurface`, add neubrutalism surface treatment:

```diff
  const sketch = input.renderStyleId === 'sketch';
+ const brutal = input.renderStyleId === 'neubrutalism';

  // Fill
- const fill = sketch ? paper : white;
+ const fill = sketch ? paper : brutal ? (isDark ? BRUTAL_FILL_DARK : BRUTAL_FILL_LIGHT) : white;

  // Stroke
- const stroke = selected ? ... : sketch ? handInk : ...;
+ const stroke = selected
+   ? sketch ? ... : brutal ? BRUTAL_BORDER : accentColor
+   : sketch ? ... : brutal ? BRUTAL_BORDER : ...;

  // strokeWidth
- const strokeWidth = selected ? 2 : sketch ? 1.35 : 1.25;
+ const strokeWidth = selected ? (brutal ? 3.5 : 2) : brutal ? 3.25 : sketch ? 1.35 : 1.25;

  // boxShadow — hard offset for neubrutalism
- const boxShadow = sketch ? 'none' : ...;
+ const boxShadow = brutal
+   ? `${BRUTAL_SHADOW_OFFSET}px ${BRUTAL_SHADOW_OFFSET}px 0px ${BRUTAL_SHADOW}`
+   : sketch ? 'none' : ...;

  // dropShadow
+ const dropShadow = brutal ? 'none' : ...; // shadow handled via box-shadow + SVG filter
```

---

### 6. CSS scope block (`components/nodes/nodeStyles.css`)

Append a new section after the sketch block (~line 1305):

```css
/* ── Neubrutalism ────────────────────────────────────────────────────────
   Bold borders, hard shadows, flat saturated fills, geometric type. */

[data-render-style='neubrutalism'] {
  background-color: var(--canvas-bg, #f8fafc) !important;
}

[data-render-style='neubrutalism'] .node-card {
  border: 3px solid #1a1a1a !important;
  box-shadow: 5px 5px 0px #1a1a1a !important;
  background: var(--arch-node-fill, #ffffff) !important;
  border-radius: 6px !important;
}

[data-render-style='neubrutalism'] .node-card::before {
  display: none; /* hide precision accent rail */
}

[data-render-style='neubrutalism'] .node-card.selected {
  border-color: var(--arch-accent, #2563eb) !important;
  box-shadow: 5px 5px 0px var(--arch-accent, #2563eb) !important;
}

[data-render-style='neubrutalism'] .node-title,
[data-render-style='neubrutalism'] .shape-node .node-title {
  font-family: var(--arch-font-title) !important;
  font-size: 16px !important;
  font-weight: 700 !important;
  letter-spacing: -0.02em !important;
  color: #1a1a1a !important;
  line-height: 1.2 !important;
}

.dark [data-render-style='neubrutalism'] .node-title {
  color: #f4f4f5 !important;
}

[data-render-style='neubrutalism'] .node-subtitle,
[data-render-style='neubrutalism'] .shape-node .node-subtitle {
  font-family: var(--arch-font-subtitle) !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  letter-spacing: 0.02em !important;
  color: #52525b !important;
}

[data-render-style='neubrutalism'] .react-flow__edge-text {
  font-family: var(--arch-font-edge-label) !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  letter-spacing: 0.01em !important;
}

/* Neubrutalism edges are thick solid paths — keep RF path visible (unlike sketch) */

[data-render-style='neubrutalism'] .edge-label-pill {
  border-radius: 4px !important;
  font-family: var(--arch-font-edge-label) !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  padding: 3px 8px !important;
  background: var(--arch-node-fill, #ffffff) !important;
  border: 2.5px solid #1a1a1a !important;
  box-shadow: 3px 3px 0px #1a1a1a !important;
  transform: none;
}

[data-render-style='neubrutalism'] .annotation-node,
[data-render-style='neubrutalism'] .annotation-node input,
[data-render-style='neubrutalism'] .annotation-node textarea {
  font-family: var(--arch-font-annotation) !important;
  font-weight: 600 !important;
  font-size: 13px !important;
}

[data-render-style='neubrutalism'] .text-label-node,
[data-render-style='neubrutalism'] .text-label-node input,
[data-render-style='neubrutalism'] .text-label-node textarea {
  font-family: var(--arch-font-annotation) !important;
  font-weight: 700 !important;
  font-size: 14px !important;
}

[data-render-style='neubrutalism'] .group-label {
  font-family: var(--arch-font-title) !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
}

/* Neubrutalism handles — square-ish, heavy border */
[data-render-style='neubrutalism'] .react-flow__handle,
[data-render-style='neubrutalism'] .node-card .rh {
  width: 10px !important;
  height: 10px !important;
  border-radius: 2px !important;
  border-width: 2.5px !important;
  border-color: #1a1a1a !important;
  background: var(--arch-node-fill, #ffffff) !important;
}

[data-render-style='neubrutalism'] .node-icon-box {
  background: transparent !important;
  box-shadow: none !important;
}

[data-render-style='neubrutalism'] .node-icon {
  opacity: 1;
}
```

---

### 7. Node components — branching on `neubrutalism`

The current pattern is `sketch ? SketchBody : CrispBody`. Neubrutalism uses crisp rendering (not rough.js) so it reuses the **precision SVG path** but with the neubrutalism surface tokens (thicker stroke, hard shadow filter, flat fill). The key changes:

#### 7a. `components/ShapeNode.tsx`

```diff
- sketch: renderStyleId === 'sketch',
+ sketch: renderStyleId === 'sketch',
+ brutal: renderStyleId === 'neubrutalism',
```

Pass `brutal` boolean to all shape components alongside `sketch`.

#### 7b. `components/nodes/shapes/shapeShell.tsx`

Add `BrutalBody` — renders primitives through `getStrokeRenderer('brutalist')` with the neubrutalism surface:

```tsx
export function BrutalBody({ shape, width, height, surface, axis }: {
  shape: ShapeType; width: number; height: number; surface: RenderSurface; axis?: ShapeGeometryAxis;
}) {
  const primitives = getShapePrimitives(shape, width, height, axis);
  const renderer = getStrokeRenderer('brutalist');
  const body = applyShapeSurface(primitives, surface)
    .map((p) => renderer.renderPrimitive(p, 0))
    .join('\n');
  return (
    <svg width={width} height={height} style={SVG_SURFACE_STYLE(width, height)}
      dangerouslySetInnerHTML={{ __html: BRUTAL_SHADOW_FILTER + body }} />
  );
}
```

Also add a shadow filter definition constant:

```ts
const BRUTAL_SHADOW_FILTER = `
  <defs>
    <filter id="brutal-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="5" dy="5" stdDeviation="0" flood-color="#1a1a1a" flood-opacity="1"/>
    </filter>
  </defs>
`;
```

Update `resolveShapeSurface` to accept `'neubrutalism'`:

```diff
  export function resolveShapeSurface(
    isDark: boolean, styles: NodeStyleConfig, selected: boolean,
-   accentColor: string, sketch = false,
+   accentColor: string, sketch = false, brutal = false,
  ) {
    return resolveRenderSurface({
-     renderStyleId: sketch ? 'sketch' : 'precision',
+     renderStyleId: brutal ? 'neubrutalism' : sketch ? 'sketch' : 'precision',
      ...
    });
  }
```

Update `ShapeShellProps` to include `brutal?: boolean`.

#### 7c. `components/nodes/shapes/basicShapes.tsx`

Each shape (Rectangle, Diamond, Circle, Parallelogram) gains a third branch:

```tsx
// Example for Rectangle:
if (brutal) {
  return (
    <div style={{ position: 'relative', width, height }}>
      <BrutalBody shape="rectangle" width={width} height={height}
        surface={surface} />
      <Label ... />
    </div>
  );
}
if (sketch) {
  return <SketchBody ... />;
}
// precision path unchanged
```

Apply the same pattern to: **Diamond, Circle, Parallelogram, RoundedRectangle** (if separate).

#### 7d. `components/nodes/shapes/silhouettes.tsx`

All silhouette shapes (Hexagon, Cloud, Actor, Monitor, Mobile, DashedRectangle, Shield, Document, Documents) gain a `brutal` prop. In each:

```tsx
// Before the sketch branch:
if (brutal) {
  return (
    <div style={{ position: 'relative', width, height }}>
      <BrutalBody shape={shapeName} width={width} height={height} surface={surface} />
      <Label ... />
    </div>
  );
}
```

Note: Neubrutalism does NOT use the `isSketch` parameter to `getShapePrimitives` — all cylinders use the standard primitives (no sketch variants needed since there's no wobble to compensate for).

#### 7e. `components/nodes/shapes/cylinders.tsx`

Same pattern — `brutal` branch uses `BrutalBody` with standard (non-sketch) primitives.

#### 7f. `components/SystemNode.tsx`

SystemNode (card UI with header/footer, accent stripe) needs neubrutalism treatment:

- **When `brutal`:** Use CSS (not SVG body) — the card div already renders via CSS. The `[data-render-style='neubrutalism'] .node-card` CSS rules handle the heavy border + hard shadow. The accent stripe becomes a solid saturated bar. Title/subtitle already use CSS font vars.
- Key change: pass `brutal` flag to control accent stripe width (thicker, 4px) and shadow (hard offset instead of soft).

```diff
// In SystemNode render:
+ const brutal = renderStyleId === 'neubrutalism';

// Card style:
  boxShadow: brutal
    ? '5px 5px 0px #1a1a1a'
    : sketch ? 'none' : styles.shadow,

// Accent stripe:
  borderBottom: brutal
    ? `4px solid ${accentColor}`
    : `3px solid ${accentColor}`,
```

#### 7g. `components/GroupNode.tsx`

```diff
+ const brutal = aesthetics.renderStyleId === 'neubrutalism';

// Group background:
- const bg = sketch ? ... : ...;
+ const bg = brutal
+   ? (isDark ? BRUTAL_GROUP_DARK : BRUTAL_GROUP_LIGHT)
+   : sketch ? ... : ...;

// Group border: brutal → 3px solid #1a1a1a
// Group label: brutal → uppercase, bold, Space Grotesk (handled by CSS)
```

No SVG surface rendering needed — groups use CSS for their background, and the heavy border + hard shadow come from the CSS scope block.

---

### 8. Edge components

#### 8a. `components/edges/SimpleFloatingEdge.tsx`

```diff
  const sketch = renderStyleId === 'sketch';
+ const brutal = renderStyleId === 'neubrutalism';

// Edge stroke:
  const strokeStyle = resolveEdgePalette(data, isDark, sketch, sketchInk);
+ // For neubrutalism, edges use thick solid strokes (no rough overlay needed)

// Edge path rendering:
- if (sketch) { ... rough overlay ... }
+ if (sketch) { ... rough overlay ... }
+ if (brutal) {
+   // Thick crisp stroke, no wobble — the RF path IS the final edge
+   // strokeWidth already scaled 2.6× via tokens
+   // No need to hide the RF path (unlike sketch)
+   // Arrowhead: larger filled triangle rendered by BrutalistStrokeRenderer
+ }

// RF path visibility:
- opacity: 0 (sketch hides it)
+ opacity: 0 (only for sketch; neubrutalism keeps RF path visible)
```

Key difference from sketch: **neubrutalism edges are rendered by React Flow's native path** (just thicker), NOT by a rough.js overlay. This means the existing edge hover/selection states continue to work with no extra effort.

#### 8b. `components/edges/EdgeLabel.tsx`

```diff
+ const brutal = renderStyleId === 'neubrutalism';

// Label pill style:
+ if (brutal) {
+   // Solid bg, 2.5px border, hard shadow — handled by CSS [data-render-style='neubrutalism'] .edge-label-pill
+   // No special inline logic needed; CSS scope handles it
+ }
```

#### 8c. `lib/edgeColors.ts`

Add neubrutalism edge ink mapping (no rough.js warm palette needed — neubrutalism uses pure black/coloured strokes):

```diff
+ if (renderStyleId === 'neubrutalism') {
+   return {
+     default: BRUTAL_EDGE_DEFAULT,
+     primary: BRUTAL_EDGE_PRIMARY,
+     async: BRUTAL_EDGE_ASYNC,
+   };
+ }
```

---

### 9. SVG export (`lib/svg-export/`)

#### 9a. `renderNodes.ts`

Add neubrutalism branches in `renderShapeNode`, `renderSystemNode`, `renderGroupNode`:

```diff
+ const brutal = renderStyleId === 'neubrutalism';

// In renderShapeNode:
+ if (brutal) {
+   renderer = getStrokeRenderer('brutalist');
+   body = renderBody(getShapePrimitives(shape, W, H)); // no isSketch
+   // Shadow: append a <rect> offset by (5,5) behind the body
+   titleColor = isDark ? BRUTAL_TITLE_DARK : BRUTAL_TITLE_LIGHT;
+   subtitleColor = isDark ? BRUTAL_SUBTITLE_DARK : BRUTAL_SUBTITLE_LIGHT;
+   titleFontWeight = 700; // heavier than sketch 500 or precision 600
+ }

// In renderSystemNode:
+ if (brutal) {
+   // Card rect: border 3px solid #1a1a1a, shadow rect offset (5,5)
+   // Accent stripe: 4px solid accent
+   // Fonts: Space Grotesk bold
+ }

// In renderGroupNode:
+ if (brutal) {
+   // Background: flat pastel fill, border 3px solid #1a1a1a
+   // Shadow: hard offset rect
+   // Label: uppercase, bold, Space Grotesk
+ }
```

#### 9b. `renderEdges.ts`

```diff
+ const brutal = renderStyleId === 'neubrutalism';

// Edge path:
+ if (brutal) {
+   // Crisp path, strokeWidth already heavy
+   // Arrowhead: larger filled triangle via BrutalistStrokeRenderer
+ }

// Label pill:
+ if (brutal) {
+   // Solid bg pill, 2.5px border, hard shadow
+ }
```

#### 9c. `index.ts` / `svgExport.ts`

No changes needed — `renderStyleId` is already threaded through.

---

### 10. Toolbar & toggle (`components/toolbar/ThemeToggles.tsx`)

Convert from binary toggle to **three-way cycle**: precision → sketch → neubrutalism → precision.

```diff
+ import { PencilLine, Shapes, SquareDashedBottom } from 'lucide-react';
  // SquareDashedBottom or Bold icon for neubrutalism

  const handleToggle = () => {
-   const next = isSketch ? 'precision' : 'sketch';
+   const cycle: DiagramRenderStyleId[] = ['precision', 'sketch', 'neubrutalism'];
+   const idx = cycle.indexOf(diagramRenderStyle);
+   const next = cycle[(idx + 1) % cycle.length];
    setDiagramRenderStyle(next);
    if (next === 'sketch') ensureSketchFontLoaded();
+   if (next === 'neubrutalism') ensureNeubrutalismFontLoaded();
    analytics.track({ ... payload: { style: next } });
  };

// Icon:
+ {diagramRenderStyle === 'neubrutalism' ? (
+   <Bold className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
+ ) : isSketch ? (
    <PencilLine ... />
+ ) : (
    <Shapes ... />
+ )}

// Active state:
+ className={`... ${
+   diagramRenderStyle === 'neubrutalism'
+     ? 'text-primary bg-primary/15 ring-1 ring-primary/40'
+     : isSketch ? '...' : ''
+ }`}
```

**Font loading:** Add `ensureNeubrutalismFontLoaded()` in a new `frontend/lib/theme/renderStyles/loadNeubrutalismFont.ts` (or add to existing `loadSketchFont.ts` as a second function). Loads Space Grotesk + JetBrains Mono via Google Fonts `<link>`.

---

### 11. Canvas & viewers

#### 11a. `components/Canvas.tsx`

```diff
+ // After the sketch font loading block:
+ if (diagramRenderStyle === 'neubrutalism') ensureNeubrutalismFontLoaded();

  // data-render-style already set dynamically:
  // data-render-style={diagramRenderStyle}  ← this already works for 'neubrutalism'
```

No other Canvas changes needed — `data-render-style` is set from the store value, so `'neubrutalism'` is automatically applied.

#### 11b. `components/SharedCanvasViewer.tsx`

Same pattern — ensure font loaded, `data-render-style` already dynamic.

---

### 12. Toolbar share URL (`components/Toolbar.tsx`)

```diff
- if (diagramRenderStyle === 'sketch') url.searchParams.set('style', 'sketch');
+ if (diagramRenderStyle !== 'precision') url.searchParams.set('style', diagramRenderStyle);
```

---

### 13. Icon mode filter (`lib/iconModeFilter.ts`)

```diff
  export type RenderStyleId = 'sketch' | 'precision';
+ // 'neubrutalism' behaves like precision for icons — keep brand logos

  export function filterIconForMode(iconName, technology, renderStyle) {
-   if (renderStyle === 'precision') return iconName;
+   if (renderStyle === 'precision' || renderStyle === 'neubrutalism') return iconName;
    // sketch logic unchanged
  }
```

---

### 14. Persistence & store

- `store/diagram/persistence/partialize.ts` — already serializes `diagramRenderStyle` generically. No change.
- `store/diagram/slices/uiSlice.ts` — `setDiagramRenderStyle` already accepts `DiagramRenderStyleId`. Adding `'neubrutalism'` to the type automatically enables it.

---

### 15. URL param parsing (shared/embed viewers)

Check where `?style=sketch` is parsed (likely `SharedCanvasViewer.tsx` or `Canvas.tsx` query-param handling). Ensure it also parses `?style=neubrutalism`.

```diff
- if (style === 'sketch') setDiagramRenderStyle('sketch');
+ if (style && isRenderStyleId(style)) setDiagramRenderStyle(style as DiagramRenderStyleId);
```

---

## Files to create (2)

| File | Purpose |
|------|---------|
| `frontend/lib/theme/renderStyles/neubrutalism.ts` | Constants + `NEUBRUTALISM_RENDER_STYLE` pack |
| `frontend/lib/theme/renderStyles/strokeRenderer/brutalistRenderer.ts` | `BrutalistStrokeRenderer` |

## Files to modify (~25)

| File | Change scope |
|------|-------------|
| `lib/theme/renderStyles/types.ts` | Add `'neubrutalism'` + `'brutalist'` to union types; add `'hard'` to dropShadow |
| `lib/theme/renderStyles/registry.ts` | Register new style |
| `lib/theme/renderStyles/resolveTokens.ts` | Add neubrutalism colour token overrides |
| `lib/theme/renderStyles/surface.ts` | Add neubrutalism surface resolution |
| `lib/theme/renderStyles/strokeRenderer/index.ts` | Add `'brutalist'` case |
| `components/nodes/nodeStyles.css` | Add `[data-render-style='neubrutalism']` scope block |
| `components/toolbar/ThemeToggles.tsx` | Three-way cycle + neubrutalism icon |
| `components/ShapeNode.tsx` | Pass `brutal` flag |
| `components/SystemNode.tsx` | Neubrutalism card treatment |
| `components/GroupNode.tsx` | Neubrutalism group surface |
| `components/nodes/shapes/shapeShell.tsx` | Add `BrutalBody` component + `brutal` prop |
| `components/nodes/shapes/basicShapes.tsx` | Add brutal branch per shape |
| `components/nodes/shapes/silhouettes.tsx` | Add brutal branch per silhouette |
| `components/nodes/shapes/cylinders.tsx` | Add brutal branch |
| `components/edges/SimpleFloatingEdge.tsx` | Neubrutalism edge handling |
| `components/edges/EdgeLabel.tsx` | Neubrutalism label pill |
| `lib/edgeColors.ts` | Neubrutalism edge palette |
| `lib/svg-export/renderNodes.ts` | Neubrutalism SVG export branches |
| `lib/svg-export/renderEdges.ts` | Neubrutalism SVG edge export |
| `lib/iconModeFilter.ts` | Keep brand logos in neubrutalism |
| `components/Canvas.tsx` | Font loading for neubrutalism |
| `components/SharedCanvasViewer.tsx` | Font loading for neubrutalism |
| `components/Toolbar.tsx` | Share URL param |
| `lib/theme/renderStyles/index.ts` | Re-export new style + font loader |

---

## Implementation order

1. **Types** (`types.ts`) — add union members
2. **Constants** (`neubrutalism.ts`) — create token file + pack
3. **Registry** (`registry.ts`) — register pack
4. **Stroke renderer** (`brutalistRenderer.ts` + `index.ts`) — create renderer
5. **Token resolver** (`resolveTokens.ts`) — wire colour tokens
6. **Surface resolver** (`surface.ts`) — wire surface + shadow
7. **CSS** (`nodeStyles.css`) — add scope block
8. **Font loader** — new file or extend existing
9. **Shape shell** (`shapeShell.tsx`) — add `BrutalBody`
10. **Shape components** (`basicShapes.tsx`, `silhouettes.tsx`, `cylinders.tsx`) — add brutal branches
11. **SystemNode + GroupNode** — add brutal treatment
12. **Edges** (`SimpleFloatingEdge.tsx`, `EdgeLabel.tsx`, `edgeColors.ts`)
13. **SVG export** (`renderNodes.ts`, `renderEdges.ts`)
14. **Toolbar** (`ThemeToggles.tsx`, `Toolbar.tsx`)
15. **Canvas + viewers** (`Canvas.tsx`, `SharedCanvasViewer.tsx`)
16. **Icon filter** (`iconModeFilter.ts`)
17. **Tests** — add neubrutalism cases to existing test files

---

## Testing strategy

- **Unit:** Add neubrutalism cases to `resolveTokens.test.ts`, `surface.test.ts`, `roughRenderer.test.ts` (for the new brutalistRenderer), `svgExport.test.ts`
- **Visual:** Toggle to neubrutalism in the editor and verify:
  - All shape types render with heavy borders + hard shadows
  - Edges are thick solid with filled arrowheads
  - Labels use Space Grotesk / JetBrains Mono
  - Groups have flat pastel fill + heavy border
  - Dark mode works correctly
  - SVG export matches canvas
  - Share URL with `?style=neubrutalism` loads correctly
- **Regression:** Precision and sketch still work identically (no regressions)
