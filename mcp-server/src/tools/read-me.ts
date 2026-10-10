export function getReadMe(): string {
  return `# ArchDraw MCP guide

Use \`generate_diagram\` with Mermaid whenever possible. It runs the same Mermaid → Dagre pipeline as the editor, supports subgraphs, and returns a diagram kept in the current MCP session.

Model the system the user describes. Architecture patterns are guidance, not mandatory components: include gateways, queues, authentication, storage, observability, or direct client streams only when the available context supports them.

Call \`get_diagram_state\`, \`validate_diagram\`, and \`update_diagram\` to refine the current diagram. Keep and resend \`workingSessionId\` when working on multiple diagrams through one MCP connection.

Preview links: \`generate_diagram\`, \`apply_template\` and \`update_diagram\` return a preview link (\`shareUrl\`) and edit link (\`diagramUrl\`) in the same response by default. ALWAYS show them to the user — the diagram is visual and that link is how they see it. Links are unguessable, view-by-link and expire after 7 days. Pass \`publish:false\` only if the user asks to keep a diagram private; it then stays in the MCP session.

Use \`apply_template\` for a starting point, \`fix_layout\` to run the editor layout pipeline, and checkpoints to experiment safely.`;
}
