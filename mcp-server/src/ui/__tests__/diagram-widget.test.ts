import { describe, expect, it } from 'vitest';
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

  it('references only elements that exist', () => {
    const ids = new Set([...script.matchAll(/\$\('([\w-]+)'\)/g)].map((match) => match[1]));
    const missing = [...ids].filter((id) => !DIAGRAM_WIDGET_HTML.includes(`id="${id}"`));
    expect(missing).toEqual([]);
  });
});
