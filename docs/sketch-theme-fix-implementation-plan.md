# Sketch Theme Fix Implementation Plan

## Problem Summary

The current sketch render style looks visually noisy and inconsistent in both light and dark mode because it mixes a hand-drawn aesthetic with precision UI treatments. Rough strokes, cross-hatching, handwriting fonts, product-blue edges, crisp provider icons, sharp selection states, and warm/brown surfaces are all competing at once.

The goal is not to make sketch more decorative. The goal is to make it feel like a clean, readable architecture diagram drawn by hand.

## Desired Outcome

- Light mode should feel like clean paper or whiteboard: quiet, readable, lightly handmade.
- Dark mode should feel like a controlled chalkboard/dark-paper diagram: high contrast, not muddy.
- Sketch should preserve semantic concern colors without looking like a different product.
- Nodes, groups, edges, labels, icons, and selection states should share one visual language.
- Existing precision mode must remain unchanged.

## Current Root Causes

### 1. Excessive Texture

`sketchFillForShape` currently returns `cross-hatch` for every shape in `frontend/lib/theme/renderStyles/sketch.ts`.

This makes diagrams visually heavy, especially when many nodes are on screen. Cross-hatching is useful as a subtle cue, but it should not be the default fill treatment for every node body.

### 2. Muddy Dark Mode

Dark sketch currently combines:

- warm dark canvas
- brown node paper
- gold hatch ink
- blue primary edges
- off-white text

These colors are individually defensible, but together they create a muddy palette. The dark mode needs fewer hue families and stronger luminance discipline.

### 3. Dirty Light Mode Paper

`SKETCH_PAPER_TINT = #ede7da` is too beige and too dark relative to the canvas. It makes light-mode nodes look aged or stained instead of clean.

### 4. Handwriting Font Overuse

`Nanum Pen Script` is applied broadly to titles, subtitles, edge labels, annotations, and shape labels.

This hurts readability and makes the diagram feel gimmicky. The sketch style should use hand lettering selectively, not everywhere.

### 5. Precision Chrome Leaks Into Sketch

Several precise UI treatments remain visible in sketch mode:

- crisp provider icons
- sharp icon boxes
- strong product-blue selection rings
- crisp toolbar chrome
- exact sticky-note edge label boxes
- precise accent washes

These make the sketch style feel pasted on top of the precision style rather than integrated.

### 6. Selection State Is Too Harsh

Selected sketch nodes still use strong accent strokes and precision-like emphasis in some paths. Selection needs to be visible but should feel penciled or chalked, not like a UI focus ring.

## Implementation Plan

## Phase 1: Establish Better Sketch Tokens

Update `frontend/lib/theme/renderStyles/sketch.ts`.

Recommended token changes:

```ts
export const SKETCH_PAPER_TINT = '#f7f2e8';
export const SKETCH_PAPER_BORDER_LIGHT = 'rgba(92, 74, 48, 0.28)';
export const SKETCH_HATCH_INK_LIGHT = 'rgba(92, 74, 48, 0.16)';

export const SKETCH_CANVAS_BG_DARK = '220 12% 9%';
export const SKETCH_GRID_COLOR_DARK = '220 10% 17%';
export const SKETCH_PAPER_DARK = '#24262b';
export const SKETCH_PAPER_DARK_BORDER = 'rgba(245, 242, 235, 0.30)';
export const SKETCH_HATCH_INK_DARK = 'rgba(245, 242, 235, 0.16)';
export const SKETCH_EDGE_PRIMARY_BLUE = '#93c5fd';
```

Rationale:

- Light paper becomes cleaner and less beige.
- Dark mode moves away from brown/gold mud.
- Hatch ink becomes quieter in both modes.
- Primary edge blue becomes less product-like and more chalk/pencil-like.

Add tests in `frontend/lib/theme/renderStyles/__tests__/resolveTokens.test.ts` for:

- sketch light node fill
- sketch dark node fill
- sketch dark canvas background
- sketch dark title/subtitle contrast tokens

## Phase 2: Reduce Default Hatching

Update `sketchFillForShape` in `frontend/lib/theme/renderStyles/sketch.ts`.

Recommended behavior:

- `rectangle`, `rounded-rectangle`, `parallelogram`, `hexagon`, `cloud`, `monitor`, `mobile`, `dashed-rectangle`: `solid`
- `groupNode` zones: keep `hachure` or very subtle rough fill
- optional future accent: use `cross-hatch` only for selected nodes or special semantic shapes if needed

If the rough renderer requires a rough fill style, use `solid` with rough stroke first. Only add hatch back where it solves a visual problem.

Update `frontend/lib/theme/renderStyles/sketchBody.ts` so hatch-specific logic is conditional and does not assume every shape is cross-hatched.

Add tests in `frontend/lib/theme/renderStyles/__tests__/sketchBody.test.ts`:

- normal sketch body does not emit dense hatch markup by default
- group or explicitly hatched surface still supports hatch
- dark and light hatch ink remain low opacity

## Phase 3: Make Text Readable First

Update sketch font usage in:

- `frontend/lib/theme/renderStyles/sketch.ts`
- `frontend/components/nodes/nodeStyles.css`
- `frontend/components/ShapeNode.tsx`
- `frontend/components/SystemNode.tsx`
- `frontend/components/edges/EdgeLabel.tsx`

Recommended font policy:

- Node titles: use a readable system/UI font with slightly looser line height, or keep handwriting only for short shape labels.
- Subtitles: use system/UI font, never handwriting.
- Edge labels: use system/UI font or a calmer handwritten font at small sizes.
- Annotations/free text: handwriting is acceptable.

Suggested token direction:

```ts
fonts: {
  title: '"Inter", "IBM Plex Sans", system-ui, sans-serif',
  subtitle: '"Inter", "IBM Plex Sans", system-ui, sans-serif',
  edgeLabel: '"Inter", "IBM Plex Sans", system-ui, sans-serif',
  annotation: "'Nanum Pen Script', cursive",
  googleFontFamily: 'Nanum+Pen+Script',
}
```

Then selectively apply handwriting only to:

- annotations
- group labels, if still readable
- maybe text-label nodes

Remove sketch letter spacing overrides where possible. Current `0.02em` makes handwritten text feel artificially spaced.

## Phase 4: Soften Selection And Accent Treatments

Update selected sketch surfaces in:

- `frontend/components/ShapeNode.tsx`
- `frontend/components/SystemNode.tsx`
- `frontend/components/GroupNode.tsx`
- `frontend/components/nodes/nodeStyles.css`

Recommended behavior:

- Selected node stroke should be a rough outline using muted accent color.
- Avoid strong box shadows in sketch mode.
- Avoid switching the entire border to saturated concern color.
- Add a subtle second rough outline or low-opacity accent wash for selection.

Example direction:

```ts
const stroke = selected && sketch
  ? hexToRgba(accentColor, isDark ? 0.72 : 0.58)
  : ...
```

Use rough renderer output for selected emphasis rather than CSS `box-shadow` when possible.

## Phase 5: De-Crisp Icons Without Destroying Recognition

Update:

- `frontend/components/SystemNode.tsx`
- `frontend/components/ShapeNode.tsx`
- `frontend/components/nodes/nodeStyles.css`

Recommended behavior:

- Keep provider icons recognizable.
- Remove or soften crisp icon box backgrounds in sketch mode.
- Lower icon opacity slightly more in sketch dark mode.
- Avoid precise geometric accent washes behind icons unless they are rough and very subtle.

Potential CSS:

```css
[data-render-style='sketch'] .node-icon-box {
  background: transparent;
  box-shadow: none;
  opacity: 0.82;
}

.dark [data-render-style='sketch'] .node-icon-box {
  opacity: 0.76;
}
```

For provider icons, consider applying grayscale or opacity only in sketch mode if brand colors clash too much.

## Phase 6: Simplify Edge And Label Styling

Update:

- `frontend/lib/utils/edgeHierarchy.ts`
- `frontend/components/edges/SimpleFloatingEdge.tsx`
- `frontend/components/edges/EdgeLabel.tsx`
- `frontend/components/nodes/nodeStyles.css`
- `frontend/lib/svgExport.ts`

Recommended behavior:

- Use muted ink/chalk colors for sketch edges.
- Keep primary edges visually distinct, but not neon/product blue.
- Edge labels should look like lightweight paper labels, not rotated sticky notes everywhere.
- Remove default label rotation or reduce it to very rare/seeded variation.

Suggested CSS change:

```css
[data-render-style='sketch'] .edge-label-pill {
  transform: none;
  border-radius: 3px;
  background: color-mix(in srgb, var(--arch-node-fill) 88%, transparent);
}
```

Also ensure SVG export mirrors the same edge colors and label surfaces.

## Phase 7: Align Canvas, Group, And Export Behavior

Update:

- `frontend/lib/theme/renderStyles/resolveTokens.ts`
- `frontend/components/Canvas.tsx`
- `frontend/components/GroupNode.tsx`
- `frontend/lib/svgExport.ts`

Required checks:

- Canvas background matches sketch tokens in app and export.
- Grid color is visible but quiet.
- Group fill does not compete with node fills.
- SVG export produces the same visual result as the live canvas.
- Shared canvas viewer loads the same sketch tokens and font behavior.

## Phase 8: Visual QA Matrix

Test these combinations manually:

- light mode + default theme + sketch
- dark mode + default theme + sketch
- light mode + non-default color theme + sketch
- dark mode + non-default color theme + sketch
- selected and unselected nodes
- system nodes and all shape nodes
- groups
- edge labels
- async/dashed edges
- SVG export
- shared canvas viewer

Use diagrams with:

- 3 nodes
- 10-15 nodes
- nested group
- provider icons
- mixed shape vocabulary
- long labels
- edge labels

## Phase 9: Test Coverage

Run targeted tests after implementation:

```bash
cd frontend
npm test -- renderStyles
npm test -- svgExport
npm test -- nodeSizing
```

Then run broader checks:

```bash
cd frontend
npx tsc --noEmit
npm test
```

If visual changes affect snapshots or SVG assertions, update only the assertions that encode the old sketch visual contract.

## Suggested Change Order

1. Update sketch tokens.
2. Reduce hatching.
3. Fix text/font policy.
4. Soften selection state.
5. Simplify icon treatment.
6. Simplify edge labels.
7. Sync SVG export.
8. Add/update tests.
9. Manual visual QA.

## Acceptance Criteria

- Light sketch mode looks clean, not beige/dirty.
- Dark sketch mode looks crisp and readable, not brown/gold/muddy.
- Nodes remain legible at normal zoom.
- Dense diagrams do not shimmer with texture.
- Precision mode has no visual regressions.
- SVG export matches live canvas closely.
- Selection is obvious but visually sketch-native.
- Provider icons remain recognizable without dominating the style.

