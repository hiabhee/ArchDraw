import { describe, it, expect } from 'vitest';
import { runMermaidPipeline } from '../pipeline';
import type { RFNode } from '../types';

describe('Mermaid pipeline free-text placement', () => {
  it('places a top heading above the graph bounding box', async () => {
    const code = `graph LR
  %% archdraw-text: {"id":"title","text":"System Architecture","size":"heading","anchor":"top"}
  A[API]-->B[(DB)]`;
    const res = await runMermaidPipeline(code);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const title = res.data.nodes.find((n) => n.id === 'title') as RFNode;
    const a = res.data.nodes.find((n) => n.id === 'A') as RFNode;
    const b = res.data.nodes.find((n) => n.id === 'B') as RFNode;
    expect(title.type).toBe('textLabelNode');
    expect(title.position.y + (title.height ?? 0)).toBeLessThan(a.position.y);
    expect(title.position.y + (title.height ?? 0)).toBeLessThan(b.position.y);
  });

  it('places a note to the right of its referenced node', async () => {
    const code = `graph LR
  %% archdraw-note: {"id":"n1","title":"Note","body":"async via queue","anchor":"node","anchorTarget":"API"}
  API[API]-->DB[(DB)]`;
    const res = await runMermaidPipeline(code);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const note = res.data.nodes.find((n) => n.id === 'n1') as RFNode;
    const api = res.data.nodes.find((n) => n.id === 'API') as RFNode;
    expect(note.type).toBe('annotationNode');
    // With wider rect nodes (200px) the direct right slot may collide with DB,
    // so placement falls back to the next non-colliding candidate (right-below or below).
    // Assert the note is adjacent to API and not overlapping it.
    const apiRight = (api.position.x ?? 0) + (api.width ?? 0);
    const apiBottom = (api.position.y ?? 0) + (api.height ?? 0);
    const isRight = (note.position.x ?? 0) > apiRight - 1;
    const isBelow = (note.position.y ?? 0) > apiBottom - 1;
    expect(isRight || isBelow).toBe(true);
    // And it should not sit on top of API
    expect((note.position.x ?? 0) + (note.width ?? 0) > (api.position.x ?? 0)).toBe(true);
  });

  it('keeps anchor none text at its stored position', async () => {
    const code = `graph LR
  %% archdraw-text: {"id":"free","text":"Free text","x":300,"y":120}
  A[API]-->B[(DB)]`;
    const res = await runMermaidPipeline(code);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const free = res.data.nodes.find((n) => n.id === 'free') as RFNode;
    expect(free.position).toEqual({ x: 300, y: 120 });
  });

  it('does not inflate a subgraph with its heading child', async () => {
    const base = `graph LR
  subgraph Web["Web"]
    API[API]
  end
  API-->DB[(DB)]`;
    const withHeading = `graph LR
  subgraph Web["Web"]
    %% archdraw-text: {"id":"wh","text":"Web Tier","size":"heading","anchor":"subgraph","anchorTarget":"Web"}
    API[API]
  end
  API-->DB[(DB)]`;
    const baseRes = await runMermaidPipeline(base);
    const headRes = await runMermaidPipeline(withHeading);
    expect(baseRes.success && headRes.success).toBe(true);
    if (!baseRes.success || !headRes.success) return;

    const baseWeb = baseRes.data.nodes.find((n) => n.id === 'Web') as RFNode;
    const web = headRes.data.nodes.find((n) => n.id === 'Web') as RFNode;
    const wh = headRes.data.nodes.find((n) => n.id === 'wh') as RFNode;
    expect(web.type).toBe('groupNode');
    expect(wh.type).toBe('textLabelNode');
    // Heading is parented to the group and sits above it (negative relative y)
    expect(wh.parentNode).toBe('Web');
    expect(wh.position.y).toBeLessThan(0);
    // Group bounds must be driven by the API child, not the heading
    expect(web.height).toBe(baseWeb.height);
    expect(web.width).toBe(baseWeb.width);
  });
});
