import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { relayoutInWorker } from '../relayoutWorkerClient';

class LayoutWorker extends EventTarget {
  static last: LayoutWorker;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    super();
    LayoutWorker.last = this;
  }
}

const graph = [
  { id: 'client', type: 'shapeNode', data: { label: 'Client' }, position: { x: 0, y: 0 } },
];

beforeEach(() => vi.stubGlobal('Worker', LayoutWorker));
afterEach(() => vi.unstubAllGlobals());

it('returns the worker result and releases the worker', async () => {
  const request = relayoutInWorker([graph, [], 'LR'], new AbortController().signal);
  const worker = LayoutWorker.last;
  expect(worker.postMessage).toHaveBeenCalledWith([graph, [], 'LR']);
  worker.dispatchEvent(new MessageEvent('message', { data: { ready: true } }));
  const result = { success: true, nodes: graph, edges: [], warnings: [] };
  worker.dispatchEvent(new MessageEvent('message', { data: { result } }));

  await expect(request).resolves.toEqual(result);
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it('terminates an aborted job without starting fallback layout', async () => {
  const controller = new AbortController();
  const request = relayoutInWorker([graph, [], 'TD'], controller.signal);
  const worker = LayoutWorker.last;
  controller.abort();

  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  expect(worker.terminate).toHaveBeenCalledOnce();
});
