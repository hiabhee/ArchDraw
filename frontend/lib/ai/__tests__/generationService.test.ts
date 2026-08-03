import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateDiagramFromRepo, GenerationServiceError } from '../generationService';
import type { GenerationProgress } from '@/lib/ai/types';

const NDJSON = [
  JSON.stringify({ id: 'svc', label: 'Service', layer: 'application', x: 0, y: 0, width: 180, height: 80, icon: 'box', serviceType: 'api' }),
  JSON.stringify({ path: ['svc', 'db'], label: 'queries', async: false }),
  JSON.stringify({ id: 'db', label: 'Database', layer: 'data', x: 0, y: 200, width: 180, height: 80, icon: 'database', serviceType: 'database' }),
].join('\n');

const RESULT_PAYLOAD = {
  success: true,
  ndjson: NDJSON,
  nodeCount: 2,
  edgeCount: 1,
  workflowCount: 0,
  workflows: [],
  repoMeta: {},
  repoProfile: { repoType: 'backend_only' },
  dependencyMap: [],
  reviewNotes: '',
  confidence: 'high',
};

function sseResponse(frames: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateDiagramFromRepo', () => {
  it('parses the SSE stream and returns nodes/edges', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        `data: ${JSON.stringify({ type: 'progress', message: 'Analyzing...', progress: 20 })}\n\n`,
        `data: ${JSON.stringify({ type: 'result', payload: RESULT_PAYLOAD })}\n\n`,
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const progress: GenerationProgress[] = [];
    const result = await generateDiagramFromRepo('https://github.com/owner/repo', 2, (p) => progress.push(p));

    expect(fetchMock).toHaveBeenCalledWith('/api/repo-diagram', expect.objectContaining({ method: 'POST' }));
    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(1);
    expect(result.nodes.length).toBe(2);
    expect(result.edges.length).toBe(1);
    expect(progress.at(-1)?.message).toBe('Analyzing...');
  });

  it('throws a GenerationServiceError on an error event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([`data: ${JSON.stringify({ type: 'error', message: 'Rate limited' })}\n\n`]),
      ),
    );

    await expect(generateDiagramFromRepo('https://github.com/owner/repo', 2)).rejects.toMatchObject({
      name: 'GenerationServiceError',
      code: 'repo_ingest_failed',
    });
  });

  it('throws a GenerationServiceError when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid GitHub URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(generateDiagramFromRepo('not-a-url', 2)).rejects.toThrow('Invalid GitHub URL');
  });
});
