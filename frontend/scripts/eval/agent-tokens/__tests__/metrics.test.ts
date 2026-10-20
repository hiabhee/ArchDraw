import { describe, expect, it } from 'vitest';
import { classifyTool, median, parseRun, relativeChange, summarizeArm, weighUsage } from '../metrics';

const assistant = (id: string, usage: object, content: object[] = []) =>
  JSON.stringify({ type: 'assistant', message: { id, usage, content } });
const tool = (name: string, input: object) => ({ type: 'tool_use', name, input });

describe('classifyTool', () => {
  it('sorts shell commands by what they do', () => {
    expect(classifyTool(tool('Bash', { command: 'cd frontend && rg foo' }) as never)).toBe('locate');
    expect(classifyTool(tool('Bash', { command: 'sed -n 1,20p a.ts' }) as never)).toBe('read');
    expect(classifyTool(tool('Bash', { command: 'node "/x/archdraw-project.mjs" map' }) as never)).toBe('map');
    expect(classifyTool(tool('Bash', { command: 'npx vitest --run' }) as never)).toBe('bash');
    expect(classifyTool(tool('Glob', {}) as never)).toBe('locate');
  });
});

describe('parseRun', () => {
  it('counts each API response once and finds the first call that touches a target', () => {
    const lines = [
      assistant('m1', { input_tokens: 10, cache_read_input_tokens: 1000, output_tokens: 2 }, [tool('Grep', { pattern: 'x' })]),
      assistant('m1', { input_tokens: 10, cache_read_input_tokens: 1000, output_tokens: 2 }, [tool('Glob', { pattern: '**/*.ts' })]),
      assistant('m2', { cache_creation_input_tokens: 100, output_tokens: 4 }, [tool('Read', { file_path: '/wt/src/pathMatcher.ts' })]),
      JSON.stringify({ type: 'assistant', parent_tool_use_id: 't1', message: { id: 's1', usage: { input_tokens: 999 } } }),
      JSON.stringify({ type: 'system', subtype: 'hook_response', output: JSON.stringify({ hookSpecificOutput: { additionalContext: 'map!' } }) }),
      JSON.stringify({ type: 'system', subtype: 'hook_started', output: '' }),
      JSON.stringify({ type: 'result', subtype: 'success', total_cost_usd: 0.12, duration_ms: 900, result: 'pathMatcher.ts' }),
      'not json',
    ];
    const m = parseRun(lines, [/pathMatcher\.ts/]);
    expect(m.apiCalls).toBe(2);
    expect(m.tools.locate).toBe(2);
    expect(m.tools.read).toBe(1);
    expect(m.callsBeforeTarget).toBe(1);
    expect(m.weightedTokens).toBeCloseTo(10 + 100 + 10 + 125 + 20);
    expect(m.costUsd).toBe(0.12);
    expect(m.finalText).toBe('pathMatcher.ts');
    expect(m.isError).toBe(false);
    expect(m.hookContextChars).toBe(4);
  });

  it('charges a call that runs a map command to map upkeep', () => {
    const m = parseRun([assistant('m1', { output_tokens: 10 }, [tool('Bash', { command: 'node "a/archdraw-project.mjs" publish --mermaid x' })])]);
    expect(m.mapUpkeepTokens).toBe(50);
    expect(m.callsBeforeTarget).toBeNull();
  });
});

describe('summaries', () => {
  it('weighs usage by price', () => {
    expect(weighUsage({ input_tokens: 1, cache_creation_input_tokens: 4, cache_read_input_tokens: 10, output_tokens: 1 })).toBe(1 + 5 + 1 + 5);
  });

  it('takes medians and relative change', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(relativeChange(100, 80)).toBeCloseTo(-0.2);
    expect(relativeChange(0, 5)).toBeNull();
    const runs = [1, 2, 3].map((n) => ({ passed: n !== 2, metrics: { ...parseRun([]), costUsd: n / 10, apiCalls: n } }));
    expect(summarizeArm(runs)).toMatchObject({ runs: 3, passed: 2, medianCostUsd: 0.2, medianApiCalls: 2 });
  });
});
