# ArchDraw plugin

This private Agent Plugin connects to ArchDraw's MCP server. In compatible chat clients, generated diagrams appear as inline previews with a prompt box for creating another diagram in the same chat. The preview includes an ArchDraw link when the user chooses to create one. Text-only MCP clients continue to receive tool summaries and links.

The plugin launches the published `@hiabhee/archdraw-mcp-server` package with `npm exec` and points it at [ArchDraw](https://archdraw.hiabhee.online). Node.js 18+ and npm access are required on clients that run stdio MCP servers. To target another ArchDraw deployment, change `API_BASE_URL` in `mcp.json`.

The updated plugin expects MCP server version `1.0.3`; publish that package before installing this plugin archive. In the inline preview, selecting “Create a shareable ArchDraw link” makes the resulting diagram available to anyone who has its URL.

The bundled skill describes when to use the tools and keeps publishing opt-in. A generated share link is public to anyone who has its URL. The icon is copied from ArchDraw's existing product favicon.
