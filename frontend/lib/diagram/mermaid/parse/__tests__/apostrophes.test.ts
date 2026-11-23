import { describe, expect, it } from 'vitest';
import { parseMermaid } from '../index';
import { mergeMultilineLabels } from '../labelText';

describe('unquoted label apostrophes', () => {
  it('preserves subsequent relationships and comments after possessives and contractions', () => {
    const result = parseMermaid(`flowchart TB
      a -->|one company's details| b
      b -->|users' preferences| c %% ordinary comment
      c -->|don't retry| d
      d -->|write rows; retain history| e`);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.ast.edges.map(edge => [edge.source, edge.target])).toEqual([
      ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'],
    ]);
  });

  it('still joins explicitly quoted multiline labels', () => {
    expect(mergeMultilineLabels("a['first\nsecond']\nb --> c")).toBe("a['first\\nsecond']\nb --> c");
  });
});
