import { runCompactMermaidPipeline, runMermaidPipeline } from '../mermaid/pipeline';

export { prepareMcpResult } from './recoverMcpLayout';

export function runMcpMermaidPipeline(mermaid: string, autoDirection: boolean, foldLongFlows?: boolean) {
  const run = autoDirection ? runCompactMermaidPipeline : runMermaidPipeline;
  return run(mermaid, {
    layoutProfile: 'studio-minimal',
    layoutStyle: 'auto',
    iconMode: 'all',
    areaOrder: 'flow',
    renderStyleId: 'studio-minimal',
    separateSharedStrokes: true,
    fitPreviewLabels: true,
    foldLongFlows,
  });
}
