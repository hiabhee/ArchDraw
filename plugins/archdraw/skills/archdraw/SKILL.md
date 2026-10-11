---
name: archdraw
description: Use ArchDraw to create, refine, validate, lay out, template, checkpoint, or export an architecture diagram.
---

# ArchDraw architecture diagrams

Use ArchDraw's MCP tools when the user wants an architecture represented or changed as a diagram. Model only components and relationships supported by the user's description. Ask a focused question when a missing constraint would materially change the architecture; otherwise state a small assumption in the result.

## Create a diagram

- Prefer `generate_diagram` with Mermaid (`graph LR` or `graph TD`) because this uses the same parser and Dagre layout pipeline as the ArchDraw editor. Use structured node and edge data only when the user already has it or requests it.
- Include the user's original request in `userPrompt` when available. Pass named technologies through `techStack` and explicitly requested special requirements through `customFeatures`.
- Use subgraphs to group tiers or trust boundaries when they make the system easier to read. Keep labels concise and add communication labels for asynchronous, event, or streaming edges.
- Before generation, audit the planned edges: avoid arrows into client-tier nodes except between client-tier nodes; prevent one node from becoming an unjustified hub; and keep the flow consistent with the intended architecture rather than adding layers by habit.
- Call `list_node_types` when the user asks for a specific component icon or when choosing from ArchDraw's component library would improve the result.
- Keep the `workingSessionId` returned by `generate_diagram` / `apply_template` and pass it on every later call about that diagram (`update_diagram`, `get_diagram_state`, `validate_diagram`, checkpoints, `export_diagram`). The hosted server requires it.

## Refine and validate

- Call `get_diagram_state` before editing an existing diagram if its current state is not already available.
- Use `update_diagram` for targeted edits, then `validate_diagram` to check the result. Use `fix_layout` when positions or direction need to change; it runs the editor's Mermaid-to-Dagre layout path.
- Use `list_templates` and `apply_template` when the user wants a template. Save a checkpoint before a substantial experiment and use `load_checkpoint` to restore it if needed.
- Use `export_diagram` when the user asks for an export and follow the tool's supported format options.

## Preview links (always share them)

- A diagram is visual, and in a terminal or IDE the user cannot see it unless you give them the link. `generate_diagram`, `apply_template`, and `update_diagram` return a preview link (`shareUrl`) and an edit link (`diagramUrl`) in the same response — no extra call is needed. **Always put both links in your reply**, near the top.
- Links are unguessable, viewable by anyone who has them, and expire after 7 days. If the user asks to keep a diagram private, pass `publish: false`; then say plainly that no link was created.
- If the result contains `linkError` instead of links, tell the user the diagram was generated but could not be published, and include the reason.
- Never put secrets, credentials, or private hostnames in diagram labels. Anyone with the link can read them.
- When a user submits a description from the inline preview, turn it into Mermaid and call `generate_diagram`, respecting the preview's link choice.
- Do not claim an operation succeeded unless the corresponding tool result confirms it. Summarize material assumptions and validation issues alongside the result.

## Live projects (Claude Code)

- When a session starts in a repository linked to an ArchDraw live project, the ArchDraw hook adds a short "ArchDraw live project" note to your context with the project link, your ArchDraw session id, and the exact `map` / `publish` / `intent` commands. Use those commands; they read the local link, so you never see or pass a credential.
- File paths you edit are reported automatically. Share intent once per distinct task with the `intent` command (one line, no secrets); do not narrate every step.
- To map a codebase: inspect the repository's real structure (manifests, entry points, services, data stores, queues), then publish Mermaid with one node per meaningful component, subgraphs for areas such as frontend/backend/infra, and stable ids. Pass a JSON map from node id to the repo-relative paths or globs it owns (for example `{"auth": ["frontend/lib/server/auth.ts", "frontend/app/api/auth/**"]}`). Map every directory that agents commonly edit; prefer directories over long file lists.
- Keep the diagram live: when your change adds, removes, renames or moves a real component (a service, module, worker, store, or integration — not a helper file), export the current diagram with `mermaid --out <dir>`, edit `diagram.mmd` and `paths.json`, and `publish --session <your id>`. Keep existing node ids so components keep their identity; publishing keeps the user's layout and only places new components. Use `--relayout` only when the user asks for a fresh layout.
- The hook may note that a file you created belongs to no component. Update the diagram only if it is genuinely a new component.
- To link a repository, the user runs `npx -y @hiabhee/archdraw-mcp-server link --api <ArchDraw URL>` and enters the printed code in the editor's Live project panel.
