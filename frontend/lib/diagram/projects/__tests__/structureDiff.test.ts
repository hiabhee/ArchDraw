import { describe, expect, it } from 'vitest';
import { diffStructure, isEmptyChange, parseStructureChange, summarizeChange } from '../structureDiff';

const n = (id: string, label?: string, type = 'shapeNode') => ({ id, type, data: label ? { label } : {} });

describe('diffStructure', () => {
  it('reports added, removed and renamed components by id', () => {
    const change = diffStructure(
      [n('api', 'API'), n('worker', 'Worker'), n('title', 'Title', 'textLabelNode')],
      [n('api', 'Gateway'), n('queue', 'Queue'), n('title2', 'Other', 'textLabelNode')],
      5,
    );
    expect(change).toEqual({
      added: [{ id: 'queue', label: 'Queue' }],
      removed: [{ id: 'worker', label: 'Worker' }],
      renamed: [{ id: 'api', from: 'API', to: 'Gateway' }],
      at: 5,
    });
    expect(isEmptyChange(change)).toBe(false);
  });

  it('is empty when only layout changed', () => {
    expect(isEmptyChange(diffStructure([n('a', 'A')], [n('a', 'A')], 1))).toBe(true);
  });

  it('falls back to the id when a label is missing', () => {
    expect(diffStructure([], [n('svc')], 1).added).toEqual([{ id: 'svc', label: 'svc' }]);
  });
});

describe('summarizeChange', () => {
  it('summarizes and truncates', () => {
    const change = diffStructure([n('w', 'Worker')], [n('a', 'A'), n('b', 'B'), n('c', 'C'), n('d', 'D')], 1);
    expect(summarizeChange(change)).toBe('Added A, B, C +1 · removed Worker');
    expect(summarizeChange(diffStructure([], [], 1))).toBe('No structural changes');
  });
});

describe('parseStructureChange', () => {
  it('rejects malformed values', () => {
    expect(parseStructureChange(null)).toBeNull();
    expect(parseStructureChange({ added: [] })).toBeNull();
    expect(parseStructureChange({ added: [], removed: [], renamed: [], at: 1 })).not.toBeNull();
  });
});
