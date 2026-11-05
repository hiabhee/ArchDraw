/**
 * Exports the launch video's canvas as static JSON. The map is the landing
 * hero's own graph (same Mermaid, same layout, same publish merge), and every
 * node, group and edge is drawn by the product's SVG renderer (the one behind
 * share previews and PNG export), one fragment per element, so the video
 * animates exactly the shapes the app draws. No layout runs at render time.
 *
 * Run from frontend/: npx tsx scripts/video/export-diagrams.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Node, Edge } from 'reactflow';
import { generatePureSVG } from '@/lib/diagram/export/svgExport';
import { resolveAbsolutePosition, nodeDepth, calculateBounds } from '@/lib/diagram/export/svg/nodeLayout';
import { getEffectiveNodeDimensions } from '@/lib/diagram/nodes/shapeNodeDimensions';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles/resolveTokens';
import { buildSolidArrowheadPath } from '@/lib/diagram/export/svg/svgPrimitives';
import { buildHeroGraphs } from '@/components/landing/live/heroGraph';

const RENDER_STYLE = 'studio-metallic' as const;
const THEME = 'studio-minimal';
/** The launch film is a bright SaaS-style piece: export the app's light canvas. Set VIDEO_DARK=1 for the night map. */
const DARK = process.env.VIDEO_DARK === '1';

/** Splits the children of `<g id="...">…</g>` into top-level element strings. */
function topLevel(svg: string, id: string): string[] {
  const open = svg.indexOf(`<g id="${id}">`);
  const start = open + `<g id="${id}">`.length;
  const out: string[] = [];
  let depth = 0;
  let from = -1;
  const tag = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  tag.lastIndex = start;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(svg))) {
    const [full, closing, name, , selfClose] = m;
    if (closing && depth === 0 && name === 'g') break; // end of this <g id>
    if (!closing && depth === 0) from = m.index;
    if (closing) depth--;
    else if (!selfClose) depth++;
    if (depth === 0 && from >= 0) {
      out.push(svg.slice(from, m.index + full.length));
      from = -1;
    }
  }
  return out;
}

const attr = (s: string, name: string) => s.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

async function exportGraph(name: string, graph: { nodes: Node[]; edges: Edge[] }) {
  const { nodes, edges } = graph;
  const svg = generatePureSVG(nodes, edges, DARK, 'none', 'LR', RENDER_STYLE, THEME, 'all');
  // Shared gradients and shadow filters the node fragments point at (`url(#...)`).
  const defs = [...svg.matchAll(/<defs>[\s\S]*?<\/defs>/g)].map((m) => m[0]).filter((x) => !x.includes('archdraw-background-pattern')).join('');
  const nodeFragments = topLevel(svg, 'nodes');
  const edgeFragments = topLevel(svg, 'edges');

  // Same ordering generatePureSVG used: parents first.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sorted = [...nodes].sort((a, b) => nodeDepth(a as never, byId as never) - nodeDepth(b as never, byId as never));
  if (sorted.length !== nodeFragments.length) throw new Error(`${name}: ${sorted.length} nodes but ${nodeFragments.length} fragments`);

  const prepared = nodes.map((n) => {
    const isGroup = n.type === 'groupNode' || n.type === 'group';
    const dims = isGroup
      ? { width: n.width ?? 300, height: n.height ?? 200 }
      : getEffectiveNodeDimensions(n as never, RENDER_STYLE, 'all' as never);
    return { ...n, width: dims.width, height: dims.height, position: resolveAbsolutePosition(n as never, byId as never) };
  });
  const bounds = calculateBounds(prepared as never);

  const outNodes = sorted.map((n, i) => {
    const abs = resolveAbsolutePosition(n as never, byId as never);
    const dims = prepared.find((p) => p.id === n.id)!;
    return {
      id: n.id,
      group: n.type === 'groupNode' || n.type === 'group',
      x: abs.x - bounds.minX,
      y: abs.y - bounds.minY,
      w: dims.width,
      h: dims.height,
      label: (n.data as { label?: string }).label ?? '',
      // The fragment is `<g transform="translate(x, y)">…</g>`; keep the inside.
      inner: nodeFragments[i].replace(/^<g transform="[^"]*">/, '').replace(/<\/g>\s*$/, ''),
    };
  });

  // Edges: a line, its arrowhead and an optional label, in that order.
  const outEdges: Array<Record<string, unknown>> = [];
  for (const frag of edgeFragments) {
    if (frag.startsWith('<path') && !frag.includes('data-edge-marker')) {
      outEdges.push({
        d: attr(frag, 'd'),
        stroke: attr(frag, 'stroke'),
        width: Number(attr(frag, 'stroke-width') ?? 1.5),
        dash: attr(frag, 'stroke-dasharray') ?? null,
        glow: /filter:\s*([^;"]*)/.exec(frag)?.[1]?.trim() ?? null,
      });
    } else if (frag.includes('data-edge-marker')) {
      Object.assign(outEdges[outEdges.length - 1], { markerD: attr(frag, 'd'), markerFill: attr(frag, 'fill') });
    } else if (frag.startsWith('<g')) {
      Object.assign(outEdges[outEdges.length - 1], { labelSvg: frag });
    }
  }
  // Edge ids in render order, so scenes can address an edge by its ends.
  const ends = edges.map((e) => `${e.source}>${e.target}`);
  outEdges.forEach((e, i) => { e.id = ends[i] ?? `e${i}`; });

  // The share/PNG exporter aims each arrowhead at a point 98% along the path,
  // which skews it on bent edges and leaves a gap before the node. Re-aim every
  // head along the edge's final segment and land its tip on the node's border.
  const nodeRect = new Map(outNodes.map((n) => [n.id, n]));
  outEdges.forEach((e) => {
    const target = nodeRect.get(String(e.id).split('>')[1]);
    const d = String(e.d);
    const pairs = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    if (!target || pairs.length < 2 || !e.markerD) return;
    const end = pairs[pairs.length - 1];
    const prev = pairs[pairs.length - 2];
    const dx = end.x - prev.x;
    const dy = end.y - prev.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const tip = horizontal
      ? { x: dx >= 0 ? target.x + 2 : target.x + target.w - 2, y: end.y }
      : { x: end.x, y: dy >= 0 ? target.y + 2 : target.y + target.h - 2 };
    const angle = horizontal ? (dx >= 0 ? 0 : Math.PI) : dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
    e.d = d.replace(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/, `${tip.x},${tip.y}`);
    e.markerD = buildSolidArrowheadPath(tip, angle);
  });

  console.log(name, outNodes.length, 'nodes', outEdges.length, 'edges');
  return { defs, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, nodes: outNodes, edges: outEdges };
}

async function main() {
  const g = await buildHeroGraphs();
  const tokens = resolveCanvasTokens({ renderStyleId: RENDER_STYLE, colorThemeId: THEME, isDark: DARK }).cssVars;
  const out = {
    tokens: { bg: tokens['--arch-canvas-bg'], grid: tokens['--arch-canvas-grid'] },
    live: await exportGraph('live', g.base),
    liveMapped: await exportGraph('liveMapped', g.mapped),
  };
  const dir = join(process.cwd(), '..', 'video', 'src', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'diagrams.json'), JSON.stringify(out));
}
main().catch((e) => { console.error(e); process.exit(1); });
