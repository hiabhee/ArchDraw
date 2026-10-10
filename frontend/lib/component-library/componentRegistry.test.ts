import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from 'reactflow';

const { fetchByIds, fetchAll } = vi.hoisted(() => ({
  fetchByIds: vi.fn(),
  fetchAll: vi.fn(),
}));

vi.mock('@/lib/client/api-client', () => ({
  fetchComponentTemplatesByIds: fetchByIds,
  fetchAllComponentTemplates: fetchAll,
}));

import { componentRegistry } from './componentRegistry';

describe('componentRegistry browser synchronization', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', '');
    fetchByIds.mockReset().mockResolvedValue([]);
    fetchAll.mockReset().mockResolvedValue([]);
  });

  it('loads missing templates through the API without exposing DATABASE_URL to the client', async () => {
    const node = { id: 'node-1', data: { typeId: 'custom-template' } } as Node;

    await componentRegistry.ensureCustomComponentsForNodes([node]);

    expect(fetchByIds).toHaveBeenCalledWith(['custom-template']);
  });

  it('refreshes templates through the API without exposing DATABASE_URL to the client', async () => {
    await componentRegistry.backgroundRefresh();

    expect(fetchAll).toHaveBeenCalledOnce();
  });
});
