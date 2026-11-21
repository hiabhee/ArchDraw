import type { layoutDiagramViaMermaid, RelayoutCanvasResult } from './relayout';

type LayoutArgs = Parameters<typeof layoutDiagramViaMermaid>;
type WorkerMessage = { ready: true } | { result: RelayoutCanvasResult };

export async function relayoutInWorker(args: LayoutArgs, signal: AbortSignal): Promise<RelayoutCanvasResult> {
  signal.throwIfAborted();
  if (typeof Worker !== 'undefined') {
    try {
      return await new Promise<RelayoutCanvasResult>((resolve, reject) => {
        const worker = new Worker(new URL('./relayout.worker.ts', import.meta.url), { type: 'module' });
        const finish = () => {
          clearTimeout(startup);
          signal.removeEventListener('abort', abort);
          worker.terminate();
        };
        const fail = () => {
          finish();
          reject(new Error('Layout worker unavailable'));
        };
        const abort = () => {
          finish();
          reject(signal.reason);
        };
        const startup = setTimeout(fail, 5_000);
        signal.addEventListener('abort', abort, { once: true });
        worker.addEventListener('error', fail);
        worker.addEventListener('messageerror', fail);
        worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
          if ('ready' in event.data) {
            clearTimeout(startup);
            return;
          }
          finish();
          resolve(event.data.result);
        });
        try {
          worker.postMessage(args);
        } catch {
          // Some saved diagrams carry values that cannot be cloned.
          fail();
        }
      });
    } catch {
      signal.throwIfAborted();
    }
  }
  const { layoutDiagramViaMermaid } = await import('./relayout');
  signal.throwIfAborted();
  return layoutDiagramViaMermaid(...args);
}
