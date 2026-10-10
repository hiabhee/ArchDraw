# Implementation Plan — Tutorials Design Refresh

Make the tutorials experience feel like **part of ArchDraw**, not a separate legacy app bolted onto the product.

**Related:** `CONTRIBUTING.md` (semantic tokens), `docs/tutorials-improvement-plan.md` (platform/content), `AGENTS.md` §11, `frontend/components/tutorial/`, `frontend/views/Editor.tsx`.

**Audit date:** Aug 2026.

---

## Problem Statement

Tutorials today have a **split personality**:

| Surface | Visual system | Feels like |
|---------|---------------|------------|
| `/tutorials` catalog + `/dashboard/learn` | `bg-surface-*`, `text-text-*`, `bg-accent`, shadcn `Button` patterns | **Current ArchDraw** |
| Tutorial **player** (`/tutorials/[id]`) | Hardcoded `#F4F4F4`, `#595959`, `#1A1A1A`, inline `style={{}}`, gray CTAs | **Old prototype** |
| Intro / completion overlays | Full-screen dark slate cards, custom carousel | **Marketing microsite** |
| Tutorial canvas | Forked `TutorialCanvas` + `ComponentPalette` | **Different editor** |

Users who discover tutorials from the polished dashboard land in a player that looks and behaves like a different product. That breaks trust and makes “Open in Editor” feel like a mode switch instead of a natural graduation.

---

## Goals

1. **One visual language** — tutorials use the same semantic tokens, typography, buttons, and panels as dashboard + editor chrome.
2. **Editor continuity** — the tutorial player should feel like “guided editor mode,” not a separate React Flow app.
3. **Reduce duplication** — reuse `Canvas`, `CommandPalette`, `PropertiesPanel` patterns where possible; delete parallel tutorial-only UI where not needed.
4. **Modern learning UX** — clearer step progress, phase affordances, and completion flow without full-screen carousel friction.
5. **Dark mode parity** — respect global theme; no tutorial-only light-gray prison.

## Non-Goals

- Rewriting tutorial **content** (steps, copy, pedagogy) — see `tutorials-improvement-plan.md`.
- Building certification, quizzes, or social features.
- Changing tutorial engine / validation logic unless required for UI integration.
- Re-skinning canvas **nodes** (already shared via `SystemNode` / `ShapeNode`).

---

## Design North Star

> **“Learn mode is the editor with training wheels.”**

A signed-in user should recognize:

- Same top chrome density and button styles as `Toolbar.tsx`
- Same sidebar card surfaces as `PropertiesPanel` / `ContextualSidebar`
- Same canvas dot grid, minimap, and node chrome as `Canvas.tsx`
- Same accent CTA (`bg-accent`, `text-accent-text`) — never `#595959` gray primary buttons

Reference surfaces to mirror:

- Dashboard learn hero: `components/dashboard/LearnClient.tsx`
- Catalog cards: `components/tutorial/TutorialCard.tsx` (already close — keep as baseline)
- Editor shell: `views/Editor.tsx`, `components/Toolbar.tsx`
- Shared UI: `components/ui/button`, `components/ui/ConfirmDialog`, `ThemeToggle`

---

## Current-State Audit (What Feels “Old”)

### 1. Player shell — `TutorialPageClient.tsx`

**Issues**

- Page background `style={{ background: '#F4F4F4' }}` instead of `bg-surface-page`
- Header uses raw white + `text-slate-*` + gray progress bars (`bg-gray-500`)
- Primary actions use `#595959` inline hover handlers instead of `Button` + `bg-accent`
- Guest banner uses `#FAFAF7` one-off color
- `LevelCompleteScreen` is fully inline-styled (white card, gray CTA)
- Separate canvas theme toggle (`Moon`/`Sun`) instead of product `ThemeToggle`

**Files:** `app/tutorials/[id]/TutorialPageClient.tsx` (~700 lines — shell + overlays should be extracted)

### 2. Guide panel — `GuidePanel.tsx`

**Issues**

- Phase label shown as raw enum string (`context`, `teaching`) — not human-friendly
- Teaching callouts use ad-hoc amber/blue boxes (acceptable pedagogy, but not token-aligned)
- Primary continue button uses shadcn `primary` while rest of player uses gray — inconsistent
- No visual stepper / phase breadcrumb matching editor chrome
- “Explain differently” is plain text link — should match secondary button pattern

**Files:** `components/tutorial/GuidePanel.tsx`

### 3. Intro & completion flows

**Issues**

- `IntroCardFlow.tsx` — 4-card carousel overlay with `rgba(0,0,0,0.5)` scrim; blocks canvas; different typography
- `CompletionCardFlow.tsx` — dark `text-slate-300` celebration deck; feels like a game end screen
- Both use per-tutorial hex `tutorialColor` accents instead of brand + tutorial badge color

**Recommendation:** Replace multi-card carousels with **single-surface modals** using `ConfirmDialog` / dashboard card patterns, or inline collapsible “Before you start” panel in the left rail.

**Files:** `IntroCardFlow.tsx`, `CompletionCardFlow.tsx`

### 4. Canvas fork — `TutorialCanvas.tsx`

**Issues**

- Duplicate React Flow host (~500+ lines) vs `components/Canvas.tsx`
- Custom `TutorialSystemNodeWrapper` instead of sharing editor node path
- Embedded `ComponentPalette` drawer while product standard is **⌘K CommandPalette**
- Canvas bg `#f8fafc` / `#0f172a` — close but not tied to `stylingConstants` / editor theme
- Tutorial-only minimap / empty state / hint bar styling

**Files:** `TutorialCanvas.tsx`, `ComponentPalette.tsx`

### 5. Node details — `NodeDetailsPanel.tsx`

**Issues**

- Fixed 340px panel with inline hex accents
- Duplicates much of `PropertiesPanel` read-only content
- `NodeDetailsPanelEmpty` is a dead column when nothing selected

**Recommendation:** Reuse `PropertiesPanel` in read-only/tutorial mode, or extract shared `NodeInspector` primitive.

### 6. Catalog (mostly OK)

**Already aligned:** `TutorialCatalog.tsx`, `TutorialCard.tsx`, `app/tutorials/page.tsx`, `LearnClient.tsx`.

**Minor gaps**

- Public `/tutorials` vs dashboard learn could share more hero copy/components
- Card accent orbs use per-tutorial hex — fine as **accent**, but surround chrome should stay semantic

---

## Target Experience (Screen by Screen)

### A. Catalog (`/tutorials`, `/dashboard/learn`)

**Keep** current grid, filters, progress badges.

**Polish (small)**

- Unify page header component (`TutorialPageHeader`) shared by public + dashboard routes
- Add “Continue learning” row when `richProgress` has in-progress tutorials
- Consistent empty / loading skeletons using `CanvasSkeleton` visual language

### B. Tutorial player (`/tutorials/[id]`)

**Layout (desktop)**

```
┌─────────────────────────────────────────────────────────────────┐
│ TutorialToolbar  ← back · title · stepper · restart · editor CTA │
├──────────────┬──────────────────────────────┬───────────────────┤
│ GuideRail    │ Canvas (shared host)         │ Inspector (opt.)  │
│  phase card  │  same nodes/edges as editor  │  PropertiesPanel  │
│  checklist   │  ⌘K to add components      │  or empty hint    │
│  hints       │                              │                   │
└──────────────┴──────────────────────────────┴───────────────────┘
```

**Layout (mobile)**

- Bottom sheet for guide content; canvas full width; inspector as drawer

**Key behaviors**

- ⌘K opens shared `CommandPalette` (tutorial-filtered components)
- Progress: single branded stepper (level + step), not twin gray bars
- Level complete: `Dialog` component, not custom overlay div
- Completion: inline panel or single modal — not 3-card carousel
- Theme: global `ThemeToggle`; canvas follows app theme

### C. Graduation to editor

- “Open in Editor” uses existing `tutorialCanvasToEditorGraph` + `importDiagram`
- Transition toast + optional “You’re now in the full editor” coach mark (reuse onboarding patterns)

---

## Design Tokens & Components (Mandatory)

### Tokens (from `CONTRIBUTING.md`)

| Use case | Class |
|----------|--------|
| Page background | `bg-surface-page` |
| Panels / sidebars | `bg-surface-panel` |
| Cards | `bg-surface-card` |
| Borders | `border-border`, `border-border-strong` |
| Primary text | `text-text-primary` |
| Secondary | `text-text-secondary`, `text-text-muted` |
| Primary CTA | `bg-accent hover:bg-accent-hover text-white` |
| Subtle CTA | `bg-accent-bg text-accent-text` |
| Modals | `bg-overlay-modal/60` scrim |

### Ban list (tutorial PRs)

- No `#595959`, `#F4F4F4`, `#1A1A1A` as primary surfaces
- No `onMouseEnter` inline style color swaps on buttons
- No `text-slate-*` in new tutorial chrome (use semantic text tokens)
- No new hardcoded hex except tutorial **badge accent** on cards (from `tutorial.color`)

### Shared components to adopt

| Need | Use |
|------|-----|
| Buttons | `@/components/ui/button` |
| Confirm / level complete | `@/components/ui/ConfirmDialog` or `Dialog` |
| Theme | `ThemeToggle` |
| Command search | `CommandPalette` |
| Toasts | `sonner` (already) |
| Auth upsell | `AuthModal` + dashboard banner pattern |

---

## Architecture Changes

### Option A (Recommended): Guided Editor Mode

Wrap shared editor primitives with tutorial constraints:

```
TutorialPlayerShell
├── TutorialToolbar          (new, mirrors Toolbar subset)
├── GuideRail                  (refactored GuidePanel)
├── Canvas                     (reuse components/Canvas.tsx)
│   └── props: readOnly?, tutorialMode, onNodesChange...
└── PropertiesPanel          (mode="tutorial" | readOnly)
```

**Pros:** True product continuity; one canvas codebase.  
**Cons:** Requires `diagramStore` vs `tutorialStore` boundary work; medium refactor.

### Option B (Interim): Visual refresh only

Keep `TutorialCanvas` but restyle shell + GuidePanel to semantic tokens.

**Pros:** Fast; low risk.  
**Cons:** Still two canvases; long-term debt remains.

**Plan:** Phase 1–3 = Option B. Phase 4–5 = migrate to Option A.

### New shared module

```
frontend/components/tutorial/shell/
  TutorialToolbar.tsx
  TutorialStepper.tsx
  TutorialGuideRail.tsx
  TutorialLevelDialog.tsx
  TutorialCompleteDialog.tsx
  tokens.ts                    // optional: tutorial-specific spacing constants
```

Extract from `TutorialPageClient.tsx` to shrink the 700-line file.

---

## Implementation Phases

### Phase 0 — Design baseline (1–2 days)

**Deliverables**

- [ ] Screenshot audit doc (before/after) — player, catalog, editor side-by-side
- [ ] Figma or in-code reference page `/dev/tutorial-design` (optional) showing target components
- [ ] List of inline-style offenders via script:

```bash
rg "style=\{\{|#595959|#F4F4F4|text-slate-" frontend/app/tutorials frontend/components/tutorial
```

**Exit criteria:** Team agrees on north star layout wireframe.

---

### Phase 1 — Player chrome token migration (2–3 days)

**Scope:** Restyle without behavior changes.

| Task | File(s) |
|------|---------|
| Replace page bg / header with semantic tokens | `TutorialPageClient.tsx` |
| Extract `TutorialToolbar` | new `shell/TutorialToolbar.tsx` |
| Replace gray CTAs with `Button` + accent | toolbar, guest banner, level complete |
| Use `ThemeToggle` instead of local canvas theme toggle | `TutorialPageClient.tsx` |
| Progress → `TutorialStepper` component | new `shell/TutorialStepper.tsx` |
| Level complete → `Dialog` | `shell/TutorialLevelDialog.tsx` |

**Exit criteria**

- Zero `#595959` / `#F4F4F4` in `TutorialPageClient.tsx`
- Player respects light/dark `bg-surface-page`
- Visual review: player header matches dashboard header density

---

### Phase 2 — Guide rail redesign (2–3 days)

**Scope:** Make the left panel feel like editor sidebar content.

| Task | Detail |
|------|--------|
| Phase breadcrumb | `Context → Intro → Teaching → Build → Connect` pills; current step highlighted with `bg-accent-bg` |
| Human labels | Hide raw `session.phase` enum |
| Teaching callouts | Restyle `whyItMatters` / `tradeoff` with `border-border` + subtle semantic tints (not raw amber-50) |
| Requirements checklist | Match editor validation chip style |
| Explain differently | `Button variant="ghost"` with `Sparkles`; auth-gated |
| Hints | Collapsible `<details>` or muted callout at bottom |

**Files:** `GuidePanel.tsx` → split into `TutorialGuideRail.tsx` + `PhaseCard.tsx` + `RequirementChecklist.tsx` (already exists inline)

**Exit criteria**

- Guide rail visually matches `PropertiesPanel` width, padding, typography
- Screenshot test or Storybook stories for each phase type

---

### Phase 3 — Intro & completion simplification (2 days)

**Replace carousels with product modals.**

| Current | Target |
|---------|--------|
| `IntroCardFlow` 4-card carousel | Single “Start tutorial” dialog OR first-time expandable section in guide rail |
| `CompletionCardFlow` multi-card | One completion dialog: learned bullets + next tutorial + Open in Editor |

**Tasks**

- [ ] `TutorialStartDialog` — title, description, time estimate, Start / Skip
- [ ] `TutorialCompleteDialog` — trophy, learned items, next tutorial CTA
- [ ] Remove or gate `IntroCardFlow` localStorage show-count logic (replace with `onboardingStore` pattern if needed)
- [ ] Deprecate dark full-screen scrim aesthetic

**Files:** `IntroCardFlow.tsx`, `CompletionCardFlow.tsx`, `TutorialPageClient.tsx`

**Exit criteria**

- Starting a tutorial ≤ 1 click from land (no 4-card deck for returning users)
- Completion flow uses same dialog components as dashboard confirm modals

---

### Phase 4 — Canvas unification (4–6 days) ⚠️ highest effort

**Goal:** Tutorial player uses `components/Canvas.tsx`.

| Task | Detail |
|------|--------|
| Audit diff | List `TutorialCanvas` features not in `Canvas` (highlight rings, step overlay, skip, fit-view registration) |
| Add `tutorialMode` prop to `Canvas` | Disables drag-delete?, shows highlight overlays, registers `__tutorialFitView` |
| Wire `CommandPalette` | Replace `ComponentPalette` slide-out; reuse editor search |
| Node types | Ensure tutorial uses same `nodeTypes` / `edgeTypes` as editor |
| Layout | Keep `layoutDiagramViaMermaid` on step complete (already in GuidePanel) |

**Files:** `TutorialCanvas.tsx`, `Canvas.tsx`, `TutorialPageClient.tsx`, `CommandPalette.tsx`

**Exit criteria**

- `TutorialCanvas.tsx` deleted or thin wrapper (<100 lines)
- Tutorial diagrams render identically to editor import path
- ⌘K works in tutorials same as editor

---

### Phase 5 — Inspector unification (2–3 days)

| Task | Detail |
|------|--------|
| Add `mode: 'tutorial'` to `PropertiesPanel` | Read-only: label, component tooltip, ports summary |
| Remove duplicate `NodeDetailsPanel` | Or make it wrap PropertiesPanel |
| Empty state | “Select a component to see details” matching editor empty inspector |

**Files:** `NodeDetailsPanel.tsx`, `PropertiesPanel.tsx`, `TutorialPageClient.tsx`

---

### Phase 6 — Responsive & mobile (2 days)

- [ ] `< lg`: guide rail → bottom sheet (`Sheet` from shadcn)
- [ ] Collapse right inspector by default on tablet
- [ ] Touch-friendly stepper in header
- [ ] Test iOS Safari + Android Chrome

---

### Phase 7 — Polish, a11y, analytics (1–2 days)

- [ ] Focus trap in dialogs; `aria-current` on stepper
- [ ] Keyboard: `]` next phase when requirements met (document in hints)
- [ ] Analytics: `tutorial_ui_theme`, `tutorial_mobile_sheet_opened`
- [ ] OG / share cards already exist — ensure player meta unchanged

---

## File Change Matrix

| Phase | New files | Modified files | Delete / deprecate |
|-------|-----------|----------------|-------------------|
| 1 | `tutorial/shell/TutorialToolbar.tsx`, `TutorialStepper.tsx`, `TutorialLevelDialog.tsx` | `TutorialPageClient.tsx` | — |
| 2 | `TutorialGuideRail.tsx`, `PhaseBreadcrumb.tsx` | `GuidePanel.tsx` | — |
| 3 | `TutorialStartDialog.tsx`, `TutorialCompleteDialog.tsx` | `TutorialPageClient.tsx` | `IntroCardFlow`, `CompletionCardFlow` (eventually) |
| 4 | — | `Canvas.tsx`, `CommandPalette.tsx`, `TutorialPageClient.tsx` | `TutorialCanvas.tsx`, `ComponentPalette.tsx` |
| 5 | — | `PropertiesPanel.tsx`, `TutorialPageClient.tsx` | `NodeDetailsPanel.tsx` |
| 6 | `TutorialMobileSheet.tsx` | shell components | — |

---

## Suggested PR Order & Timeline

| Week | PR | Outcome |
|------|-----|---------|
| 1 | Phase 0 + 1 | Player no longer looks gray/legacy |
| 1–2 | Phase 2 | Guide rail feels like product sidebar |
| 2 | Phase 3 | Intro/completion not a separate app |
| 3–4 | Phase 4 | Single canvas codebase |
| 4 | Phase 5 | Single inspector |
| 5 | Phase 6–7 | Mobile + a11y polish |

**Total estimate:** ~3–5 weeks for one engineer, or ~2 weeks with parallel Phase 1–3 + deferred Phase 4.

---

## Testing Plan

### Visual regression

- [ ] Playwright screenshots: catalog, player (each phase), level complete, completion dialog — light + dark
- [ ] Compare editor vs tutorial canvas node rendering (same template loaded)

### Unit / smoke

- [ ] Existing `GuidePanel.smoke.test.tsx` updated for new class names
- [ ] `TutorialStepper` percent math tests
- [ ] No regression in `lib/tutorial/*` engine tests

### Manual QA checklist

- [ ] Guest can play tutorial; auth-gated explain hidden
- [ ] Sign in → progress persists; UI unchanged except banner removal
- [ ] Open in Editor → diagram matches tutorial canvas
- [ ] Restart / level complete / skip still work
- [ ] ⌘K add component (post Phase 4)

---

## Success Metrics

| Metric | Baseline | Target (30 days post-launch) |
|--------|----------|------------------------------|
| Tutorial start → step 3 completion | measure via `tutorial_started` / step events | +15% relative |
| “Open in Editor” click-through after completion | analytics | +25% relative |
| Support tickets mentioning “tutorial looks broken/different” | informal | → 0 |
| Inline-style count in `components/tutorial/` | ~80+ occurrences | < 10 (badge accents only) |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Canvas unification breaks tutorial validation | Feature flag `tutorialUseSharedCanvas`; keep `TutorialCanvas` until parity proven |
| `diagramStore` / `tutorialStore` conflict | Tutorial mode never mounts diagramStore; import only on “Open in Editor” |
| Scope creep into content rewrite | Design PRs touch only `components/tutorial` + player shell — not `data/tutorials/*` |
| Dark mode canvas contrast | Use same `stylingConstants` as editor; test both themes |

---

## Quick Wins (Can Ship in 1 PR)

If you need immediate improvement before the full plan:

1. Swap `#595959` buttons → `Button` + `bg-accent` in `TutorialPageClient.tsx`
2. `bg-surface-page` page background + `bg-surface-panel` header
3. Hide raw phase enum in `GuidePanel`
4. Remove 4-card intro for users with `richProgress[tutorialId]` (returning learners skip straight to step 1)

---

## References

- Design tokens: `CONTRIBUTING.md`
- Canvas truth: `frontend/lib/theme/stylingConstants.ts`, `components/Canvas.tsx`
- Platform tutorial plan: `docs/tutorials-improvement-plan.md`
- Catalog baseline (good): `components/tutorial/TutorialCard.tsx`, `components/dashboard/LearnClient.tsx`
