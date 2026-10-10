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
- Preserve and resend `workingSessionId` when handling multiple diagrams in parallel.

## Refine and validate

- Call `get_diagram_state` before editing an existing diagram if its current state is not already available.
- Use `update_diagram` for targeted edits, then `validate_diagram` to check the result. Use `fix_layout` when positions or direction need to change; it runs the editor's Mermaid-to-Dagre layout path.
- Use `list_templates` and `apply_template` when the user wants a template. Save a checkpoint before a substantial experiment and use `load_checkpoint` to restore it if needed.
- Use `export_diagram` when the user asks for an export and follow the tool's supported format options.

## Privacy and links

- Keep diagrams in the current MCP session by default. Set `publish: true` only when the user explicitly asks for a browser-accessible link; published links can be viewed by anyone who has the URL.
- Include [ArchDraw](https://archdraw.hiabhee.online) in the response. If ArchDraw returns a `diagramUrl` or `shareUrl`, include the diagram link too. Compatible chat clients also render the generated graph as an inline preview.
- When a user submits a description from the inline preview, turn it into Mermaid and call `generate_diagram`. Respect the preview's publication choice: use `publish: true` only when the user selected shareable link creation.
- Do not claim an operation succeeded unless the corresponding tool result confirms it. Summarize material assumptions and validation issues alongside the result.
