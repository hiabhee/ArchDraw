import { layoutDiagramViaMermaid } from './relayout';

self.addEventListener('message', async (event: MessageEvent<Parameters<typeof layoutDiagramViaMermaid>>) => {
  const result = await layoutDiagramViaMermaid(...event.data);
  self.postMessage({ result });
});

// Some browsers suppress import errors in workers. Signal when imports loaded.
self.postMessage({ ready: true });
