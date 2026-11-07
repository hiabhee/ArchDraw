'use client';

import { useEffect } from 'react';
import { createWebMcpTools, type SiteCatalog } from '@/lib/site/webmcpTools';

/** The WebMCP surface Chrome exposes (origin trial / `chrome://flags/#enable-webmcp-testing`). */
interface ModelContext {
  registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => Promise<void> | void;
}

/**
 * Registers ArchDraw's WebMCP tools (`lib/site/webmcpTools.ts`) on every page, so a
 * browser agent can search templates and tutorials, open pages and start a diagram.
 * A no-op in browsers without `document.modelContext`. Tools are removed on unmount.
 */
export function WebMcpTools() {
  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (typeof modelContext?.registerTool !== 'function') return;

    let catalog: Promise<SiteCatalog> | null = null;
    const tools = createWebMcpTools({
      loadCatalog: () => {
        catalog ??= fetch('/catalog.json').then((r) => {
          if (!r.ok) throw new Error(`catalog.json ${r.status}`);
          return r.json() as Promise<SiteCatalog>;
        });
        catalog.catch(() => { catalog = null; });
        return catalog;
      },
      navigate: (path) => window.location.assign(path),
    });

    const controller = new AbortController();
    for (const tool of tools) {
      try {
        void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(() => {});
      } catch {
        // A tool the browser rejects must not break the page or the other tools.
      }
    }
    return () => controller.abort();
  }, []);

  return null;
}
