# ArchDraw — architecture diagrams for Claude Code and Codex

Turn a system description into a clean software architecture diagram without leaving your coding session. Ask your agent for "an architecture diagram of a checkout service with Stripe, Postgres and a Kafka event bus", and the ArchDraw plugin lays it out with the same Mermaid → Dagre pipeline as the [ArchDraw](https://archdraw.hiabhee.online) editor and replies with a **preview link** you can open in your browser and share — in the same response, with no extra request.

## Install

**Claude Code**

```
/plugin marketplace add hiabhee/ArchDraw
/plugin install archdraw@archdraw
```

Or from your shell: `claude plugin marketplace add hiabhee/ArchDraw` then `claude plugin install archdraw@archdraw`.

**Codex**

```
codex plugin marketplace add hiabhee/ArchDraw
codex plugin add archdraw@archdraw
```

You can also install it from the Plugins Directory in the ChatGPT desktop app after adding the marketplace.

Requirements: Node.js 18 or later with `npx` available, and network access to npm and to `archdraw.hiabhee.online`.

## What you get

- **Skill `archdraw`** — tells the agent when and how to use the ArchDraw tools, to prefer Mermaid input, and to always show you the preview link.
- **MCP server `archdraw`** with these tools: `generate_diagram`, `update_diagram`, `validate_diagram`, `fix_layout`, `apply_template`, `list_templates`, `list_node_types`, `get_diagram_state`, `save_checkpoint`, `load_checkpoint`, `export_diagram`, `read_me`.

Try: "Draw the architecture of this repo", "Add a Redis cache in front of the API", "Switch the layout to top-down", or "Start from the chatgpt template".

## Where it works

| Surface | Status |
| --- | --- |
| Claude Code (terminal, IDE, desktop Code tab) | Skill and MCP tools |
| Codex (CLI, IDE, desktop app) | Skill and MCP tools |
| Cowork (session running on your computer) | Skill and MCP tools |
| claude.ai chat | Skill only — local MCP servers don't run there |

## What the plugin runs, sends, and stores

Please read this before installing.

- **Runs:** `npx -y @hiabhee/archdraw-mcp-server@1.0.4`, which downloads that exact, pinned version of the open-source MCP server ([source](https://github.com/hiabhee/ArchDraw/tree/main/mcp-server)) from the public npm registry and runs it locally over stdio.
- **Sends:** the diagram content the agent passes to the tools — component names, labels, connections, and the Mermaid text — to `https://archdraw.hiabhee.online` (`/api/diagram/load`, `/api/diagram/session/<id>`, `/api/diagram/export`) to lay out, publish, sync, and export diagrams. It does not read your source files itself, send credentials, or collect telemetry. Whatever the agent puts in a diagram is what is sent, so avoid putting secrets in diagram labels.
- **Publishes by default:** each generated diagram is saved as a preview link on ArchDraw so you can see it. Links are unguessable, viewable by anyone who has the URL, and expire after 7 days. Ask the agent to keep a diagram private (the tools' `publish: false`) and no link is created; the diagram then stays only in the local MCP session.
- **Stores locally:** the current diagram and any checkpoints live in the MCP server's memory and are discarded when the session ends.

To point the plugin at your own ArchDraw deployment, change `API_BASE_URL` in `.mcp.json`.

## Support

Questions and bug reports: [GitHub issues](https://github.com/hiabhee/ArchDraw/issues). Documentation: [archdraw.hiabhee.online/mcp](https://archdraw.hiabhee.online/mcp). [Privacy policy](https://archdraw.hiabhee.online/privacy) · [Terms](https://archdraw.hiabhee.online/terms).

Licensed under MIT.
