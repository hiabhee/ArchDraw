import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { DIAGRAM_WIDGET_HTML } from '../diagram-widget.js';

const script = DIAGRAM_WIDGET_HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';

describe('diagram widget', () => {
  // A syntax error stops the whole script, so the host never gets ui/initialize
  // and the chat shows no preview at all.
  it('ships a script that parses', () => {
    expect(script).not.toBe('');
    expect(() => new Function(script)).not.toThrow();
  });

  // Hosts size the inline frame from size-changed; without it the preview can
  // render at zero height.
  it('reports its size to the host', () => {
    expect(script).toContain("'ui/notifications/size-changed'");
  });

  it('keeps the mounted graph when the host finishes without a new diagram', () => {
    const elements = new Map();
    const element = (id: string) => {
      if (elements.has(id)) return elements.get(id);
      const flags = new Set<string>();
      const next = {
        hidden: true,
        classList: { add: (name: string) => flags.add(name), remove: (name: string) => flags.delete(name), contains: (name: string) => flags.has(name) },
        prepend() {}, addEventListener() {}, removeAttribute() {},
      };
      elements.set(id, next);
      return next;
    };
    let onMessage: ((event: unknown) => void) | undefined;
    let ready: (() => void) | undefined;
    const dispose = vi.fn();
    const parent = { postMessage() {} };
    const window = {
      parent,
      localStorage: { getItem: () => null },
      addEventListener: (name: string, handler: (event: unknown) => void) => { if (name === 'message') onMessage = handler; },
      ArchDrawCanvas: { mount: (_element: unknown, _graph: unknown, onReady: () => void) => {
        ready = onReady;
        return { dispose };
      } },
    };
    runInNewContext(script, {
      window, document: { getElementById: element, createElement: () => element('diagram') },
      ResizeObserver: class { observe() {} }, requestAnimationFrame() {}, setTimeout() {},
    });
    const emit = (method: string, params?: object) => onMessage?.({ source: parent, data: { method, params } });
    emit('ui/notifications/tool-result', {
      structuredContent: { success: true, label: 'WhatsApp' },
      _meta: { 'archdraw/previewCanvas': { nodes: [{ id: 'sender' }], edges: [] } },
    });
    ready?.();
    emit('ui/notifications/tool-result', { content: [{ type: 'text', text: 'Done' }] });
    emit('ui/notifications/tool-cancelled');
    expect(dispose).not.toHaveBeenCalled();
    expect(element('stage').classList.contains('live')).toBe(true);
    expect(element('controls').hidden).toBe(false);
  });

  it('references only elements that exist', () => {
    const ids = new Set([...script.matchAll(/\$\('([\w-]+)'\)/g)].map((match) => match[1]));
    const missing = [...ids].filter((id) => !DIAGRAM_WIDGET_HTML.includes(`id="${id}"`));
    expect(missing).toEqual([]);
  });
});
