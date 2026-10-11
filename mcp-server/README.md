# @hiabhee/archdraw-mcp-server

The MCP server for [ArchDraw](https://archdraw.hiabhee.online). It lets an AI agent make, change, validate, and export software architecture diagrams.

The server uses the same Mermaid → Dagre layout pipeline as the ArchDraw editor. Each new diagram gets a preview link that you can open in a browser.

This document uses ASD-STE100 Simplified Technical English.

## Select a connection type

| Connection type | Value | Use it when |
| --- | --- | --- |
| **Remote (HTTP)** | `https://archdraw.hiabhee.online/api/mcp` | The client can connect to a remote MCP server. This is the recommended type. You do not install this package. |
| **Local (stdio)** | `npx -y @hiabhee/archdraw-mcp-server@1.0.6` | The client can only start a local process. |

For the steps for each client (Claude Code, Claude apps, Codex, Cursor, VS Code, Gemini CLI, OpenCode, and others), refer to the [connection guide](https://archdraw.hiabhee.online/docs/connect-agents).

## Use the local server

### Requirements

- Node.js 18 or later
- Network access to `archdraw.hiabhee.online`

### Configuration

Most clients use this format:

```json
{
  "mcpServers": {
    "archdraw": {
      "command": "npx",
      "args": ["-y", "@hiabhee/archdraw-mcp-server@1.0.6"],
      "env": {
        "API_BASE_URL": "https://archdraw.hiabhee.online"
      }
    }
  }
}
```

> **CAUTION:** You must set `API_BASE_URL`. If you do not set it, the server starts and shows its tools, but `generate_diagram`, `fix_layout`, and preview links do not operate.

### Environment variables

| Variable | Necessary | Function |
| --- | --- | --- |
| `API_BASE_URL` | Yes | The ArchDraw web API that does the layout, publishes previews, and keeps sessions. Use `https://archdraw.hiabhee.online`, or the URL of your own deployment. |

## Link a repository to a live project

A live project is an ArchDraw canvas that shows which coding-agent session works on which component. To connect a repository to a live project:

1. In the ArchDraw editor, open the canvas and select **Make live project**.
2. In the repository, run:

   ```bash
   npx -y @hiabhee/archdraw-mcp-server@1.0.6 link --api https://archdraw.hiabhee.online
   ```

3. In the editor, select **Live project → Connect an agent** and enter the code that the command shows.

The command keeps the link in `~/.archdraw/projects.json` (mode `0600`), outside the repository. The file contains a project token. Do not share it. Other commands:

| Command | Result |
| --- | --- |
| `link --api <URL>` | Links the current repository (or its main repository, for a git worktree). |
| `status` | Shows the project that the current repository is linked to. |
| `unlink` | Removes the local link. To revoke the token, select **Stop** in the editor. |

The ArchDraw plugin for Claude Code uses this link to report the files that each session edits. It sends file paths only.

## Tools

| Tool | Function |
| --- | --- |
| `read_me` | Gives the reference guide for the agent. The agent calls it first. |
| `generate_diagram` | Makes a diagram from Mermaid text or from nodes and edges. |
| `update_diagram` | Adds, removes, or changes nodes and edges in the current diagram. |
| `get_diagram_state` | Gives the nodes and edges of the current diagram. |
| `validate_diagram` | Finds structural problems and gives recommendations. |
| `fix_layout` | Calculates the layout again with the ArchDraw editor pipeline. |
| `apply_template` | Loads an architecture template. |
| `list_templates` | Gives the list of templates. |
| `list_node_types` | Gives the list of component types in the ArchDraw library. |
| `save_checkpoint` | Saves the current diagram with a name. |
| `load_checkpoint` | Restores a saved diagram. |
| `export_diagram` | Exports the diagram as JSON, PNG, or SVG. |

## Data and privacy

- The server sends the diagram content that the agent gives it to `API_BASE_URL`. This includes component names, labels, connections, and Mermaid text. The server does not read your source files.
- Each new diagram gets a preview link by default. Anyone with the link can see the diagram. The link expires after 7 days. To prevent a link, tell the agent to keep the diagram private (`publish: false`).
- The local server keeps the working diagram and its checkpoints in memory. It discards them when the process stops.

> **WARNING:** Do not put passwords, API keys, or other secrets in diagram labels.

Refer to the [privacy policy](https://archdraw.hiabhee.online/privacy).

## Use the server in your own code

The package exports a server factory for Streamable HTTP hosts:

```ts
import { createArchDrawMCPServer, handleMcpHttpRequest } from '@hiabhee/archdraw-mcp-server/server';
```

The hosted endpoint at `/api/mcp` uses this export.

## Links

- [Source code](https://github.com/hiabhee/ArchDraw/tree/main/mcp-server)
- [Connection guide](https://archdraw.hiabhee.online/docs/connect-agents)
- [Issues](https://github.com/hiabhee/ArchDraw/issues)

## License

MIT
