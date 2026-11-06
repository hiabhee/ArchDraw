import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { generatePureSVG } from '../index';
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
