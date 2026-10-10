# `components/` — React UI by area

Components are grouped by the part of the product they belong to. Logic that isn't UI belongs in [`lib/`](../lib/README.md); state belongs in `store/`.

| Folder | What's in it | Used by |
| --- | --- | --- |
| `canvas/` | The React Flow canvas: `Canvas.tsx`, node types (`nodes/`: SystemNode, ShapeNode, GroupNode, text/annotation, handles, `shapes/`), edge renderer (`edges/`), overlays, and `canvasTypes.ts` (the node/edge type registry every canvas host shares) | Editor, share/embed viewers, tutorials |
| `editor/` | The editor page shell: `Editor.tsx`, AI bar, command palette, context menu, generation progress, repo importer; plus `toolbar/`, `panels/` (properties, Mermaid code, sidebars), `modals/`, and first-run `onboarding/` | `app/editor` |
| `viewers/` | Read-only viewers for shared links (`SharedCanvasViewer`) and iframe embeds (`embed/`) | `app/share`, `app/embed` |
| `auth/` | Sign-in modal and buttons, user menu | Editor, dashboard, connect-agent |
| `providers/` | App-wide React providers: theme, auth session, analytics | `app/layout.tsx` |
| `landing/` | Marketing site: the landing page and its interactive demo, plus the nav/footer shared by public pages | `app/page.tsx`, about, blog, docs, FAQ, … |
| `dashboard/` | Signed-in dashboard: recent canvases, templates, learn | `app/dashboard` |
| `tutorial/` | Guided tutorial UI (canvas, guide panel, cards) | `app/tutorials` |
| `icons/` | Cloud-provider and technology brand icon components | Canvas nodes, palettes |
| `ui/` | Low-level primitives (shadcn/Radix: button, dialog, dropdown, …) | Everywhere |
| `agent-skill/` | Small widgets for the agent-skill page | `app/agent-skill` |
| `jev/` | Experimental architecture-spec test page | `app/test` |

Canvas components are shared by several hosts. A node or edge must read its graph and settings through `CanvasHostContext` (`lib/diagram/canvas/`), and must not write to the editor store unless the host is the editor. See AGENTS.md, "Canvas hosts".
