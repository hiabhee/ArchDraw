import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 60000,
    // Load the linked MCP build in Node so its on-disk widget assets resolve as in production.
    server: { deps: { external: [/[/\\]mcp-server[/\\]dist[/\\]/] } },
  },
  resolve: {
    alias: {
      '@': path.resolve(configDir, './'),
    },
  },
});
