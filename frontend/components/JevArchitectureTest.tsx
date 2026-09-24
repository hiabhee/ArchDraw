'use client';

import { FormEvent, useState } from 'react';
import { buildDiagramMermaid } from '@/lib/jev/architectureDiagrams';
import { DiagramStage } from '@/components/DiagramCanvas';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cpu,
  Layers3,
  Network,
  Scale,
  ShieldAlert,
  Sparkles,
  Workflow,
  XCircle,
} from 'lucide-react';

type Decision = Record<string, unknown>;

type Run = {
  answers: Record<string, Decision>;
  usage?: { input_tokens?: number; output_tokens?: number };
  elapsedMs?: number;
  creditsUsed?: number;
};

type TestPayload = {
  baseline: { answers: Record<string, Decision>; elapsedMs: number };
  jev: Run | null;
  jevError: string | null;
  jevCode: string | null;
  elapsedMs: number;
};

type ReviewVerdict = {
  check: string;
  label: string;
  status: 'accepted' | 'flagged' | 'no_data';
  value: number | null;
  confidence: number | null;
  message?: string;
};

type Spec = {
  title: string;
  assumptions: string[];
  requirements: { scale: string; availability: string; dataSensitivity: string };
  components: Array<{ id: string; name: string; kind: string; description: string }>;
  connections: Array<{ from: string; to: string; protocol: string; label?: string }>;
  decisions: Array<{ decision: string; rationale: string; alternatives: string[] }>;
  openQuestions: string[];
};

type TwoStagePayload = {
  mode: 'twoStage';
  durations?: {
    classificationMs: number | null;
    specMs: number | null;
    validationMs: number | null;
    totalMs: number;
  } | null;
  classification: {
    ok: boolean;
    answers: Record<string, Decision>;
    decisions: Record<string, unknown>;
    elapsedMs?: number | null;
    creditsUsed?: number | null;
    error?: string | null;
    code?: string | null;
  };
  spec: Spec | null;
  specError: string | null;
  specCode: string | null;
  specMs?: number | null;
  validation: {
    ok: boolean;
    answers: Record<string, Decision>;
    verdicts: ReviewVerdict[];
    fitJudgement: 'accepted' | 'flagged' | null;
    elapsedMs?: number | null;
    creditsUsed?: number | null;
    error?: string | null;
    code?: string | null;
  } | null;
  render: string | null;
  elapsedMs: number;
};

type Payload = TestPayload | TwoStagePayload;

function isTwoStagePayload(payload: Payload | null): payload is TwoStagePayload {
  return !!payload && typeof payload === 'object' && 'mode' in payload && (payload as TwoStagePayload).mode === 'twoStage';
}

const starterArchitecture = `A Next.js application serves a React interface and REST API. PostgreSQL stores users and canvases. Redis handles rate limiting. Background jobs send email and generate diagrams. The product expects traffic spikes when teams publish diagrams.`;

const scenarios = [
  {
    name: 'Product core',
    text: starterArchitecture,
  },
  {
    name: 'Event pipeline',
    text: 'An ingestion API accepts thousands of events per second. It publishes each event to a durable queue. Independent workers validate, enrich, and store records in a data warehouse. Failed events go to a dead-letter queue and can be replayed.',
  },
  {
    name: 'Small SaaS',
    text: 'A small team runs one TypeScript application with a web UI, REST endpoints, PostgreSQL, and a managed email provider. Deployments happen a few times per week. There are no background workers or cross-service calls today.',
  },
];

const DECISIONS = [
  { key: 'primary_pattern', label: 'Primary pattern', icon: Layers3 },
  { key: 'async_workload_fit', label: 'Queue fit', icon: Workflow },
  { key: 'operational_complexity', label: 'Operational complexity', icon: Activity },
] as const;

type DecisionKey = (typeof DECISIONS)[number]['key'];

function answerValue(answer?: Decision) {
  if (!answer) return '—';
  if (typeof answer.choice === 'string') return answer.choice.replace(/_/g, ' ');
  if (typeof answer.noul === 'number') return `${Math.round(answer.noul * 100)}%`;
  if (typeof answer.score === 'number') return `${answer.score} / 5`;
  return 'Available';
}

function answerConfidence(answer?: Decision) {
  if (!answer || typeof answer.confidence !== 'number') return null;
  return `${Math.round(answer.confidence * 100)}% confidence`;
}

function answerRationale(answer?: Decision) {
  if (!answer || typeof answer.rationale !== 'string') return null;
  return answer.rationale;
}

function answersAgree(a: Decision | undefined, b: Decision | undefined): boolean | null {
  if (!a || !b) return null;
  if (typeof a.choice === 'string' && typeof b.choice === 'string') return a.choice === b.choice;
  if (typeof a.noul === 'number' && typeof b.noul === 'number') return Math.abs(a.noul - b.noul) <= 0.2;
  if (typeof a.score === 'number' && typeof b.score === 'number') return Math.abs(a.score - b.score) <= 1;
  return null;
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  appType: 'Application type',
  needsAsyncProcessing: 'Async processing',
  dataSensitivity: 'Data sensitivity',
  architectureTier: 'Architecture tier',
};

function decisionLabel(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Required' : 'Not required';
  if (typeof value === 'string') return value.replace(/_/g, ' ');
  return '—';
}

export function JevArchitectureTest() {
  const [mode, setMode] = useState<'comparison' | 'twoStage'>('comparison');
  const [architecture, setArchitecture] = useState(starterArchitecture);
  const [result, setResult] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function runComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ architecture, mode: 'both' }),
      });
      const payload = await response.json() as TestPayload & { error?: string };

      if (!response.ok) {
        setError(payload.error ?? 'The decision request could not be completed.');
        return;
      }

      setResult(payload);
    } catch {
      setError('Network error. Check that the local app is running and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function runTwoStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ architecture, mode: 'twoStage' }),
      });
      const payload = await response.json() as TwoStagePayload & { error?: string };

      if (!response.ok) {
        setError(payload.error ?? 'The two-stage request could not be completed.');
        return;
      }

      setResult(payload);
    } catch {
      setError('Network error. Check that the local app is running and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const isTwoStage = mode === 'twoStage';
  const onSubmit = isTwoStage ? runTwoStage : runComparison;
  const comparisonResult = !isTwoStage && result && !isTwoStagePayload(result) ? (result as TestPayload) : null;
  const twoStageResult = isTwoStage && isTwoStagePayload(result) ? (result as TwoStagePayload) : null;
  const baselinePattern = comparisonResult ? (comparisonResult.baseline.answers.primary_pattern?.choice as string | undefined) : undefined;
  const jevPattern = comparisonResult ? (comparisonResult.jev?.answers.primary_pattern?.choice as string | undefined) : undefined;

  return (
    <main className="min-h-screen bg-surface-page px-5 py-8 text-text-primary sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex flex-col gap-6 border-b border-border-default pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              <Activity className="size-3.5" aria-hidden="true" /> Decision laboratory
            </div>
            <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">Judged, two ways.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary">
              {isTwoStage
                ? 'Jev classifies intent, a design model writes a strict ArchitectureSpec, Jev validates it atomically, and the real engine renders the result.'
                : 'The same three bounded decisions — and the architecture diagram each decision implies — answered by a deterministic baseline and by Jev.'}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border-default bg-surface-panel px-3 py-2 text-xs text-text-secondary shadow-1">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            Admin-only test surface
          </div>
        </header>

        <div className="mb-8 inline-flex rounded-full border border-border-default bg-surface-panel p-1 shadow-1" role="tablist" aria-label="Test mode">
          {([
            { id: 'comparison', label: 'Compare two judges' },
            { id: 'twoStage', label: 'Two-stage build' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => {
                if (mode !== tab.id) {
                  setResult(null);
                  setError(null);
                }
                setMode(tab.id);
              }}
              className={
                mode === tab.id
                  ? 'rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground'
                  : 'rounded-full px-4 py-1.5 text-xs font-medium text-text-secondary transition hover:text-text-primary'
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-border-default bg-surface-panel p-5 shadow-2 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">01 / Input</p>
              <h2 className="mt-2 text-xl font-semibold">{isTwoStage ? 'Describe what you want to build' : 'Describe the system as it exists'}</h2>
            </div>
            <Network className="size-6 text-brand" aria-hidden="true" />
          </div>

          <form className="mt-6" onSubmit={onSubmit}>
            <label htmlFor="architecture" className="sr-only">Architecture description</label>
            <textarea
              id="architecture"
              value={architecture}
              onChange={(event) => setArchitecture(event.target.value)}
              className="min-h-64 w-full resize-y rounded-xl border border-border-default bg-surface-page p-4 font-mono text-sm leading-6 text-text-primary outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-bg"
              placeholder={isTwoStage ? 'Describe the product, users, traffic, data, and constraints…' : 'Describe components, data stores, traffic, workflows, and operational constraints…'}
              required
              minLength={20}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-text-muted">{architecture.length.toLocaleString()} / 12,000 characters</span>
              <button
                type="submit"
                disabled={isLoading || architecture.trim().length < 20}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isLoading ? (isTwoStage ? 'Building…' : 'Evaluating…') : (isTwoStage ? 'Run two-stage build' : 'Run comparison')}
                {isLoading ? <Activity className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </form>

          <div className="mt-8 border-t border-border-default pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">Load a scenario</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.name}
                  type="button"
                  onClick={() => setArchitecture(scenario.text)}
                  className="rounded-full border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-brand hover:bg-brand-bg hover:text-brand"
                >
                  {scenario.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error ? (
          <div role="alert" className="mt-6 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
            <strong className="block font-semibold">Request stopped</strong>
            {error}
          </div>
        ) : null}

        {twoStageResult ? <TwoStageSection payload={twoStageResult} /> : isTwoStage && result && !isTwoStagePayload(result) ? (
          <div className="mt-6 rounded-xl border border-dashed border-border-default p-4 text-sm leading-6 text-text-muted">
            Previous results are for comparison mode. Run the two-stage build to see classification, spec, and validation here.
          </div>
        ) : null}

        {!isTwoStage && comparisonResult ? (
          <>
            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <ComparisonColumn
                tone="slate"
                badge="Without Jev"
                tagline="Deterministic baseline · zero cost"
                icon={<Cpu className="size-4" aria-hidden="true" />}
                loading={isLoading}
                answers={comparisonResult.baseline.answers}
                emptyText="The baseline judgment will appear here."
                footer={comparisonResult ? (
                  <span><Clock3 className="mr-1 inline size-3" />{comparisonResult.baseline.elapsedMs.toFixed(1)} ms · no LLM</span>
                ) : null}
              />

              <ComparisonColumn
                tone="brand"
                badge="With Jev"
                tagline="LLM judgment · decision API"
                icon={<Sparkles className="size-4" aria-hidden="true" />}
                loading={isLoading}
                answers={comparisonResult.jev?.answers}
                notice={comparisonResult && !comparisonResult.jev ? comparisonResult.jevError : null}
                emptyText="The Jev judgment will appear here."
                footer={comparisonResult.jev ? (
                  <>
                    {typeof comparisonResult.jev.elapsedMs === 'number' ? (
                      <span><Clock3 className="mr-1 inline size-3" />{comparisonResult.jev.elapsedMs} ms</span>
                    ) : null}
                    {typeof comparisonResult.jev.usage?.input_tokens === 'number' ? (
                      <span>{comparisonResult.jev.usage.input_tokens} input tokens</span>
                    ) : null}
                    {typeof comparisonResult.jev.creditsUsed === 'number' ? (
                      <span>{comparisonResult.jev.creditsUsed} credit</span>
                    ) : null}
                  </>
                ) : null}
              />
            </section>

            <section className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">03 / Rendered diagrams</p>
                  <h2 className="mt-1 text-xl font-semibold">The same brief, laid out by the real engine</h2>
                </div>
                <p className="max-w-md text-xs leading-5 text-text-muted">
                  Each pattern is drawn by the production Mermaid → Dagre pipeline and the exact node and edge components
                  the editor uses — drag to pan, scroll to zoom, or open fullscreen.
                </p>
              </div>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <DiagramStage
                  label="Without Jev · baseline pattern"
                  patternLabel={baselinePattern ? baselinePattern.replace(/_/g, ' ') : undefined}
                  code={buildDiagramMermaid(architecture, baselinePattern ?? 'modular_monolith')}
                />
                {comparisonResult.jev ? (
                  <DiagramStage
                    label="With Jev · suggested pattern"
                    patternLabel={jevPattern ? jevPattern.replace(/_/g, ' ') : undefined}
                    code={buildDiagramMermaid(architecture, jevPattern ?? 'modular_monolith')}
                  />
                ) : (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-border-default p-8 text-sm leading-6 text-text-muted">
                    No Jev diagram — Jev returned no judgment for this run.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-border-default bg-surface-panel p-5 shadow-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">04 / Agreement</p>
                <div className="flex flex-wrap gap-2">
                  {DECISIONS.map(({ key, label }) => {
                    const agree = comparisonResult.jev
                      ? answersAgree(comparisonResult.baseline.answers[key], comparisonResult.jev.answers[key])
                      : null;
                    return (
                      <span
                        key={key}
                        className={
                          agree === true
                            ? 'inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success'
                            : agree === false
                              ? 'inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning'
                              : 'inline-flex items-center gap-1.5 rounded-full bg-text-muted/10 px-3 py-1.5 text-xs font-medium text-text-muted'
                        }
                      >
                        {agree === true ? <CheckCircle2 className="size-3" aria-hidden="true" />
                          : agree === false ? <XCircle className="size-3" aria-hidden="true" />
                            : <Scale className="size-3" aria-hidden="true" />}
                        {label}
                        {agree === true ? ' · agree' : agree === false ? ' · diverge' : ' · pending'}
                      </span>
                    );
                  })}
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-text-muted">
                Each run took <span className="font-mono text-text-secondary">{comparisonResult.elapsedMs.toFixed(1)} ms</span> end-to-end through
                <span className="font-mono text-text-secondary"> /api/test</span> for this brief.
              </p>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function TimingStrip({
  durations,
  totalMs,
}: {
  durations: TwoStagePayload['durations'];
  totalMs: number;
}) {
  const entries: { label: string; ms: number | null | undefined }[] = [
    { label: '1 · Classify (Jev)', ms: durations?.classificationMs },
    { label: '2 · Design (LLM)', ms: durations?.specMs },
    { label: '3 · Review (Jev)', ms: durations?.validationMs },
  ];
  const denom = Math.max(1, totalMs);

  return (
    <div className="mt-6 rounded-xl border border-border-default bg-surface-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">Pipeline timing</p>
      <div className="mt-3 grid grid-cols-4 gap-2 max-md:grid-cols-2">
        {entries.map(({ label, ms }) => (
          <div key={label} className="rounded-lg bg-surface-elevated px-3 py-2">
            <p className="text-[11px] text-text-muted">{label}</p>
            <p className="mt-0.5 font-mono text-sm text-text-primary">
              {typeof ms === 'number' ? `${ms.toFixed(0)} ms` : '—'}
            </p>
            {typeof ms === 'number' ? (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (ms / denom) * 100)}%` }} />
              </div>
            ) : null}
          </div>
        ))}
        <div className="rounded-lg border border-border-default bg-surface-elevated px-3 py-2">
          <p className="text-[11px] text-text-muted">Total</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-text-primary">{totalMs.toFixed(0)} ms</p>
        </div>
      </div>
    </div>
  );
}

function TwoStageSection({ payload }: { payload: TwoStagePayload }) {
  const { classification, spec, validation, render } = payload;

  // Guard against stale/malformed payloads (e.g. comparison result cast as TwoStage)
  if (!classification) {
    return (
      <div className="mt-6 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm leading-6 text-warning">
        No classification data in this response. The payload was not a two-stage result — run the two-stage build again.
      </div>
    );
  }

  return (
    <>
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <StageResult
          number="02"
          title="Stage 1 · Intent classification"
          icon={<Sparkles className="size-4" aria-hidden="true" />}
          loading={false}
          resultKey="classification"
        >
          {classification?.ok ? (
            <div className="space-y-2">
              {Object.entries(classification.decisions ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border-default bg-surface-page px-3 py-2">
                  <span className="text-xs font-medium text-text-secondary">{CLASSIFICATION_LABELS[key] ?? key}</span>
                  <span className="rounded-full bg-brand-bg px-2.5 py-1 text-xs font-semibold text-brand">{decisionLabel(value)}</span>
                </div>
              ))}
              {Object.keys(classification.decisions ?? {}).length === 0 ? (
                <p className="text-xs leading-5 text-text-muted">No decisions returned.</p>
              ) : null}
              <p className="pt-1 text-xs text-text-muted">
                {typeof classification.elapsedMs === 'number' ? <><Clock3 className="mr-1 inline size-3" />{classification.elapsedMs} ms</> : null}
                {typeof classification.creditsUsed === 'number' ? <span className="ml-3">{classification.creditsUsed} credit</span> : null}
              </p>
            </div>
          ) : (
            <Notice text={classification?.error ?? 'Classification could not be completed.'} />
          )}
        </StageResult>

        <StageResult
          number=""
          title="Stage 3 · Atomic validation"
          icon={<ShieldAlert className="size-4" aria-hidden="true" />}
          loading={false}
          resultKey="validation"
        >
          {validation ? (
            validation.ok ? (
              <div className="space-y-2">
                {validation.verdicts.map((verdict) => (
                  <div
                    key={verdict.check}
                    className={
                      verdict.status === 'flagged'
                        ? 'rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5'
                        : verdict.status === 'no_data'
                          ? 'rounded-lg border border-border-default bg-surface-page px-3 py-2.5'
                          : 'rounded-lg border border-border-default bg-surface-page px-3 py-2.5'
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-text-secondary">{verdict.label}</span>
                      {verdict.status === 'accepted' ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                        : verdict.status === 'flagged' ? <XCircle className="size-4 shrink-0 text-warning" aria-hidden="true" />
                          : <Scale className="size-4 shrink-0 text-text-muted" aria-hidden="true" />}
                    </div>
                    {verdict.value !== null ? (
                      <p className="mt-1 text-xs text-text-secondary">
                        {verdict.check === 'architectureFit' ? `${verdict.value} / 5` : `${Math.round(verdict.value * 100)}%`}
                        {verdict.confidence !== null ? ` · ${Math.round(verdict.confidence * 100)}% confidence` : ''}
                      </p>
                    ) : null}
                    {verdict.message ? <p className="mt-1 text-xs leading-5 text-text-muted">{verdict.message}</p> : null}
                  </div>
                ))}
                <div className="pt-1 text-xs text-text-muted">
                  {typeof validation.elapsedMs === 'number' ? <><Clock3 className="mr-1 inline size-3" />{validation.elapsedMs} ms</> : null}
                  {typeof validation.creditsUsed === 'number' ? <span className="ml-3">{validation.creditsUsed} credit</span> : null}
                  {validation.fitJudgement ? (
                    <span className="ml-3 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                      {validation.fitJudgement === 'accepted' ? 'fit accepted' : 'flagged for review'}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <Notice text={validation.error ?? 'Validation could not be completed.'} />
            )
          ) : (
            <Notice text="Validation was skipped (Jev not configured for this run)." />
          )}
        </StageResult>
      </section>

      <section className="mt-6 rounded-2xl border border-border-default bg-surface-panel p-5 shadow-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">Stage 2 · Design model</p>
            <h2 className="mt-1 text-xl font-semibold">{spec?.title ?? 'No ArchitectureSpec produced'}</h2>
          </div>
          <p className="text-xs text-text-muted">
            {typeof payload.specMs === 'number' ? <><Clock3 className="mr-1 inline size-3" />{payload.specMs} ms to design</> : ''}
          </p>
        </div>

        {spec ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border-default bg-surface-page p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Requirements</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Scale</dt>
                  <dd className="font-semibold capitalize text-text-primary">{spec.requirements.scale}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Availability</dt>
                  <dd className="font-semibold capitalize text-text-primary">{spec.requirements.availability}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Sensitivity</dt>
                  <dd className="font-semibold capitalize text-text-primary">{spec.requirements.dataSensitivity}</dd>
                </div>
              </dl>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Components</p>
              <ul className="mt-2 space-y-1.5">
                {spec.components.map((component) => (
                  <li key={component.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="font-medium text-text-primary">{component.name}</span>
                    <span className="text-right text-xs text-text-muted">{component.kind.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Connections</p>
              <ul className="mt-2 space-y-1.5">
                {spec.connections.map((connection) => (
                  <li key={`${connection.from}-${connection.to}-${connection.protocol}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-text-secondary">
                      {connection.from} → {connection.to}
                    </span>
                    <span className="rounded bg-text-muted/10 px-1.5 py-0.5 font-mono text-xs text-text-secondary">{connection.protocol}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-4">
              {spec.assumptions.length > 0 ? (
                <div className="rounded-xl border border-border-default bg-surface-page p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Assumptions</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-text-secondary">
                    {spec.assumptions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ) : null}

              {spec.decisions.length > 0 ? (
                <div className="rounded-xl border border-border-default bg-surface-page p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Decisions</p>
                  <ul className="mt-2 space-y-3">
                    {spec.decisions.map((item) => (
                      <li key={item.decision} className="text-sm">
                        <p className="font-semibold text-text-primary">{item.decision}</p>
                        <p className="mt-0.5 text-xs leading-5 text-text-secondary">{item.rationale}</p>
                        {item.alternatives.length > 0 ? (
                          <p className="mt-1 text-xs text-text-muted">Alternatives: {item.alternatives.join(', ')}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {spec.openQuestions.length > 0 ? (
                <div className="rounded-xl border border-border-default bg-surface-page p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Open questions</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-text-secondary">
                    {spec.openQuestions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border-default p-4 text-sm leading-6 text-text-muted">
            {payload.specError ?? 'The design model produced no spec.'}
            {payload.specCode ? <span className="mt-1 block font-mono text-xs text-text-secondary">{payload.specCode}</span> : null}
          </p>
        )}
      </section>

      {render ? (
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">04 / Rendered diagram</p>
              <h2 className="mt-1 text-xl font-semibold">The spec, drawn by the real engine</h2>
            </div>
            <p className="max-w-md text-xs leading-5 text-text-muted">
              Stage 2 output is deterministic: the ArchitectureSpec maps 1:1 to Mermaid, then to the same React Flow graph the editor renders.
            </p>
          </div>
          <div className="mt-4">
            <DiagramStage label="ArchitectureSpec → diagram" code={render} />
          </div>
        </section>
      ) : null}

      <TimingStrip durations={payload.durations} totalMs={payload.elapsedMs} />

      <p className="mt-4 text-xs leading-5 text-text-muted">
        Total run took <span className="font-mono text-text-secondary">{payload.elapsedMs.toFixed(1)} ms</span> end-to-end through
        <span className="font-mono text-text-secondary"> /api/test</span>.
      </p>
    </>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div role="alert" className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs leading-5 text-warning">
      {text}
    </div>
  );
}

function StageResult({
  number,
  title,
  icon,
  loading,
  resultKey,
  children,
}: {
  number: string;
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  resultKey: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-default bg-surface-panel p-5 shadow-2">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
          {icon}{title}
        </div>
        {number ? <span className="text-xs font-semibold text-text-muted">{number}</span> : null}
      </header>
      {loading ? (
        <div aria-hidden="true" className="h-24 animate-pulse rounded-xl bg-text-muted/10" />
      ) : (
        <div data-testid={`two-stage-${resultKey}`}>{children}</div>
      )}
    </section>
  );
}

function ComparisonColumn({
  tone,
  badge,
  tagline,
  icon,
  loading,
  answers,
  notice = null,
  emptyText,
  footer,
}: {
  tone: 'slate' | 'brand';
  badge: string;
  tagline: string;
  icon: React.ReactNode;
  loading: boolean;
  answers?: Record<DecisionKey, Decision>;
  notice?: string | null;
  emptyText: string;
  footer?: React.ReactNode;
}) {
  const accent = tone === 'brand' ? '#6366f1' : '#64748b';

  return (
    <section className="overflow-hidden rounded-2xl border border-border-default bg-surface-panel shadow-2">
      <header className="border-b border-border-default p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${accent}14, transparent 55%)` }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: accent, background: `${accent}1a` }}>
              {icon}{badge}
            </div>
            <p className="text-sm text-text-secondary">{tagline}</p>
          </div>
          <span className="size-2.5 rounded-full" style={{ background: accent }} aria-hidden="true" />
        </div>
      </header>

      <div className="p-5 sm:p-6">
        {notice ? (
          <div role="alert" className="mb-4 rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs leading-5 text-warning">
            {notice}
          </div>
        ) : null}

        {answers ? (
          <div className="space-y-3">
            {DECISIONS.map(({ key, label, icon: Icon }) => (
              <DecisionCard
                key={key}
                icon={<Icon className="size-4" />}
                label={label}
                value={answerValue(answers[key])}
                detail={answerConfidence(answers[key])}
                rationale={answerRationale(answers[key])}
              />
            ))}
          </div>
        ) : loading ? (
          <div className="space-y-3" aria-hidden="true">
            {DECISIONS.map(({ key }) => (
              <div key={key} className="h-24 animate-pulse rounded-xl bg-text-muted/10" />
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-border-default p-4 text-sm leading-6 text-text-muted">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 opacity-50" aria-hidden="true" />
            {emptyText}
          </div>
        )}

        {footer ? (
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border-default pt-4 text-xs text-text-muted">
            {footer}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DecisionCard({ icon, label, value, detail, rationale }: { icon: React.ReactNode; label: string; value: string; detail: string | null; rationale: string | null }) {
  return (
    <article className="rounded-xl border border-border-default bg-surface-page p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-muted">{icon}{label}</div>
      <p className="mt-2 text-xl font-semibold capitalize text-text-primary">{value}</p>
      {detail ? <p className="mt-1 text-xs text-text-secondary">{detail}</p> : null}
      {rationale ? <p className="mt-2 border-t border-border-default pt-2 text-xs leading-5 text-text-secondary">{rationale}</p> : null}
    </article>
  );
}