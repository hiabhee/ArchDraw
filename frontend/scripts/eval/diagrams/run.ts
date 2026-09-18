/** Offline fixtures by default. --live --models model-a,model-b compares real model output. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { diagramCorpus } from './corpus';
import { evaluateDiagram } from './score';

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const arg = (name: string) => args[args.indexOf(name) + 1];
  const models = args.includes('--models') ? arg('--models').split(',') : ['default'];
  const out = resolve(args.includes('--out') ? arg('--out') : 'eval-results/diagrams.json');
  if (live) {
    const { config } = await import('dotenv');
    config({ path: '.env.local', quiet: true });
  }
  const { runMermaidPipeline } = await import('../../../lib/mermaid/pipeline');
  const { runAiMermaidPipelineV2 } = await import('../../../lib/ai/pipeline/mermaid-pipeline/pipeline-v2');
  const rows = [];
  for (const model of live ? models : ['fixture']) for (const test of diagramCorpus) {
    const start = performance.now();
    const result = live ? await runAiMermaidPipelineV2({ description: test.prompt, systemType: 'architecture', complexity: 'medium', diagramSize: test.existingContext ? 'large' : 'medium', detailLevel: test.existingContext ? 3 : 2, model: model === 'default' ? undefined : model, existingContext: test.existingContext }) : await runMermaidPipeline(test.mermaid);
    if (!result.success) { rows.push({ id: test.id, model, passed: false, error: String(result.error) }); continue; }
    rows.push({ id: test.id, model, durationMs: Math.round(performance.now() - start), ...evaluateDiagram(test, result.data.nodes as import('../../../lib/mermaid/types').RFNode[], result.data.edges as import('../../../lib/mermaid/types').RFEdge[]) });
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ mode: live ? 'live' : 'fixtures', createdAt: new Date().toISOString(), rows }, null, 2));
  console.table(rows.map(row => ({ case: row.id, model: row.model, passed: row.passed, ...('componentCoverage' in row ? { components: row.componentCoverage, relationships: row.relationshipCoverage } : {}) })));
  console.log(`Report: ${out}`);
  if (rows.some(row => !row.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
