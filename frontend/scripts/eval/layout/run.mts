/** Reproducible diagram gallery: npx tsx scripts/eval/layout/run.mts [output-directory] [template-id] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEMPLATES } from '../../../data/templates';
import { layoutDiagramViaMermaid } from '../../../lib/diagram/mermaid/relayout';
import { computeDiagramGeometryPlan } from '../../../lib/diagram/geometry/diagramGeometry';
import { measureLayoutAesthetics } from '../../../lib/diagram/pipeline-shared/layout/layoutAesthetics';
import { generatePureSVG } from '../../../lib/diagram/export/svgExport';

const output = resolve(process.argv[2] ?? '/tmp/archdraw-layout-audit');
mkdirSync(output, { recursive: true });
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const results = [];
const panels: string[] = [];
for (const template of TEMPLATES.filter(t => !process.argv[3] || process.argv[3].split(',').includes(t.id))) {
  for (const direction of ['LR', 'TD'] as const) {
    const start = performance.now();
    const result = await layoutDiagramViaMermaid(template.nodes, template.edges, direction, { renderStyleId: 'studio-minimal', foldLongFlows: true });
    const geometry = computeDiagramGeometryPlan(result.nodes, result.edges, { direction, renderStyleId: 'studio-minimal', straightEdges: false });
    const aesthetics = measureLayoutAesthetics(result.nodes, result.edges, direction);
    const metrics = { id: template.id, direction, ms: Math.round(performance.now() - start), ...geometry.quality, titlePxAtFit: aesthetics.titlePxAtFit };
    results.push(metrics);
    console.log(JSON.stringify(metrics));
    const filename = `${template.id}-${direction}.svg`;
    writeFileSync(resolve(output, filename), generatePureSVG(result.nodes, result.edges, false, '#ffffff', direction, 'studio-minimal', 'studio-minimal'));
    panels.push(`<section><h2>${escape(template.name)} · ${direction}</h2><p>${escape(JSON.stringify(metrics))}</p><object data="${filename}" type="image/svg+xml"></object><p>Review: identify entry point; trace request to storage; explain branches and feedback.</p></section>`);
  }
}
writeFileSync(resolve(output, 'metrics.json'), JSON.stringify(results, null, 2));
writeFileSync(resolve(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>ArchDraw layout audit</title><style>body{font:14px system-ui;margin:24px;background:#eee}section{margin-bottom:48px}object{width:1280px;height:720px;background:white}p{max-width:1280px}</style><h1>Layout audit · 1280 × 720</h1>${panels.join('')}`);
console.log(`Wrote ${results.length} diagrams and metrics to ${output}`);
