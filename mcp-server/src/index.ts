#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createArchDrawMCPServer } from './server.js';
import { PROJECT_COMMANDS, runProjectCommand } from './cli/project-link.js';

const command = process.argv[2];
if (command && PROJECT_COMMANDS.has(command)) {
  runProjectCommand(command, process.argv.slice(3))
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
} else {
  const server = createArchDrawMCPServer();
  server.connect(new StdioServerTransport())
    .then(() => console.error('ArchDraw MCP server running on stdio'))
    .catch(console.error);
}
