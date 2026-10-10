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

## Preview links (always share them)

- A diagram is visual, and in a terminal or IDE the user cannot see it unless you give them the link. `generate_diagram`, `apply_template`, and `update_diagram` return a preview link (`shareUrl`) and an edit link (`diagramUrl`) in the same response — no extra call is needed. **Always put both links in your reply**, near the top.
- Links are unguessable, viewable by anyone who has them, and expire after 7 days. If the user asks to keep a diagram private, pass `publish: false`; then say plainly that no link was created.
- If the result contains `linkError` instead of links, tell the user the diagram was generated but could not be published, and include the reason.
- When a user submits a description from the inline preview, turn it into Mermaid and call `generate_diagram`, respecting the preview's link choice.
- Do not claim an operation succeeded unless the corresponding tool result confirms it. Summarize material assumptions and validation issues alongside the result.
