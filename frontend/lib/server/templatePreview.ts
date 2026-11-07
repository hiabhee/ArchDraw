import type { Template } from '@/data/templates/index';
import { layoutDiagramViaMermaid } from '@/lib/diagram/mermaid/relayout';
import { renderDiagramSvg, type ImageTheme } from '@/lib/server/diagramImage';

/**
 * A built-in template drawn for the public gallery: laid out exactly as the editor does when it
 * opens `?template=<id>` (canonical Mermaid → Dagre layout, LR) and drawn by the editor's SVG
 * export in the Studio style. Memoised per process; pages and the image route are static.
 */
const cache = new Map<string, Promise<string>>();

export function templatePreviewSvg(template: Template, theme: ImageTheme): Promise<string> {
  const key = `${template.id}:${theme}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      const layouted = await layoutDiagramViaMermaid(template.nodes, template.edges, 'LR', { title: template.name });
      const nodes = layouted.success ? layouted.nodes : template.nodes;
      const edges = layouted.success ? layouted.edges : template.edges;
      return renderDiagramSvg(nodes, edges, { style: 'studio', theme, grid: false });
    })();
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return pending;
}

/** The SVG's intrinsic size (its `width`/`height`), so `<img>` reserves space and avoids layout shift. */
export function svgSize(svg: string): { width: number; height: number } | null {
  const head = svg.slice(0, 600);
  const w = /\bwidth="([\d.]+)"/.exec(head);
  const h = /\bheight="([\d.]+)"/.exec(head);
  if (!w || !h) return null;
  return { width: Math.round(Number(w[1])), height: Math.round(Number(h[1])) };
}
