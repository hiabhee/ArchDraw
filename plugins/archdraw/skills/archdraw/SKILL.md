---
name: archdraw
description: Use ArchDraw to create, refine, validate, lay out, template, checkpoint, or export an architecture diagram.
---

# ArchDraw architecture diagrams

Use ArchDraw for plain-language requests to create or refine diagrams. Choose the tools, layout, and default style from the request. The user can give only a subject. Model only components and relationships supported by the user's description. Ask a focused question when a missing constraint would materially change the architecture; otherwise state a small assumption in the result.

## Create a diagram

- Prefer `generate_diagram` with Mermaid (`graph LR` or `graph TD`) because this uses the same parser and Dagre layout pipeline as the ArchDraw editor. Use structured node and edge data only when the user already has it or requests it.
- For simple diagrams, aim for 3–6 named nodes and use one generation call with `compactResponse: true`. Reopen the canvas only when the user asks or after a separate edit.
- For broad architecture requests, show the major components and primary flows in an overview. Include the subsystem details and secondary connections the user requests. Use the `direction` argument when the user asks for a specific orientation.
- Include the user's original request in `userPrompt` when available. Pass named technologies through `techStack` and explicitly requested special requirements through `customFeatures`.
- Use subgraphs to group tiers or trust boundaries when they make the system easier to read. Keep labels concise and add communication labels for asynchronous, event, or streaming edges.
- Before generation, check each edge against the intended architecture. Keep real replies, feedback, and data delivery to clients. Show a hub when the system has one.
- Keep the `workingSessionId` returned by `generate_diagram` / `apply_template` and pass it on every later call about that diagram (`update_diagram`, `get_diagram_state`). The hosted server requires it.

## Refine and validate

- Review the layout quality before displaying the diagram. Fix overlaps and clipped labels in the same working session. For top-down hierarchies such as family trees, use explicit top-down generation and keep each generation in a clear row. If manual placement is necessary, use the reported Studio card sizes and re-layout when the result overlaps. Preserve node identities and connection directions for visual edits.

- Call `get_diagram_state` before editing an existing diagram if its current state is not already available.
- Use `draw_on_canvas` when the user wants a whiteboard, free text, notes, shapes, precise placement, or changes the automatic layout cannot make. Positions are canvas pixels from the top-left. Studio cards with icons are 300px wide and grow taller when the title or subtitle wraps. Leave about 60px between rendered cards. Operations apply together and an error names the failing operation. Give reusable objects an `id` and use the dimensions in the `canvas` reply when placing more objects.
- Use `layout_diagram` to re-arrange a diagram that looks cramped, too wide or too tall, or when the user asks to tidy it, make it top-down or fit a screen. It re-lays out the current diagram (direction, flow or zones, wrapping, per-group direction via `groupDirections`) and changes only positions; follow with `draw_on_canvas` move/align for manual touch-ups.
- Use `update_diagram` for targeted edits. To change the layout direction or restructure the diagram, call `generate_diagram` again with revised Mermaid; it lays the diagram out with the editor's Mermaid-to-Dagre path.
- Use `apply_template` when the user wants a template (its description lists the template ids).
- For an image, point the user to the preview's Download PNG button or the editor link's export.

## Preview links

- Use the canvas returned by `generate_diagram` as the final in-chat diagram. Call `show_diagram` after a separate edit or when the user asks to reopen the canvas. If either tool reports a missing label or overlap, fix the listed cards in the same working session and then show the corrected diagram. Only use blank cards when the user requested a blank card. For family trees, use labeled people in top-down rows and keep source notes in free text.
- Links are unguessable, viewable by anyone who has them, and expire after 7 days. If the user asks to keep a diagram private, pass `publish: false`; then say plainly that no link was created.
- If the result contains `linkError` instead of links, tell the user the diagram was generated but could not be published, and include the reason.
- Never put secrets, credentials, or private hostnames in diagram labels. Anyone with the link can read them.
- When a user submits a description from the inline preview, turn it into Mermaid and call `generate_diagram`, respecting the preview's link choice.
- Do not claim an operation succeeded unless the corresponding tool result confirms it. Summarize material assumptions and validation issues alongside the result.

## Live projects (Claude Code)

- When a session starts in a repository linked to an ArchDraw live project, the ArchDraw hook adds a short "ArchDraw live project" note to your context with the project link, your ArchDraw session id, and the exact `map` / `publish` / `intent` commands. Use those commands; they read the local link, so you never see or pass a credential.
- File paths you edit are reported automatically. Share intent once per distinct task with the `intent` command (one line, no secrets); do not narrate every step.
- To map a codebase, analyse it before drawing: find what runs (manifests, run/deploy files, entry points), follow imports and calls from each entry point, and grep the boundaries between parts (HTTP routes and their callers, queue publish/consume, database and cache clients, third-party SDKs). Draw an edge only for a call or data flow you found in the code, pointing the way data moves, and Glob every path you map to check it exists. Then publish Mermaid with one node per meaningful component, subgraphs for areas such as frontend/backend/infra, and stable ids. Pass a JSON map from node id to the repo-relative paths or globs it owns (for example `{"auth": ["frontend/lib/server/auth.ts", "frontend/app/api/auth/**"]}`). Map every directory that agents commonly edit; prefer directories over long file lists.
- Keep the diagram live: when your change adds, removes, renames or moves a real component (a service, module, worker, store, or integration — not a helper file), export the current diagram with `mermaid --out <dir>`, edit `diagram.mmd` and `paths.json`, and `publish --session <your id>`. Keep existing node ids so components keep their identity; publishing keeps the user's layout and only places new components. Use `--relayout` only when the user asks for a fresh layout.
- The hook may note that a file you created belongs to no component. Update the diagram only if it is genuinely a new component.
- To link a repository, the user runs `npx -y @hiabhee/archdraw-mcp-server link --api <ArchDraw URL>` and enters the printed code in the editor's Live project panel.
