import { describe, expect, it } from 'vitest';
import { mergeCanvases } from '../canvasHelpers';
import type { CanvasTab } from '../../types';

const tab = (overrides: Partial<CanvasTab>): CanvasTab => ({ id: 'c1', name: 'A', nodes: [], edges: [], ...overrides });

describe('mergeCanvases', () => {
  it('keeps the server-owned project link when the local copy is newer', () => {
    const [merged] = mergeCanvases(
      [tab({ name: 'local', updatedAt: 200, agenticProjectId: null })],
      [tab({ name: 'db', updatedAt: 100, agenticProjectId: 'proj-1' })],
    );
    expect(merged.name).toBe('local');
    expect(merged.agenticProjectId).toBe('proj-1');
  });

  it('uses the DB copy (and its link) when it is newer', () => {
    const [merged] = mergeCanvases(
      [tab({ name: 'local', updatedAt: 100, agenticProjectId: 'stale' })],
      [tab({ name: 'db', updatedAt: 200, agenticProjectId: null })],
    );
    expect(merged.name).toBe('db');
    expect(merged.agenticProjectId).toBeNull();
  });
});
