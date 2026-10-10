#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createArchDrawMCPServer } from './server.js';

const server = createArchDrawMCPServer();
server.connect(new StdioServerTransport())
  .then(() => console.error('ArchDraw MCP server running on stdio'))
  .catch(console.error);
