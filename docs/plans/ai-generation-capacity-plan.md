# AI Generation Capacity, Token Budgeting, and Queueing Plan

## Objective

Allow 20–30 people to submit diagram-generation requests during a burst without turning Groq throttling into random failures.

The system should:

- admit work only when the shared provider token budget can support it;
- queue excess work and expose clear progress to the client;
- keep one expensive request from consuming the entire minute;
- avoid retry storms and duplicate planner/repair calls;
- preserve existing diagram quality safeguards and user quotas;
- degrade gracefully when Redis, Groq, or the database is unavailable.

This plan addresses provider capacity. It does not increase Groq’s organization-level quota. Groq documents Compound Mini as a system whose effective limits depend on its underlying models, so the configured limit must be discovered and treated as runtime configuration.

## Current state and observed risks

Relevant code paths:

- API entry: `frontend/app/api/generate-diagram/route.ts`
- Orchestration: `frontend/lib/ai/services/orchestrator.ts`
- Planner: `frontend/lib/ai/pipeline/mermaid-pipeline/architecturePlanner.ts`
- Pipeline stages: `frontend/lib/ai/pipeline/mermaid-pipeline/createAiMermaidStages.ts`
- Provider/key handling: `frontend/lib/ai/utils/apiKeyManager.ts`
- In-memory diagram cache: `frontend/lib/ai/services/diagramCache.ts`
- Optional Redis: `frontend/lib/redis.ts`
- Guest/authenticated quotas: `frontend/lib/middleware/quotaCheck.ts`

Current behavior can produce multiple provider calls for one user action:

1. Initial planner call.
2. Planner JSON/syntax retry.
3. Materialization retry after catastrophic graph loss.
4. Quality-repair planner call when validation/score is weak.
5. Provider-level retries and key rotation after failures.

Under burst traffic, these calls compete for the same organization/model TPM budget. Multiple API keys do not guarantee independent capacity when they belong to the same Groq organization.

## Target architecture

```text
POST /api/generate-diagram
        |
        +--> validate request and user quota
        |
        +--> normalized prompt/cache lookup
        |
        +--> global Redis admission limiter
        |       |
        |       +--> admitted: enqueue/run job
        |       +--> unavailable: bounded local fallback or 503
        |       +--> over budget: durable queue, return 202
        |
        +--> worker claims job
                |
                +--> one bounded planner call
                +--> Mermaid materialization and validation
                +--> optional repair only when policy allows
                +--> persist result/status
                +--> client receives result through polling/SSE
```

The limiter is global across instances. The queue must be durable enough that a server restart does not lose accepted jobs.

## Capacity model

### Token units

Use estimated provider tokens for admission, then record actual usage when Groq returns it.

Define a request budget by detail level:

| Detail level | Default output reservation | Intended use |
| --- | ---: | --- |
| L1 | 2,048 tokens | Essential diagram |
| L2 | 3,072 tokens | Standard architecture |
| L3 | 4,096 tokens | Comprehensive architecture |

The reservation must include planner input tokens, system prompt tokens, expected completion tokens, and a repair allowance. A safe first estimate is:

```text
estimatedCost = promptInputEstimate + plannerOutputBudget
              + optionalRepairAllowance
```

Do not reserve repair capacity for every request. Reserve it only when the first pass produces actionable semantic issues and falls below the repair threshold.

### Configuration

Add environment-backed settings with conservative defaults:

```text
AI_GLOBAL_TPM_LIMIT=12000          # must match the actual account/model limit
AI_GLOBAL_RPM_LIMIT=30
AI_QUEUE_MAX_DEPTH=100
AI_MAX_ACTIVE_JOBS=2
AI_ADMISSION_SAFETY_FACTOR=0.85
AI_L1_MAX_TOKENS=2048
AI_L2_MAX_TOKENS=3072
AI_L3_MAX_TOKENS=4096
AI_REPAIR_MAX_TOKENS=2048
AI_JOB_TTL_SECONDS=900
```

The limit must be configurable because Groq’s published defaults and an organization’s effective underlying-model limit can differ.

## Phase 1: Make token usage measurable

### 1. Add provider usage extraction

Update `groqJsonCompletion` and the provider wrapper to return or record:

- model requested;
- model reported by the provider, when available;
- prompt/input tokens;
- completion/output tokens;
- total tokens;
- finish reason;
- retry-after value;
- rate-limit headers.

Do not log prompts, API keys, or user-sensitive content. Log only request ID, user/guest hash, model, token counts, and outcome.

### 2. Add a per-request budget object

Create a small typed structure near the AI service layer:

```ts
interface GenerationBudget {
  estimatedTokens: number;
  maxPlannerTokens: number;
  repairReserved: boolean;
  detailLevel: 1 | 2 | 3;
}
```

Derive it once per request and pass it through orchestration. Avoid independently recomputing budgets in the route, planner, and repair stage.

### 3. Measure logical versus network calls

Keep the existing distinction in `apiKeyManager.ts`, but extend telemetry with:

- `plannerCalls`;
- `repairCalls`;
- `retryCalls`;
- `estimatedTokens`;
- `actualTokens`;
- `queueWaitMs`;
- `providerWaitMs`.

This makes it possible to identify whether capacity is lost to long prompts, retries, or repair calls.

## Phase 2: Implement the global token bucket

### 1. Redis-backed atomic reservation

Implement a Lua-script or equivalent atomic operation in `frontend/lib/redis.ts` (or a focused `frontend/lib/ai/services/aiAdmissionLimiter.ts`). The operation should:

1. remove expired reservations;
2. calculate tokens remaining in the rolling window;
3. calculate requests remaining in the rolling window;
4. reserve estimated tokens and one request if both limits allow;
5. return admitted/rejected, remaining tokens, reset time, and reservation ID.

Use a rolling one-minute window or a leaky-bucket equivalent. The operation must be atomic so concurrent server instances cannot oversubscribe the budget.

### 2. Reservation lifecycle

Every reservation has:

- a unique reservation ID;
- request/job ID;
- estimated token cost;
- creation time;
- expiry time;
- status (`reserved`, `settled`, `released`).

On provider completion, settle with actual usage. If actual usage is lower, return the difference to the bucket. If actual usage is higher, record an overage and reduce future admission accordingly.

If a job is cancelled or expires before provider execution, release its reservation.

### 3. Redis failure behavior

Redis is optional in the existing application, so define an explicit policy:

- authenticated/persisted production deployments: fail closed for new queued work with a friendly `503 temporarily busy` response;
- local development: use a process-local limiter with a warning;
- never silently run unlimited provider requests when Redis is unavailable.

## Phase 3: Add a durable generation queue

### 1. Job model

Use Redis for the initial implementation if the deployment already has Upstash configured. Store a job record containing:

```ts
interface GenerationJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  userId?: string;
  guestId?: string;
  promptHash: string;
  request: UserIntent;
  estimatedTokens: number;
  reservationId?: string;
  attempts: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  expiresAt: number;
  errorCode?: string;
}
```

Do not store raw prompts in logs. If the queue payload contains the prompt, protect it with the same data-retention policy as generation requests.

### 2. Admission response

Preserve the current synchronous response when work is admitted and completes quickly. When work is queued, return:

```json
{
  "success": true,
  "queued": true,
  "jobId": "job_…",
  "position": 4,
  "estimatedWaitSeconds": 45
}
```

Use HTTP `202 Accepted` for queued jobs.

Add endpoints:

- `GET /api/generate-diagram/jobs/[jobId]` — authenticated/guest-scoped status and completed result;
- `POST /api/generate-diagram/jobs/[jobId]/cancel` — optional cancellation before provider execution.

Never allow a user to read another user’s job by guessing its ID.

### 3. Worker behavior

The worker should:

1. claim at most `AI_MAX_ACTIVE_JOBS` jobs;
2. verify the reservation is still valid;
3. run the orchestrator;
4. settle or release token reservation;
5. write the result to the diagram cache/job record;
6. mark the job complete or failed;
7. release the active-job slot.

Use a lease with renewal so a crashed worker does not leave a job permanently running.

## Phase 4: Reduce token consumption

### 1. Keep the planner prompt compact

The planner system prompt currently includes extensive rules and examples. Split it into:

- a stable, cacheable system prefix;
- a short request-specific suffix;
- only the examples relevant to the requested diagram type/detail level.

Prompt caching is preferred where supported because cached tokens do not count toward Groq rate limits.

### 2. Enforce detail-level budgets centrally

Use one budget resolver for route, planner, and repair:

- L1: 2,048 max planner tokens;
- L2: 3,072;
- L3: 4,096;
- repair: 2,048 and only one repair attempt.

Do not let a caller pass an arbitrary `max_tokens` value above the configured ceiling.

### 3. Make quality repair conditional

Keep repair only when all are true:

- the initial graph has at least the minimum expected nodes/edges;
- validation has actionable issues;
- score is below the configured threshold;
- the request has repair budget remaining;
- the global limiter can reserve the repair cost.

If the repair reservation is unavailable, return the validated original graph with a diagnostic such as `repairDeferred: true`; do not block the whole job waiting indefinitely.

### 4. Avoid duplicate requests

Normalize cache keys by:

- trimming and normalizing whitespace;
- normalizing detail level and diagram size;
- normalizing model ID;
- including pipeline version.

Add an in-flight deduplication key so identical concurrent prompts share one job/result rather than creating 20 provider calls.

## Phase 5: Retry and fallback policy

### Retry rules

- Retry only transient errors and only after `retry-after` when supplied.
- Do not immediately retry a 429 with the same reservation.
- Cap provider retries to one retry for a single logical planner call.
- Do not run planner retry, materialization retry, and quality repair all at once under pressure.

### Fallback rules

- Treat fallback models as separate capacity pools only when the provider/account confirms separate limits.
- Do not assume API-key rotation increases organization-level TPM.
- If all Groq capacity is exhausted, optionally enqueue for a configured OpenRouter fallback pool.
- If no fallback is available, return a clear retryable error and preserve the user’s prompt for a manual retry.

## Phase 6: Client experience

Update `generationService.ts` and the generation UI to handle both immediate and queued responses.

Queued UI should show:

- “Queued” status;
- approximate position/wait;
- cancellation action;
- progress when the job starts;
- a retry action for retryable failures.

Use polling with exponential backoff (for example 1s, 2s, 4s, then 8s up to 15s), or reuse the existing streaming channel after the job begins. Do not poll more frequently than necessary for 30 simultaneous users.

## Phase 7: Quotas and abuse controls

Keep user quotas separate from provider capacity:

- guest generation quota remains enforced before admission;
- authenticated daily quota remains enforced before admission;
- queued jobs count against quota when admitted, not repeatedly on every poll;
- cancel/expiry should not restore a consumed user quota unless product explicitly chooses that policy.

Add per-user concurrency limits:

- guests: one active/queued job;
- authenticated users: two active/queued jobs;
- administrators: configurable higher limit.

Cap prompt length before it reaches the planner. Long prompts should be summarized or rejected with a clear message before consuming provider tokens.

## Phase 8: Observability and alerts

Track metrics by model and detail level:

- request count and completion count;
- queue depth and oldest job age;
- queue wait and provider duration;
- estimated versus actual tokens;
- 429 count and retry-after duration;
- planner retry rate;
- repair attempted/deferred/accepted rate;
- catastrophic materialization-loss count;
- score/grade distribution;
- cache hit and in-flight deduplication rate.

Recommended alerts:

- queue depth above 80% for five minutes;
- oldest queued job older than five minutes;
- 429 rate above 5%;
- average actual tokens exceeding estimate by 20%;
- more than 1% catastrophic graph-loss events;
- Redis limiter unavailable.

Do not include raw prompts, API keys, or full diagram payloads in telemetry.

## Testing plan

### Unit tests

- token bucket admits requests up to the configured budget;
- concurrent reservations are atomic;
- expired reservations are released;
- actual usage settlement returns unused tokens;
- over-budget requests receive reset time and remaining capacity;
- queue positions are stable enough for user display;
- job ownership checks prevent cross-user access;
- one in-flight prompt creates one provider job;
- repair is skipped when no repair budget is available;
- catastrophic materialization loss retries and never returns a false success.

### Integration tests

- 30 concurrent requests produce bounded provider concurrency;
- only admitted jobs call Groq;
- a simulated 429 honors `retry-after` and does not create a retry storm;
- Redis outage fails closed in production mode;
- worker lease recovery requeues abandoned jobs;
- queued jobs survive a worker restart;
- completed queued jobs return the same schema as synchronous generation.

### Load test scenarios

Run against a staging key with a deliberately small configured limit:

1. 30 short L1 prompts.
2. 30 mixed L1/L2 prompts.
3. 20 L3 prompts.
4. 30 identical prompts to verify deduplication.
5. 30 prompts with forced provider 429 responses.

Success criteria:

- no unbounded request fan-out;
- no more than configured active jobs;
- no lost accepted jobs;
- no cross-user job visibility;
- 429s are converted into queueing/backoff rather than cascading failures;
- p95 queue wait and p95 completion time remain visible and bounded.

## Rollout plan

### Stage 1 — instrumentation only

Ship token and retry metrics behind a feature flag. Confirm actual model IDs and effective limits from production responses.

### Stage 2 — limiter shadow mode

Calculate admissions without blocking requests. Compare estimated budgets with actual usage and tune safety factor.

### Stage 3 — limiter enabled, synchronous path retained

Admit requests through Redis but keep the current response path for low queue depth. Return `429` only when the queue is full.

### Stage 4 — durable queue enabled

Return `202` for excess work and enable job polling. Start with `AI_MAX_ACTIVE_JOBS=1` or `2`.

### Stage 5 — repair and fallback tuning

Measure whether deferred repair materially affects diagram quality. Increase concurrency only after observing stable token usage and low 429 rates.

## Recommended initial production settings

For the currently observed 12K effective TPM environment:

```text
AI_GLOBAL_TPM_LIMIT=10000
AI_ADMISSION_SAFETY_FACTOR=0.85
AI_MAX_ACTIVE_JOBS=1
AI_L1_MAX_TOKENS=1536
AI_L2_MAX_TOKENS=2560
AI_L3_MAX_TOKENS=3584
AI_REPAIR_MAX_TOKENS=1536
AI_QUEUE_MAX_DEPTH=30
```

For a confirmed 70K Compound Mini capacity pool, increase the global limit only after verifying the actual response headers and organization limits. Keep the same queue, retry, deduplication, and per-user concurrency controls.

## Definition of done

The implementation is complete when:

- 20–30 simultaneous users are accepted without unbounded Groq calls;
- queued users receive status and eventual results;
- identical prompts share work;
- provider 429s produce controlled backoff;
- actual token usage is measured and reconciled;
- long L3 prompts cannot silently collapse into partial diagrams;
- quota, ownership, and security checks remain intact;
- load tests meet the stated success criteria;
- the configured limit can be changed without code edits.

