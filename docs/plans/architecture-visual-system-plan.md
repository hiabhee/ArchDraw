# Architecture Visual System Plan

## Progress

| Step | Status | Notes |
|---|---|---|
| 0 — Design tokens & grammar lock | Done | `stylingConstants.ts` tokens, concerns, size grid, theme packs |
| 1 — Quiet node chrome | Done | 1.25px stroke, no backplates, soft shadow |
| 2 — Semantic color system | Done | 5 concerns; group hash removed; templates remapped |
| 3 — Optical size grid | Done | 160 / 200 / 240; queues at 240 |
| 4 — Shape grammar unification | Done | Shared stroke/type; quieter ShapeNode surfaces |
| 5 — Groups & edges | Done | Solid hairline groups; thin low-contrast edges |
| 6 — Typography & density modes | Done | Title/subtitle hierarchy; `diagramChromeMode` edit/present |
| 7 — Theme systems (real themes) | Done | default/slate/forest/dark-minimal/luxury packs + CSS vars |
| 8 — Templates, AI, export alignment | Done | Templates muted; AI StyleConfig from packs; export quiet |
| 9 — QA & regression | Partial | Unit tests for tokens; manual visual checklist remains |

---

## Goal

Make ArchDraw diagrams read as a **calm architecture visual language**, not product-UI cards arranged as a graph.

Highest-leverage outcomes:

1. Quiet node chrome (thin stroke, soft or no depth).
2. Color means concern (client / compute / data / async / external), not decoration.
3. One shape grammar with a shared size grid that survives 30+ nodes.

Non-goals for this plan:

- New node shape kinds or more themes for their own sake.
- Layout algorithm rewrites (ELK/Dagre) unless size-grid changes force spacing tweaks.
- App chrome / landing / dashboard redesign.

---

## Diagnosis (current state)

| Area | What’s wrong | Primary owners |
|---|---|---|
| Stroke | `5px` black border on `.node-card` | `frontend/components/nodes/nodeStyles.css` |
| Depth | Stacked backplates + neo-brutal shadows | `frontend/lib/theme/stylingConstants.ts`, `ShapeNode.tsx`, `SystemNode.tsx` |
| Color | Group hash into purple/green/pink…; bright Tailwind template fills | `GroupNode.tsx`, templates, `tierColors.ts` / `stylingConstants.ts` |
| Size | Queues ~320px vs services ~160–220px | `nodeShapeConfig.ts`, `.node-card` / `.node-queue` CSS, `nodeSizing.ts` |
| Chrome | Icon chips, shine, status dots, queue cells, browser chrome | `SystemNode.tsx`, `nodeStyles.css` |
| Groups | Dashed rounded containers + candy pills | `GroupNode.tsx` |
| Themes | Named themes still lean indigo/teal defaults | `stylingConstants.ts`, theme bridge / plan `ArchitectureStyle` |
| Edges | Insufficient primary-vs-secondary hierarchy | `SimpleFloatingEdge.tsx`, `EDGE_STYLES` |

Designer verdict to satisfy: **over-styled and under-systematic** → quiet chrome + semantic color.

---

## Target visual grammar

```
Canvas (muted neutral)
  └─ Groups: hairline solid or 2–4% fill, quiet caption label
       └─ Nodes: 1–1.5px stroke, soft fill, optional 1 soft shadow
            ├─ Title (strong)
            ├─ Secondary (quiet)
            └─ Optional icon (recognition only)
       └─ Edges: thin / low-contrast default; heavier for primary flow
```

### Semantic accents (4–5, muted)

| Concern | Role | Usage |
|---|---|---|
| Client | Entry / UI / browser | Accent stroke or left rail only |
| Compute | Services / APIs / workers | Accent stroke or left rail only |
| Data | DB / storage | Accent stroke or left rail only |
| Async | Queue / events / bus | Accent stroke or left rail only |
| External | SaaS / third-party / CDN | Accent stroke or left rail only |

Most of the canvas stays neutral. Accents are **meaning**, not fill paint.

### Optical size grid

| Tier | Width | Typical height | Used for |
|---|---|---|---|
| S | 160 | 72–88 | Cache, compact shapes |
| M | 200 | 80–96 | Default service / API |
| L | 240 | 88–112 | Gateway, external, highlighted |
| Shape-special | same widths | shape-driven height | Cylinder / diamond / cloud — width still S/M/L |

Queues must land on **L (240)** or **M (200)**, not 320.

### Density modes

| Mode | When | Chrome |
|---|---|---|
| Edit | Canvas interaction | Handles, selection ring, optional status |
| Present / Export | SVG export, share, dense graphs | No shine, no status dots, no decorative mini-objects; icons only if they aid recognition |

---

## Step 0 — Design tokens & grammar lock

**Why first:** Every later step should edit tokens, not one-off CSS.

### Deliverables

1. Create a single token module (extend or replace `frontend/lib/theme/stylingConstants.ts`), e.g.:

   - `--arch-stroke-width` → `1.25px`
   - `--arch-stroke-emphasis` → `2px` (selection / primary)
   - `--arch-radius-node` → `8–10px` (tighter than 16px cards)
   - `--arch-shadow` → one soft shadow or `none`
   - `--arch-fill-node`, `--arch-fill-group`
   - `--arch-title`, `--arch-subtitle`
   - Semantic palette: `client | compute | data | async | external` (muted hex + soft bg)
   - Size tokens: `160 / 200 / 240`

2. Document the grammar in this file’s Target section (already above); treat it as the contract.

3. Map consumers:

| Token | Consumers |
|---|---|
| Stroke / shadow / fill | `nodeStyles.css`, `SystemNode`, `ShapeNode`, `svgExport` |
| Semantic color | `getTierColorNormalized`, `tierColors.ts`, groups, templates, AI style plan |
| Size | `nodeShapeConfig.ts`, `nodeSizing.ts`, layout defaults, templates |

### Done when

- One module owns stroke, depth, semantic colors, and size grid.
- CSS variables on `.node-wrapper` read from that module (or mirror it 1:1).
- No new hardcoded `5px` / `#3b82f6` / `320` widths introduced elsewhere.

---

## Step 1 — Quiet node chrome (highest leverage)

**Goal:** Boxes stop shouting so the system can settle.

### Changes

1. **`nodeStyles.css`**
   - `.node-card` border: `5px solid #000` → `1–1.5px` token stroke (neutral, not pure black).
   - Soften / remove inset shine on shadows.
   - Reduce border-radius toward token (`~8–10px`).
   - Keep selection as a **ring or 2px emphasis**, not thicker sticker border.

2. **`stylingConstants.ts`**
   - `LIGHT_NODE_STYLES` / `DARK_NODE_STYLES`: drop stacked backplate offsets; `backplates: []` or single subtle layer.
   - Replace neo-brutal stacked `5px 5px 0 …, 10px 10px 0 …` with one soft shadow or none.

3. **`SystemNode.tsx` / `ShapeNode.tsx`**
   - Stop rendering `Backplates` when empty; remove dead layer code paths once unused.
   - Selection glow: prefer stroke/ring over multi-layer drop-shadow.

4. **`svgExport.ts`**
   - Match canvas: same stroke width, no backplate rectangles in export.

### Done when

- Dense 20–40 node canvas reads as light structure, not stickers.
- Light and dark export visually match the quieter canvas treatment.

---

## Step 2 — Semantic color system

**Goal:** Color encodes layer/concern; most canvas stays muted.

### Changes

1. **Replace / fold tier palettes**
   - Unify `TIER_COLORS` (`stylingConstants.ts`) and `tierColors.ts` into the 5-concern semantic map (or map old tiers → new concerns).
   - Desaturate accents; prefer stroke / 4–8% fill over solid bright body fills.

2. **`GroupNode.tsx`**
   - Remove `getDeterministicColor` hash into purple/green/pink/orange/teal/blue.
   - Resolve group color from: explicit `accentColor` / `groupColor` → parent concern → neutral default.
   - Cap opacity so groups never compete with nodes.

3. **Templates** (`frontend/data/templates/*`)
   - Replace bright Tailwind body colors (`#3b82f6`, `#ec4899`, etc.) with semantic accents + neutral fills.
   - Tier/group colors should match the 5-concern table.

4. **AI / planner**
   - `ArchitectureStyle` / `styleConfig` and any color assignment in generation should emit semantic concerns, not random hues.

5. **Landing / demo nodes** (`InteractiveLandingDemo`, homepage samples)
   - Same palette so marketing matches product output.

### Done when

- Two diagrams of different domains still use the same 5 accents by concern.
- Groups no longer rainbow-hash by id.
- A grayscale screenshot still reads hierarchy via stroke/type; color is additive meaning.

---

## Step 3 — Optical size grid

**Goal:** Layout feels intentional even when shape variety remains.

### Changes

1. **`nodeShapeConfig.ts`**
   - Retarget all kinds to S/M/L widths (`160 / 200 / 240`).
   - Queues: `320` → `240` (or `200`); keep pill/pipe silhouette if desired, but not at 2× service width.
   - Caches/diamonds: keep square-ish proportions but align width to S (`160`) or a shared compact cell.

2. **`nodeStyles.css`**
   - `.node-card` default `220px` → token M (`200`) or document why M≠220 and align everything to one default.
   - Queue mobile/desktop min-widths (`280` / `320`) → grid.

3. **`SystemNode.tsx` label width heuristic**
   - Cap dynamic width to L (`240`); don’t grow to 320.

4. **`nodeSizing.ts` + layout defaults**
   - Ensure layout engines use the same width tokens (`DEFAULT_NODE_WIDTH`, etc.).

5. **Templates**
   - Normalize `nodeWidth` / `width` to the grid so curated diagrams don’t fight generated ones.

### Done when

- Side-by-side service vs queue no longer looks accidental.
- Relayout of existing canvases doesn’t leave permanent 320-wide outliers (migration note: optional one-time clamp on load).

---

## Step 4 — Shape grammar unification

**Goal:** One grammar — classic shapes and “cards” share padding, radius, stroke, and type.

### Changes

1. Decide the product grammar (recommended):

   - **Architecture-first:** shape silhouette carries type (cylinder = data, cloud = external, rounded = compute); surface treatment is shared (thin stroke, muted fill, same type scale).
   - Drop or demote “Notion card” chrome that fights silhouettes: multi-layer icon boxes, browser chrome chrome-bars, queue cell decoration as default.

2. **`SystemNode.tsx`**
   - Keep decorative mini-objects behind a density flag (`edit` only) or remove.
   - Icon: single small mark when it aids recognition; kill nested icon chip stacks.

3. **`ShapeNode.tsx`**
   - Apply same stroke width, fill opacity, label typography as system nodes.
   - Selection treatment identical across shape kinds.

4. **CSS**
   - Shared classes for title/subtitle across card and SVG-label nodes.

### Done when

- A designer can’t describe the canvas as “Lucidchart shapes wearing Notion cards.”
- Shape variety remains; surface treatment does not.

---

## Step 5 — Groups & edges

### Groups (`GroupNode.tsx` + CSS)

1. Border: dashed → **solid hairline** (or 1px solid at low opacity).
2. Fill: very light (`2–6%`) or none.
3. Label: quiet caption (small type, no candy pill / heavy tag chrome). Selected state can strengthen stroke slightly without becoming a badge.
4. Color: semantic or neutral only (from Step 2).

### Edges (`SimpleFloatingEdge.tsx`, `EDGE_STYLES`, `EdgeLabel.tsx`)

1. Default edge: thin (`1px`), low-contrast neutral.
2. Primary / sync critical path: slightly darker or `1.5px`.
3. Async: dashed, muted accent (async semantic), not loud orange by default.
4. Edge labels: quieter pills or plain captions; reduce opacity / border weight.

### Done when

- Groups read as structure, not FigJam frames.
- Eye follows primary flow without every edge competing.

---

## Step 6 — Typography & density modes

### Typography

1. Stronger hierarchy: short title (semibold / medium), quieter secondary (smaller, lower contrast).
2. Fewer mid-weight labels on nodes and edges.
3. Align font tokens in `FONTS` / CSS with the architecture look (avoid competing display styles on-canvas). Prefer the product’s existing canvas type unless a deliberate architecture face is chosen — then use it consistently in canvas + export.

### Density / export strip

1. Introduce a simple mode flag (store or export option): `chrome: 'edit' | 'present'`.
2. **Present / export:** hide status dots, shine, toolbar-affordance shadows, decorative queue cells / browser chrome; keep handles off in export (already typical).
3. Wire `svgExport.ts` to present mode always.

### Done when

- 30+ node diagrams stay legible.
- Exported SVG looks like presentation architecture, not an editor screenshot.

---

## Step 7 — Theme systems that feel designed

**Goal:** Named themes change stroke, fill, type, and edge character — not a hue swap on indigo/teal defaults.

### For each theme (e.g. slate, forest, luxury, …)

Define a full token pack:

| Token group | Must change |
|---|---|
| Surface | Canvas bg, node fill, group fill |
| Stroke | Default stroke color + width character (still thin) |
| Type | Title / subtitle colors |
| Accent map | 5 semantic accents remapped to theme |
| Edges | Default / primary / async colors |
| Shadow | Soft depth character (or flat) |

### Implementation

1. Theme registry keyed by `ArchitectureStyle` / canvas theme id.
2. `applyThemeChange` / canvas theme hook applies the full pack to CSS variables.
3. Dark mode is orthogonal: each theme has light + dark packs, or themes are explicitly dark-capable.

### Done when

- Switching theme is obvious in a side-by-side screenshot even with color-blind simulation of “hue only.”
- Default theme embodies the quiet architecture system; others are variations of the grammar, not different products.

---

## Step 8 — Templates, AI generation, export alignment

1. **Templates:** restyle archdraw + featured templates to the new system (sizes, colors, group labels).
2. **Generation pipeline:** planner/translator assigns `concern` (or mapped layer) → semantic accent; stop emitting bright fills.
3. **Export / share:** present-mode chrome; identical tokens to canvas.
4. **Docs / learn / tutorials:** sample diagrams updated so education matches product.

### Done when

- Generated, templated, and hand-edited diagrams share one look.
- README / marketing screenshots updated only after Steps 1–6 land (optional follow-up).

---

## Step 9 — QA & regression

### Visual checklist (manual)

- [ ] Single node: calm, not sticker
- [ ] 8-node small system: hierarchy clear
- [ ] 30+ node dense graph: still quiet; strip chrome if needed
- [ ] Queue + DB + service + external on one canvas: size grid + semantic color
- [ ] Group nesting: hairline, quiet label
- [ ] Selection / hover: emphasis without reverting to 5px brutalism
- [ ] Dark mode parity
- [ ] SVG export matches present mode
- [ ] Theme A vs Theme B: structural difference, not hue-only

### Automated / lightweight

- Snapshot or golden SVG smoke for a fixture diagram (optional).
- Unit tests for size clamping and concern→color mapping.
- Guardrails: lint or test that forbids `border: 5px` / queue width `320` regressions if practical.

---

## Suggested PR sequence

Ship in small reviewable PRs so visual diffs stay reviewable:

| PR | Scope |
|---|---|
| PR A | Step 0 tokens + Step 1 quiet chrome (CSS + stylingConstants + export) |
| PR B | Step 2 semantic colors (tiers, groups, templates subset) |
| PR C | Step 3 size grid + layout/sizing consumers |
| PR D | Step 4 shape grammar + SystemNode chrome reduction |
| PR E | Step 5 groups + edges |
| PR F | Step 6 typography + present/export density mode |
| PR G | Step 7 real theme packs |
| PR H | Step 8 remaining templates / AI / tutorials + Step 9 checklist |

---

## Acceptance criteria (product)

A designer reviewing ArchDraw output should be able to say:

1. Borders are light structure; weight is reserved for selection/emphasis.
2. Depth is one soft shadow or none — no stacked backplates.
3. Color encodes concern; the canvas is mostly muted.
4. Node widths sit on an optical grid; queues don’t dominate.
5. Shape vocabulary remains, but padding/radius/stroke/type are unified.
6. Groups feel like presentation architecture, not workshop sticky frames.
7. Themes change the system, not just the hue.
8. Dense graphs and exports stay calm because chrome is stripped when it doesn’t add meaning.

---

## Key file index

| File | Role in this work |
|---|---|
| `frontend/components/nodes/nodeStyles.css` | Card stroke, shadow, queue/browser chrome, type |
| `frontend/lib/theme/stylingConstants.ts` | Shared canvas/export style + backplates + tier colors |
| `frontend/lib/tierColors.ts` | Alternate tier theme map to unify |
| `frontend/components/SystemNode.tsx` | Card nodes, status dots, queue decoration, accent |
| `frontend/components/ShapeNode.tsx` | Classic shapes + backplates |
| `frontend/components/GroupNode.tsx` | Dashed groups, hash colors, pill labels |
| `frontend/components/edges/SimpleFloatingEdge.tsx` | Edge weight / async treatment |
| `frontend/components/edges/EdgeLabel.tsx` | Edge label chrome |
| `frontend/constants/nodeShapeConfig.ts` | Per-kind width/height |
| `frontend/lib/utils/nodeSizing.ts` | Runtime sizing |
| `frontend/lib/svgExport.ts` | Export must match present grammar |
| `frontend/data/templates/*` | Bright fills + non-grid widths |
| `frontend/lib/ai/pipeline/types.ts` | `ArchitectureStyle` / style plan hooks |
