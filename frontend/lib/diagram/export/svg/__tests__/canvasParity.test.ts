import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { generatePureSVG } from '../index';
import { renderShapeNode, renderSystemNode, renderTextLabel } from '../renderNodes';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles';

const card = (id: string, x: number, label: string, subtitle?: string): Node => ({
  id, type: 'shapeNode', position: { x, y: 0 }, width: 240, height: 99,
  data: { label, subtitle, shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 99 },
});
const edge = (id: string, source: string, target: string, label: string): Edge => ({
  id, source, target, type: 'smoothstep', data: { label },
} as Edge);

const nodes = [card('a', 0, 'Auth Service', 'JWT/OAuth verifies identity'), card('b', 500, 'API Gateway', 'Kong routing')];
const render = (style: 'studio-minimal' | 'studio-metallic' | 'precision') =>
  generatePureSVG(nodes, [edge('e1', 'b', 'a', '5. Verify JWT'), edge('e2', 'a', 'b', '6. Auth OK')], true, '#0b0c0e', 'LR', style, 'default', 'off');

describe('export draws what the canvas draws', () => {
  it('uses the canvas font size and wraps heading text within its box', () => {
    const textStyle = { text: 'Netflix system architecture', fontSize: 'heading' };
    const svg = renderTextLabel({
      id: 'title', type: 'textLabelNode', data: { label: '', category: 'compute', ...textStyle },
      x: 0, y: 0, width: 560, height: 200,
    }, true);
    expect(svg).toContain('font-size="72"');
    expect(svg.match(/<tspan/g)).toHaveLength(2);
  });

  it.each([
    { renderCard: renderShapeNode, iconX: 24, titleX: 92 },
    { renderCard: renderSystemNode, iconX: 24, titleX: 97 },
  ])('centers the Studio Metallic icon even on taller cards ($iconX inset)', ({ renderCard, iconX, titleX }) => {
    const style = 'studio-metallic';
    const tokens = resolveCanvasTokens({ renderStyleId: style, isDark: true });
    for (const height of [80, 116]) {
      const svg = renderCard({
        id: 'gateway', type: 'shapeNode', x: 0, y: 0, width: 300, height,
        data: { label: 'API Gateway', subtitle: 'Auth + routing', category: 'edge', icon: 'arch-webhook', iconSource: 'manual' },
      }, true, style, tokens);
      const iconY = (height - 60) / 2;
      expect(svg).toContain(`<rect x="${iconX}" y="${iconY}" width="60" height="60"`);
      expect(svg).toContain(`<g transform="translate(${iconX + 7.5}, ${iconY + 7.5})"><g data-semantic-icon="arch-webhook"><svg width="45" height="45"`);
      expect(svg).toContain(`<text x="${titleX}"`);
    }
  });

  it('draws legacy frames beneath connections and positions their children in canvas coordinates', () => {
    const group: Node = {
      id: 'group', type: 'frameNode', position: { x: 500, y: -100 }, width: 420, height: 230,
      data: { label: 'Gateway zone' },
    };
    const child = { ...card('child', 30, 'Proxy'), parentId: group.id };
    const other = card('other', 1100, 'API');
    const svg = generatePureSVG([child, group, other], [{ id: 'calls', source: 'child', target: 'other', label: 'HTTPS' }]);
    expect(svg.match(/<g id="groups">([\s\S]+?)<g id="edges">/)?.[1]).toContain('Gateway zone');
    expect(svg).toContain('translate(80, 50)');
    expect(svg).toContain('HTTPS');
  });

  it('excludes hidden elements and their connections from the image and its framing', () => {
    const hidden = { ...card('hidden', -10_000, 'Hidden component'), hidden: true };
    const svg = generatePureSVG([hidden, ...nodes], [
      { id: 'hidden-edge', source: 'a', target: 'b', label: 'Hidden edge', hidden: true },
      { id: 'hidden-source', source: 'hidden', target: 'a', label: 'Hidden source edge' },
    ]);
    expect(svg).toBe(generatePureSVG(nodes, []));
  });

  it.each(['studio-minimal', 'studio-metallic', 'precision'] as const)('keeps both edges of a request/response pair in %s', (style) => {
    const svg = render(style);
    expect(svg).toContain('5. Verify JWT');
    expect(svg).toContain('6. Auth OK');
  });

  it.each(['studio-minimal', 'studio-metallic', 'precision'] as const)('keeps a card subtitle stored as `subtitle` in %s', (style) => {
    // A subtitle may wrap onto several lines, so read the card's text as a whole.
    const text = [...render(style).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ');
    expect(text).toContain('JWT/OAuth verifies identity');
    expect(text).toContain('Kong routing');
  });

  it.each(['shapeNode', 'systemNode'])('exports readable identifier titles for %s cards', (type) => {
    const titles = ['DagreLayoutEngine', 'SimpleFloatingEdge'];
    const cards = titles.map((label, index) => {
      const node = card(String(index), index * 400, label, 'Details');
      return { ...node, type, data: { ...node.data, showIcon: true, icon: 'GitMerge' } };
    });
    const svg = generatePureSVG(cards, [], true, '#0b0c0e', 'LR', 'studio-minimal', 'default', 'all');
    const titleLines = [...svg.matchAll(/<text[^>]*font-size="23"[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);
    expect(titleLines.join(' ')).toBe('Dagre Layout Engine Simple Floating Edge');
    expect(cards.map(node => node.data.label)).toEqual(titles);
  });

  it('wraps a long card subtitle the way the canvas does and keeps every word', () => {
    const wide = [card('a', 0, 'Client', 'Browser / Mobile — initiates request'), card('b', 500, 'DNS', 'Route 53 — resolves domain'), card('c', 1000, 'CDN', 'Cloudflare — edge cache')];
    const svg = generatePureSVG(wide, [], true, '#0b0c0e', 'LR', 'studio-minimal', 'default', 'off');
    const subtitleLines = (title: string) => {
      const texts = [...svg.matchAll(/<text[^>]*font-size="(23|15\.5)"[^>]*>([^<]*)<\/text>/g)].map((m) => [m[1], m[2]]);
      const at = texts.findIndex(([, t]) => t === title);
      const lines: string[] = [];
      for (let i = at + 1; i < texts.length && texts[i][0] === '15.5'; i++) lines.push(texts[i][1]);
      return lines;
    };
    // The canvas card text lane is 203px for a 240px card: these two wrap, the third does not.
    expect(subtitleLines('Client')).toHaveLength(2);
    expect(subtitleLines('DNS')).toHaveLength(2);
    expect(subtitleLines('CDN')).toHaveLength(1);
  });

  it('scales edge labels up when the diagram is seen zoomed out, as the canvas does', () => {
    const edges = [edge('e1', 'a', 'b', 'HTTPS')];
    const scaleOf = (zoom?: number) => /<g transform="translate\([^)]*\) scale\(([\d.]+)\)">/.exec(
      generatePureSVG(nodes, edges, true, '#0b0c0e', 'LR', 'studio-minimal', 'default', 'off', undefined, zoom),
    )?.[1];
    expect(scaleOf(0.5)).toBe('1.4');
    expect(scaleOf(1)).toBe('1');
    expect(scaleOf(2)).toBe('0.85');
  });

  it('inks an event / feedback edge with the same theme colour as the canvas (the primary, not the async amber)', () => {
    const feedback = { id: 'f', source: 'b', target: 'a', type: 'smoothstep', data: { label: 'cache response', edgeType: 'event', connectionType: 'event', syncAsync: 'async', edgeVariant: 'dashed', importance: 'diagnostic' } } as Edge;
    const svg = generatePureSVG(nodes, [feedback], true, '#0b0c0e', 'LR', 'studio-metallic', 'studio-minimal', 'off');
    const { edgePrimary, edgeAsync } = resolveCanvasTokens({ renderStyleId: 'studio-metallic', colorThemeId: 'studio-minimal', isDark: true }).colors;
    const stroke = /<path\s+d="[^"]+"\s+fill="none"\s+stroke="([^"]+)"/.exec(svg)?.[1];
    expect(stroke?.toLowerCase()).toBe(edgePrimary.toLowerCase());
    expect(stroke?.toLowerCase()).not.toBe(edgeAsync.toLowerCase());
  });
});
