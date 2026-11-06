/**
 * Token metrics for one headless Claude Code run (`claude -p --output-format
 * stream-json --verbose`), and the on/off comparison across runs. Pure: the
 * runner (`run.ts`) feeds it the saved stream lines.
 */

export type ToolKind = 'locate' | 'read' | 'edit' | 'bash' | 'map' | 'agent' | 'other';

export interface RunMetrics {
  /** API requests the agent made (one per assistant message id). */
  apiCalls: number;
  /** Price-weighted tokens: fresh input 1, cache write 1.25, cache read 0.1, output 5. */
  weightedTokens: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  /** From the final `result` event when Claude Code reports it. */
  costUsd: number | null;
  durationMs: number | null;
  tools: Record<ToolKind, number>;
  /** API calls made before the first tool call that touches a target path; null if none did. */
  callsBeforeTarget: number | null;
  /** Weighted tokens spent on calls that ran ArchDraw map commands (map / mermaid / publish / intent). */
  mapUpkeepTokens: number;
  /** Characters of hook-added context seen in the stream (0 when the stream has none). */
  hookContextChars: number;
  finalText: string;
  isError: boolean;
}

interface Usage {
  input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  output_tokens?: number;
}

interface ToolUse {
  type: 'tool_use';
  name: string;
  input?: Record<string, unknown>;
}

const LOCATE_COMMAND = /^\s*(rg|grep|find|ls|fd|git (grep|ls-files))\b/;
const READ_COMMAND = /^\s*(cat|sed -n|head|tail|less|bat)\b/;
const MAP_COMMAND = /archdraw-project\.mjs"?\s+(map|mermaid|publish|intent)\b/;

/** Drops a leading `cd dir &&` so `cd x && rg foo` counts as a search. */
function bashCommand(input: Record<string, unknown> | undefined): string {
  return String(input?.command ?? '').replace(/^\s*cd\s+[^;&|]+(&&|;)\s*/, '');
}

export function classifyTool(tool: ToolUse): ToolKind {
  switch (tool.name) {
    case 'Grep':
    case 'Glob':
      return 'locate';
    case 'Read':
      return 'read';
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'NotebookEdit':
      return 'edit';
    case 'Agent':
    case 'Task':
      return 'agent';
    case 'Bash': {
      const command = bashCommand(tool.input);
      if (MAP_COMMAND.test(command)) return 'map';
      if (LOCATE_COMMAND.test(command)) return 'locate';
      if (READ_COMMAND.test(command)) return 'read';
      return 'bash';
    }
    default:
      return 'other';
  }
}

export function weighUsage(usage: Usage): number {
  return (usage.input_tokens ?? 0)
    + 1.25 * (usage.cache_creation_input_tokens ?? 0)
    + 0.1 * (usage.cache_read_input_tokens ?? 0)
    + 5 * (usage.output_tokens ?? 0);
}

function touchesTarget(tool: ToolUse, targets: readonly RegExp[]): boolean {
  if (targets.length === 0) return false;
  const text = JSON.stringify(tool.input ?? {});
  return targets.some((target) => target.test(text));
}

/** Context a hook added for the model (`hook_response` events, with `--include-hook-events`). */
function hookContext(event: Record<string, unknown>): string {
  if (event.type !== 'system' || event.subtype !== 'hook_response' || typeof event.output !== 'string') return '';
  try {
    const context = JSON.parse(event.output)?.hookSpecificOutput?.additionalContext;
    return typeof context === 'string' ? context : '';
  } catch {
    return '';
  }
}

export function parseRun(lines: readonly string[], targets: readonly RegExp[] = []): RunMetrics {
  const metrics: RunMetrics = {
    apiCalls: 0,
    weightedTokens: 0,
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    costUsd: null,
    durationMs: null,
    tools: { locate: 0, read: 0, edit: 0, bash: 0, map: 0, agent: 0, other: 0 },
    callsBeforeTarget: null,
    mapUpkeepTokens: 0,
    hookContextChars: 0,
    finalText: '',
    isError: false,
  };
  // One API response can arrive as several assistant events (one per content block).
  const seen = new Set<string>();
  for (const line of lines) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    metrics.hookContextChars += hookContext(event).length;
    if (event.type === 'result') {
      metrics.costUsd = typeof event.total_cost_usd === 'number' ? event.total_cost_usd : null;
      metrics.durationMs = typeof event.duration_ms === 'number' ? event.duration_ms : null;
      metrics.finalText = typeof event.result === 'string' ? event.result : '';
      metrics.isError = event.is_error === true || (typeof event.subtype === 'string' && event.subtype !== 'success');
      continue;
    }
    if (event.type !== 'assistant' || (event as { parent_tool_use_id?: unknown }).parent_tool_use_id) continue;
    const message = event.message as { id?: string; usage?: Usage; content?: unknown } | undefined;
    if (!message) continue;
    const id = message.id ?? `${metrics.apiCalls}`;
    let weight = 0;
    if (!seen.has(id)) {
      seen.add(id);
      metrics.apiCalls += 1;
      const usage = message.usage ?? {};
      weight = weighUsage(usage);
      metrics.weightedTokens += weight;
      metrics.inputTokens += usage.input_tokens ?? 0;
      metrics.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
      metrics.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
      metrics.outputTokens += usage.output_tokens ?? 0;
    }
    const tools = (Array.isArray(message.content) ? message.content : []).filter(
      (block): block is ToolUse => (block as { type?: string })?.type === 'tool_use',
    );
    for (const tool of tools) {
      const kind = classifyTool(tool);
      metrics.tools[kind] += 1;
      if (kind === 'map') metrics.mapUpkeepTokens += weight;
      if (metrics.callsBeforeTarget === null && touchesTarget(tool, targets)) metrics.callsBeforeTarget = metrics.apiCalls - 1;
    }
  }
  return metrics;
}

export interface ArmSummary {
  runs: number;
  passed: number;
  medianWeightedTokens: number;
  medianCostUsd: number | null;
  medianApiCalls: number;
  medianCallsBeforeTarget: number | null;
  meanLocate: number;
  meanMapUpkeepTokens: number;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function summarizeArm(runs: readonly { metrics: RunMetrics; passed: boolean }[]): ArmSummary {
  const costs = runs.map((r) => r.metrics.costUsd).filter((c): c is number => c !== null);
  const reached = runs.map((r) => r.metrics.callsBeforeTarget).filter((c): c is number => c !== null);
  return {
    runs: runs.length,
    passed: runs.filter((r) => r.passed).length,
    medianWeightedTokens: median(runs.map((r) => r.metrics.weightedTokens)) ?? 0,
    medianCostUsd: median(costs),
    medianApiCalls: median(runs.map((r) => r.metrics.apiCalls)) ?? 0,
    medianCallsBeforeTarget: median(reached),
    meanLocate: mean(runs.map((r) => r.metrics.tools.locate)),
    meanMapUpkeepTokens: mean(runs.map((r) => r.metrics.mapUpkeepTokens)),
  };
}

/** Relative change from off to on: -0.2 means the map arm used 20% fewer. */
export function relativeChange(off: number | null, on: number | null): number | null {
  if (off === null || on === null || off === 0) return null;
  return (on - off) / off;
}
