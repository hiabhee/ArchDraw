import type {
  TutorialDefinition,
  TutorialLevel,
  TutorialStep,
  ValidationRule,
  PhaseContent,
  PhaseName,
} from './schema';
import { resolveComponentTooltip } from './componentTooltipResolver';
import logger from '@/lib/logger';

// ── Validation Rule Shortcuts ──────────────────────────────────────────────

export function node(nodeType: string, label?: string): ValidationRule {
  return { type: 'node_exists', nodeType, label };
}

export function edge(source: string, target: string): ValidationRule {
  return { type: 'edge_exists', source, target };
}

export function allOf(...rules: ValidationRule[]): ValidationRule {
  return { type: 'all_of', rules };
}

export function anyOf(...rules: ValidationRule[]): ValidationRule {
  return { type: 'any_of', rules };
}

// ── Step Builder ───────────────────────────────────────────────────────────

interface StepConfig {
  /** Component name as shown to the user (e.g. "API Gateway", "CDN") */
  component: string;

  /** Component type/nodeType for validation (e.g. "api_gateway", "cdn"). Falls back to camelCase of component. */
  nodeType?: string;

  /** Parent component label to connect FROM. Use `parents` for multiple. */
  parent?: string;

  /** Multiple parent components to connect FROM. */
  parents?: string[];

  /** Override individual phase content */
  phases?: {
    context?: PhaseContent;
    intro?: PhaseContent;
    teaching?: PhaseContent;
    action?: PhaseContent;
    connecting?: PhaseContent;
    celebration?: PhaseContent;
  };

  /** Override validation rules. Auto-generated from node/edge rules if omitted. */
  validation?: ValidationRule[];

  /** Override hints. Auto-generated if omitted. */
  hints?: string[];

  /** Override step ID. Auto-generated if omitted. */
  id?: string;

  /** Override step title. Defaults to "Add {component}" */
  title?: string;

  /** Skip auto-generating edge rules (e.g. for first step) */
  noConnect?: boolean;

  /**
   * Extra registry IDs that also satisfy this step.
   * Use when several components represent the same role.
   * e.g. aliases: ['app_cache'] when nodeType is 'in_memory_cache'
   */
  aliases?: string[];

  /**
   * Milliseconds before "Continue anyway" appears.
   * Defaults to 20s. Set lower for simple steps, higher for complex connections.
   */
  continueAfterMs?: number;
}

function toSnakeCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.toLowerCase())
    .join('_');
}

function connectorWord(parents: string[]): string {
  if (parents.length === 1) return parents[0];
  if (parents.length === 2) return `${parents[0]} and ${parents[1]}`;
  return parents.slice(0, -1).join(', ') + ', and ' + parents[parents.length - 1];
}

/**
 * Auto-populate teaching `whyItMatters` / `tradeoff` from the shared component
 * tooltips when the author didn't write their own. Keeps the pedagogy floor
 * high without forcing authors to duplicate tooltip content.
 */
function enrichTeaching(component: string, base: PhaseContent): PhaseContent {
  const enriched = resolveComponentTooltip(component);
  return {
    ...base,
    whyItMatters: base.whyItMatters ?? enriched.whyItMatters,
    tradeoff: base.tradeoff ?? enriched.tradeoff,
  };
}

export function step(config: StepConfig): TutorialStep {
  const component = config.component;
  const nodeType = config.nodeType ?? toSnakeCase(component);
  const parents = config.parents ?? (config.parent ? [config.parent] : []);
  const autoConnect = !config.noConnect && parents.length > 0;
  const stepTitle = config.title ?? `Add ${component}`;

  // ── Context ────────────────────────────────────────────────────────────
  const context = config.phases?.context ?? {
    heading: parents.length === 0 ? component : `Adding ${component}`,
    body:
      parents.length === 0
        ? `${component} is the entry point for this architecture.`
        : `${component} connects from ${connectorWord(parents)} in this architecture.`,
  };

  // ── Intro ──────────────────────────────────────────────────────────────
  const intro = config.phases?.intro ?? {
    heading: `Do you know about ${component}s?`,
    body: `${component} is a key building block in distributed systems.`,
  };

  // ── Teaching ───────────────────────────────────────────────────────────
  const teaching = enrichTeaching(component, config.phases?.teaching ?? (() => {
    if (process.env.NODE_ENV === 'development') {
      logger.warn(
        `[Tutorial builder] step "${component}" has no teaching content. ` +
        `Add phases.teaching with body, whyItMatters, and tradeoff. ` +
        `Empty teaching defeats the purpose of the tutorial.`
      );
    }
    return {
      heading: `About ${component}`,
      body: `${component} is part of this architecture. Add teaching content to explain why.`,
    };
  })());

  // ── Action ─────────────────────────────────────────────────────────────
  const action = config.phases?.action ?? {
    heading: 'Your turn!',
    body: `Press \u2318K, search for '${component}', and add it to the canvas.`,
  };

  // ── Connecting ─────────────────────────────────────────────────────────
  const connecting = config.phases?.connecting ?? {
    heading: 'Connect it up',
    body: autoConnect
      ? parents.length === 1
        ? `Connect ${parents[0]} \u2192 ${component}.`
        : `Connect ${connectorWord(parents)} \u2192 ${component}.`
      : 'This is the first step, so no connections needed yet.',
  };

  // ── Celebration ────────────────────────────────────────────────────────
  const celebration = config.phases?.celebration ?? {
    heading: 'Great job!',
    body: `${component} added${autoConnect ? ' and connected' : ''}.`,
  };

  // ── Validation ─────────────────────────────────────────────────────────
  const baseNodeRule: ValidationRule = { type: 'node_exists', nodeType, label: component };
  const nodeRule: ValidationRule = config.aliases?.length
    ? { type: 'any_of', rules: [baseNodeRule, ...config.aliases.map(a => ({ type: 'node_exists' as const, nodeType: a }))] }
    : baseNodeRule;

  const validation: ValidationRule[] = config.validation ?? (() => {
    if (!autoConnect) {
      return [nodeRule];
    }
    const rules: ValidationRule[] = [nodeRule];
    for (const p of parents) {
      rules.push(edge(toSnakeCase(p), nodeType));
    }
    return [allOf(...rules)];
  })();

  // ── Hints ──────────────────────────────────────────────────────────────
  const hints: string[] = config.hints ?? (() => {
    const h = [`Search for "${component}"`];
    if (autoConnect) {
      h.push(
        parents.length === 1
          ? `Connect ${parents[0]} to it`
          : `Connect ${connectorWord(parents)} to it`
      );
    }
    return h;
  })();

  const skipPhases: PhaseName[] = [];
  if (!autoConnect) {
    skipPhases.push('connecting');
  }

  // Longer patience for connection steps (user has to draw an edge), shorter
  // for simple add-a-node steps. Authors can still override per step.
  const continueAfterMs =
    config.continueAfterMs ?? (autoConnect ? 45000 : 15000);

  return {
    id: config.id ?? `step-${nodeType}`,
    title: stepTitle,
    component,
    ...(autoConnect ? { connectsFrom: parents } : {}),
    phases: { context, intro, teaching, action, connecting, celebration },
    validation,
    hints,
    skipPhases,
    continueAfterMs,
  };
}

// ── Level Builder ──────────────────────────────────────────────────────────

interface LevelConfig {
  /** Level title (e.g. "The Foundation", "Production Ready") */
  title: string;

  /** Level description shown in the intro card and level-complete screen */
  description?: string;

  /** Steps in this level */
  steps: TutorialStep[];

  /** Override level ID. Auto-generated from title if omitted. */
  id?: string;
}

export function level(config: LevelConfig): TutorialLevel {
  const slug = config.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    id: config.id ?? `level-${slug}`,
    title: config.title,
    description: config.description,
    steps: config.steps,
  };
}

// ── Tutorial Builder ───────────────────────────────────────────────────────

interface TutorialConfig {
  /** Unique tutorial ID (e.g. "chatgpt-architecture") */
  id: string;

  /** Display title */
  title: string;

  /** Short description for cards */
  description: string;

  /** Difficulty: 'beginner' | 'intermediate' | 'advanced' */
  difficulty: 'beginner' | 'intermediate' | 'advanced';

  /** Estimated completion time in minutes */
  estimatedMinutes: number;

  /** Tags for search/discovery */
  tags: string[];

  /** Lucide icon name */
  icon: string;

  /** Hex color for the tutorial card */
  color: string;

  /** Levels containing steps */
  levels: TutorialLevel[];

  /** Optional category */
  category?: string;

  /** Funnel position for the catalog "Start here" section (1, 2, 3, …). */
  recommendedOrder?: number;
}

/** The component types a step's node rule accepts: its node type plus any aliases. */
function acceptedTypes(rules: ValidationRule[]): string[] {
  for (const rule of rules) {
    if (rule.type === 'node_exists' || rule.type === 'node_count') return [rule.nodeType];
    if (rule.type === 'any_of' && rule.rules.every((r) => r.type === 'node_exists')) {
      return rule.rules.map((r) => (r as { nodeType: string }).nodeType);
    }
    if (rule.type === 'all_of') {
      const inner = acceptedTypes(rule.rules);
      if (inner.length) return inner;
    }
  }
  return [];
}

/**
 * Connections name their parent by its title (`edge('mobile_client', 'cdn')`), but the
 * node a learner adds from search carries the registry's type and label (`client_mobile`,
 * "Mobile"), so a correct connection never matched and the step only moved on through
 * "Continue anyway". Each such rule also accepts the types the parent step and this step
 * add. Name matches still count, so nothing that passed before stops passing.
 */
function resolveConnectionTypes(levels: TutorialLevel[]): TutorialLevel[] {
  const typesByComponent = new Map<string, string[]>();
  const withTypes = (rule: ValidationRule, parents: Map<string, string[]>, own: string[]): ValidationRule => {
    if (rule.type === 'all_of' || rule.type === 'any_of') {
      return { ...rule, rules: rule.rules.map((r) => withTypes(r, parents, own)) };
    }
    if (rule.type !== 'edge_exists') return rule;
    const sourceTypes = parents.get(rule.source);
    return {
      ...rule,
      ...(sourceTypes?.length && !rule.sourceTypes ? { sourceTypes } : {}),
      ...(own.length && !rule.targetTypes ? { targetTypes: own } : {}),
    };
  };
  return levels.map((level) => ({
    ...level,
    steps: level.steps.map((s) => {
      const own = acceptedTypes(s.validation);
      const parents = new Map(
        (s.connectsFrom ?? []).flatMap((p) => {
          const types = typesByComponent.get(p);
          return types ? [[toSnakeCase(p), types] as const] : [];
        }),
      );
      if (s.component) typesByComponent.set(s.component, own);
      return parents.size ? { ...s, validation: s.validation.map((r) => withTypes(r, parents, own)) } : s;
    }),
  }));
}

/**
 * Step ids default to `step-<nodeType>`, so two steps that add the same type (two
 * microservices) shared an id and progress counted them as one. Later repeats get a
 * numeric suffix; the first keeps its id, so saved progress still lines up.
 */
function uniqueStepIds(levels: TutorialLevel[]): TutorialLevel[] {
  const seen = new Map<string, number>();
  return levels.map((level) => ({
    ...level,
    steps: level.steps.map((s) => {
      const count = (seen.get(s.id) ?? 0) + 1;
      seen.set(s.id, count);
      return count === 1 ? s : { ...s, id: `${s.id}-${count}` };
    }),
  }));
}

export function defineTutorial(config: TutorialConfig): TutorialDefinition {
  return {
    id: config.id,
    title: config.title,
    description: config.description,
    difficulty: config.difficulty,
    estimatedMinutes: config.estimatedMinutes,
    levels: uniqueStepIds(resolveConnectionTypes(config.levels)),
    tags: config.tags,
    icon: config.icon,
    color: config.color,
    category: config.category,
    recommendedOrder: config.recommendedOrder,
  };
}
