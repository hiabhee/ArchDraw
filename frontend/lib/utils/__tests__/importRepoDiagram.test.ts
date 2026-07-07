import { describe, it, expect } from 'vitest';
import { parseAndValidateRepoDiagram } from '../importRepoDiagram';

describe('parseAndValidateRepoDiagram', () => {
  it('returns null for empty NDJSON', () => {
    expect(parseAndValidateRepoDiagram('')).toBeNull();
  });

  it('returns null for NDJSON with only edges', () => {
    const ndjson = JSON.stringify({ path: ['a', 'b'], label: 'connects', async: false });
    expect(parseAndValidateRepoDiagram(ndjson)).toBeNull();
  });

  it('parses valid NDJSON with nodes', () => {
    const ndjson = [
      JSON.stringify({ id: 'svc', label: 'Service', layer: 'application', x: 0, y: 0, width: 180, height: 80, icon: 'box', serviceType: 'api' }),
      JSON.stringify({ path: ['svc', 'db'], label: 'queries', async: false }),
      JSON.stringify({ id: 'db', label: 'Database', layer: 'data', x: 0, y: 200, width: 180, height: 80, icon: 'database', serviceType: 'database' }),
    ].join('\n');

    const result = parseAndValidateRepoDiagram(ndjson);
    expect(result).not.toBeNull();
    expect(result!.nodeCount).toBe(2);
    expect(result!.edgeCount).toBe(1);
  });
});
