import { z } from 'zod';
import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import logger from '@/lib/logger';
import type { IntentDecisions } from './jevApi';

/**
 * Models for the ArchitectureSpec design stage. Chosen from models the Groq
 * keys in this account actually serve (a previous global default,
 * `groq/compound-mini`, returned model_not_found against the raw Groq SDK
 * and has since been removed).
 * Override with JEV_SPEC_MODEL / JEV_SPEC_FALLBACK_MODEL.
 */
export const SPEC_GENERATION_MODEL = process.env.JEV_SPEC_MODEL ?? 'openai/gpt-oss-20b';
export const SPEC_GENERATION_FALLBACK = process.env.JEV_SPEC_FALLBACK_MODEL ?? 'openai/gpt-oss-120b';

function isModelUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /model.*(does not exist|not found)|model_not_found/i.test(message) || /invalid_request_error/i.test(message);
}

export const COMPONENT_KINDS = [
  'client',
  'api',
  'service',
  'database',
  'queue',
  'cache',
  'storage',
  'auth',
  'external',
] as const;

export const PROTOCOLS = ['HTTPS', 'gRPC', 'SQL', 'async'] as const;

const scaleSchema = z.enum(['prototype', 'small', 'medium', 'large']);
const availabilitySchema = z.enum(['standard', 'high']);
const sensitivitySchema = z.enum(['public', 'internal', 'sensitive']);

export const componentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(COMPONENT_KINDS),
  description: z.string(),
});

export const connectionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  protocol: z.enum(PROTOCOLS),
  label: z.string().optional(),
});

export const ArchitectureSpecSchema = z
  .object({
    title: z.string().min(1),
    assumptions: z.array(z.string()),
    requirements: z.object({
      scale: scaleSchema,
      availability: availabilitySchema,
      dataSensitivity: sensitivitySchema,
    }),
    components: z.array(componentSchema).min(1),
    connections: z.array(connectionSchema),
    decisions: z.array(
      z.object({
        decision: z.string(),
        rationale: z.string(),
        alternatives: z.array(z.string()),
      }),
    ),
    openQuestions: z.array(z.string()),
  })
  .superRefine((spec, ctx) => {
    const ids = new Set(spec.components.map((c) => c.id));
    spec.connections.forEach((connection, index) => {
      if (!ids.has(connection.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['connections', index, 'from'],
          message: `references unknown component id "${connection.from}"`,
        });
      }
      if (!ids.has(connection.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['connections', index, 'to'],
          message: `references unknown component id "${connection.to}"`,
        });
      }
    });
  });

export type ArchitectureSpec = z.infer<typeof ArchitectureSpecSchema>;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];
export type Protocol = (typeof PROTOCOLS)[number];

const GROUP_BY_KIND: Record<ComponentKind, string> = {
  client: 'Public',
  api: 'Application',
  service: 'Application',
  auth: 'Application',
  queue: 'Async',
  database: 'Data',
  cache: 'Data',
  storage: 'Data',
  external: 'External',
};

function safeId(raw: string, used: Set<string>): string {
  let id = raw.trim().replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^[0-9]/.test(id)) id = `n_${id}`;
  if (id.length === 0) id = 'node';
  let candidate = id;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${id}_${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function kindShape(kind: ComponentKind, name: string): string {
  switch (kind) {
    case 'database':
    case 'storage':
    case 'cache':
      return `[("${name}")]`;
    case 'queue':
      return `[/"${name}"/]`;
    case 'auth':
      return `{{"${name}"}}`;
    default:
      return `["${name}"]`;
  }
}

/** Deterministic ArchDrawDiagram from a validated spec. Rendering never hallucinates. */
export function specToMermaid(spec: ArchitectureSpec): string {
  const lines: string[] = ['graph LR', `%% ${spec.title.replace(/[\n\r]+/g, ' ')}`];
  const used = new Set<string>();
  const idByName = new Map<string, string>();

  for (const component of spec.components) {
    const id = safeId(component.id, used);
    idByName.set(component.id, id);
  }

  const groups = new Map<string, string[]>();
  for (const component of spec.components) {
    const nodeId = idByName.get(component.id);
    if (!nodeId) continue;
    const group = GROUP_BY_KIND[component.kind];
    const members = groups.get(group) ?? [];
    members.push(nodeId);
    groups.set(group, members);
  }

  const groupIds = new Map<string, string>();
  for (const group of groups.keys()) {
    const name = safeId(`group_${group}`, used);
    groupIds.set(group, name);
    lines.push(`  subgraph ${name}["${group}"]`);
    for (const member of groups.get(group) ?? []) {
      const component = spec.components.find((c) => (idByName.get(c.id) ?? '') === member);
      if (!component) continue;
      lines.push(`    ${member}${kindShape(component.kind, component.name)}`);
    }
    lines.push('  end');
  }

  for (const connection of spec.connections) {
    const from = idByName.get(connection.from);
    const to = idByName.get(connection.to);
    if (!from || !to) continue;
    const label = (connection.label ?? '').replace(/\|/g, '-');
    const edgeLabel = label ? `${label} - ${connection.protocol}` : connection.protocol;
    const arrow = connection.protocol === 'async' ? '-.->' : '-->';
    lines.push(`  ${from} ${arrow}|"${edgeLabel}"| ${to}`);
  }

  return lines.join('\n');
}

/** Compact textual snapshot of the spec — this is what Jev reviews, not the diagram. */
export function specToText(spec: ArchitectureSpec): string {
  const lines: string[] = [
    `Title: ${spec.title}`,
    `Requirements: scale=${spec.requirements.scale}, availability=${spec.requirements.availability}, dataSensitivity=${spec.requirements.dataSensitivity}`,
    'Components:',
    ...spec.components.map((c) => `- ${c.id} (${c.kind}): ${c.name} — ${c.description}`),
    'Connections:',
    ...spec.connections.map((c) => `- ${c.from} -> ${c.to} (${c.protocol})${c.label ? `: ${c.label}` : ''}`),
  ];
  if (spec.decisions.length > 0) {
    lines.push('Decisions:');
    lines.push(...spec.decisions.map((d) => `- ${d.decision} — ${d.rationale}`));
  }
  if (spec.assumptions.length > 0) {
    lines.push(`Assumptions: ${spec.assumptions.join('; ')}`);
  }
  return lines.join('\n');
}

/** Pulls the first JSON object out of an LLM response (tolerates code fences + prose). */
export function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found in model response.');
  return candidate.slice(start, end + 1);
}

/** Jev's bounded answers → plain constraints the generator can rely on. */
export function normalizeDecisions(answers: Record<string, unknown> | undefined): IntentDecisions {
  if (!answers) return {};
  const asAnswer = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;

  const choice = (key: string): string | undefined => {
    const value = asAnswer(answers[key]);
    return typeof value?.choice === 'string' ? value.choice : undefined;
  };
  const noul = (key: string): boolean | undefined => {
    const value = asAnswer(answers[key]);
    if (typeof value?.noul !== 'number') return undefined;
    return value.noul >= 0.5;
  };

  return {
    appType: choice('appType'),
    needsAsyncProcessing: noul('needsAsyncProcessing'),
    dataSensitivity: choice('dataSensitivity'),
    architectureTier: choice('architectureTier'),
  };
}

export function buildSpecSystemPrompt(): string {
  return [
    'You are an architecture designer. You produce ONE valid JSON object and nothing else — no markdown fences, no prose, no code blocks.',
    '',
    'The object must match this schema exactly:',
    '{',
    '  "title": string,',
    '  "assumptions": string[],',
    '  "requirements": { "scale": "prototype"|"small"|"medium"|"large", "availability": "standard"|"high", "dataSensitivity": "public"|"internal"|"sensitive" },',
    '  "components": [{ "id": string, "name": string, "kind": "client"|"api"|"service"|"database"|"queue"|"cache"|"storage"|"auth"|"external", "description": string }],',
    '  "connections": [{ "from": string, "to": string, "protocol": "HTTPS"|"gRPC"|"SQL"|"async", "label"?: string }],',
    '  "decisions": [{ "decision": string, "rationale": string, "alternatives": string[] }],',
    '  "openQuestions": string[]',
    '}',
    '',
    'Rules:',
    '- Prefer the simplest architecture that satisfies the requirements.',
    '- Use a modular monolith unless independently deployable services are required.',
    '- Include only components justified by a stated requirement.',
    '- State assumptions explicitly.',
    '- Do not use vendor-specific services unless the user requests a cloud.',
    '- Every connection must reference existing component ids.',
    '- Never expose a data store to clients directly; front public access with an API boundary.',
  ].join('\n');
}

export function buildSpecUserPrompt(prompt: string, decisions: IntentDecisions): string {
  const constraints = [
    `appType: ${decisions.appType ?? 'unknown'}`,
    `needsAsyncProcessing: ${decisions.needsAsyncProcessing ?? 'unknown'}`,
    `dataSensitivity: ${decisions.dataSensitivity ?? 'unknown'}`,
    `architectureTier: ${decisions.architectureTier ?? 'unknown'}`,
  ].join('\n');

  return [
    'User request:',
    prompt.trim(),
    '',
    'Classified constraints (respect these):',
    constraints,
    '',
    'Output ONLY the JSON object.',
  ].join('\n');
}

export type SpecGenerationResult = {
  spec: ArchitectureSpec;
  repairs: number;
  elapsedMs: number;
};

/**
 * Stage two: the LLM design layer. Generates a strict ArchitectureSpec JSON,
 * validates it against Zod, and sends validation errors back for one repair
 * attempt. Never returns an unvalidated spec. If the requested model id does
 * not exist on the account, the next model in the fallback list is tried.
 */
export async function generateArchitectureSpec(
  prompt: string,
  decisions: IntentDecisions,
  options: { model?: string } = {},
): Promise<SpecGenerationResult> {
  const startedAt = performance.now();
  const models = [options.model ?? SPEC_GENERATION_MODEL, SPEC_GENERATION_FALLBACK]
    .filter((model, index, all) => all.indexOf(model) === index);
  const systemPrompt = buildSpecSystemPrompt();
  let lastError: unknown = null;

  for (const model of models) {
    try {
      return await specAttempts(prompt, decisions, systemPrompt, model, startedAt);
    } catch (error) {
      if (!isModelUnavailableError(error)) throw error;
      lastError = error;
      logger.warn(`[ArchitectureSpec] Model ${model} unavailable, trying fallback.`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No usable generation model is configured for the design stage.');
}

async function specAttempts(
  prompt: string,
  decisions: IntentDecisions,
  systemPrompt: string,
  model: string,
  startedAt: number,
): Promise<SpecGenerationResult> {
  let userPrompt = buildSpecUserPrompt(prompt, decisions);
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resultStr = await apiKeyManager.executeWithRetry(async (groq) =>
        groqJsonCompletion(groq, {
          model,
          reasoning_effort: 'low',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 2000,
        }),
      );

      const parsed = ArchitectureSpecSchema.safeParse(JSON.parse(extractJsonObject(resultStr)));
      if (parsed.success) {
        return { spec: parsed.data, repairs: attempt - 1, elapsedMs: Math.max(0, performance.now() - startedAt) };
      }

      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'spec'} → ${issue.message}`)
        .join('; ');
      logger.warn(`[ArchitectureSpec] Validation failed (attempt ${attempt}/${maxAttempts}): ${issues}`);
      userPrompt = [
        userPrompt,
        '',
        `Your previous response failed validation: ${issues}`,
        'Rewrite as a single valid JSON object that satisfies every constraint.',
      ].join('\n');
    } catch (error) {
      logger.error('[ArchitectureSpec] generation failed', error);
      if (attempt < maxAttempts) {
        // Possibly a truncated JSON response — ask the model to try again.
        userPrompt = [
          userPrompt,
          '',
          'Your previous response was unusable. Output ONLY a single complete, valid JSON object.',
        ].join('\n');
        continue;
      }
      throw error;
    }
  }

  const finalError = new Error('Could not produce a valid ArchitectureSpec after repair attempts.');
  finalError.name = 'SpecNotGenerated';
  throw finalError;
}

/** Whether a thrown generation error means no LLM keys are configured at all. */
export function isLlmNotConfigured(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('no groq api keys');
}

export type ReviewVerdict = {
  check: string;
  label: string;
  status: 'accepted' | 'flagged' | 'no_data';
  value: number | null;
  confidence: number | null;
  message?: string;
};

const VERDICT_LABELS: Record<string, { label: string; flagged: (value: number) => boolean; message: (value: number) => string }> = {
  databasePubliclyExposed: {
    label: 'Database not publicly exposed',
    flagged: (value) => value > 0.2,
    message: (value) => `${Math.round(value * 100)}% probability of a publicly reachable data store.`,
  },
  hasUnjustifiedComplexity: {
    label: 'No unjustified infrastructure',
    flagged: (value) => value > 0.7,
    message: (value) => `${Math.round(value * 100)}% probability of unjustified complexity.`,
  },
  authGap: {
    label: 'Authentication boundary present',
    flagged: (value) => value > 0.2,
    message: (value) => `${Math.round(value * 100)}% probability of an authentication gap.`,
  },
};

/**
 * Policy is enforced in application code, not by the model. Atomic noul/
 * score checks become accept / flag / review verdicts with fixed thresholds.
 */
export function computeReviewVerdicts(answers: Record<string, unknown> | undefined): ReviewVerdict[] {
  if (!answers) return [];
  const verdicts: ReviewVerdict[] = [];

  for (const [check, config] of Object.entries(VERDICT_LABELS)) {
    const raw = answers[check];
    const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
    const noul = typeof value?.noul === 'number' ? value.noul : null;
    const confidence = typeof value?.confidence === 'number' ? value.confidence : null;
    if (noul === null) {
      verdicts.push({ check, label: config.label, status: 'no_data', value: null, confidence });
      continue;
    }
    verdicts.push({
      check,
      label: config.label,
      status: config.flagged(noul) ? 'flagged' : 'accepted',
      value: noul,
      confidence,
      message: config.message(noul),
    });
  }

  const fit = answers.architectureFit;
  const fitValue = fit && typeof fit === 'object' ? (fit as Record<string, unknown>) : null;
  verdicts.push({
    check: 'architectureFit',
    label: 'Architecture fit',
    status: fitValue === null
      ? 'no_data'
      : (typeof fitValue.score === 'number' && fitValue.score < 4) || (typeof fitValue.confidence === 'number' && fitValue.confidence < 0.75)
        ? 'flagged'
        : 'accepted',
    value: typeof fitValue?.score === 'number' ? fitValue.score : null,
    confidence: typeof fitValue?.confidence === 'number' ? fitValue.confidence : null,
    message: fitValue?.rationale && typeof fitValue.rationale === 'string'
      ? fitValue.rationale
      : fitValue === null
        ? 'Jev returned no fit score.'
        : undefined,
  });

  return verdicts;
}