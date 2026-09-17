# Credit-Based Diagram Generation Plan

## Objective

Replace fixed generation counts with a credit system that reflects diagram complexity.

Users receive a credit balance and spend different amounts based on generation detail:

- L1 essential diagrams cost fewer credits.
- L2 standard diagrams cost a moderate amount.
- L3 comprehensive diagrams cost the most.

The system must remain compatible with existing guest limits, authenticated quotas, provider token limits, diagram caching, streaming generation, and the quality-repair pipeline.

## Recommended product policy

### Initial credit prices

| Detail level | Product name | Credits | Intended result |
| --- | --- | ---: | --- |
| L1 | Essential | 1 | Core components and primary flow |
| L2 | Standard | 2 | Core flow plus key dependencies |
| L3 | Comprehensive | 4 | Detailed architecture, secondary paths, async flows |

Do not make L3 cost the entire free balance. A 10-credit free balance should support either 10 L1 diagrams, 5 L2 diagrams, 2 L3 diagrams plus 2 L1 diagrams, or any equivalent combination.

### Initial balances

Recommended starting values:

- Guest: **10 credits per rolling day** or per clearly defined guest period.
- Authenticated user: **30 credits per month** initially.
- Paid tiers can be added later without changing the generation API.

The exact refill period and paid pricing should be product-configurable rather than hard-coded.

### Credit rules

- Credits are spent on generation, not on viewing, editing, exporting, or importing.
- A cached identical generation costs zero additional credits.
- Credits are reserved before provider work begins.
- Credits are consumed only after a valid diagram result is produced.
- Failed, cancelled, expired, or provider-rejected jobs release their reservation.
- Quality-repair calls are included in the original generation cost.
- A user cannot spend more credits than their available balance.
- Credits are not transferable between users.
- Credit balances and ledger entries must be auditable.

## Current code locations

The implementation should extend these existing paths:

- `frontend/lib/userQuotas.ts` — current guest/authenticated quota definitions
- `frontend/lib/middleware/quotaCheck.ts` — current generation admission checks
- `frontend/app/api/generate-diagram/route.ts` — synchronous generation API
- `frontend/lib/ai/generationService.ts` — client generation request and streaming behavior
- `frontend/lib/ai/services/orchestrator.ts` — server generation orchestration
- `frontend/lib/ai/services/diagramCache.ts` — prompt/result cache
- `frontend/store/diagramStore.ts` and related slices — client generation state
- `frontend/prisma/schema.prisma` — persistent user and usage models
- `frontend/components/FloatingAIBar.tsx` / `GenerationProgress.tsx` — generation UI

Do not remove the existing quota checks until the credit system has been verified in production. During migration, the credit check should become the primary product limit while the existing limits remain as a safety backstop.

## Target request flow

```text
User chooses L1/L2/L3
        |
        +--> resolve credit cost
        |
        +--> normalize prompt and check cache
        |       |
        |       +--> cache hit: return result, charge 0
        |
        +--> check user/guest identity and balance
        |
        +--> reserve credits atomically
        |
        +--> run generation / queue job
        |       |
        |       +--> valid result: commit reservation
        |       +--> failure/cancel: release reservation
        |
        +--> return result and updated balance
```

Credit reservation must happen before provider work, but cache lookup must happen first so repeated prompts remain free.

## Phase 1: Define the credit domain model

### 1. Add a central credit configuration

Create a single source of truth, for example `frontend/lib/creditConfig.ts`:

```ts
export type GenerationDetailLevel = 1 | 2 | 3;

export const GENERATION_CREDIT_COST: Record<GenerationDetailLevel, number> = {
  1: 1,
  2: 2,
  3: 4,
};

export const DEFAULT_GUEST_CREDITS = 10;
export const DEFAULT_AUTHENTICATED_CREDITS = 30;
```

All API, UI, tests, and quota logic must import this configuration. Do not duplicate costs in components or route handlers.

### 2. Separate balance from ledger

The balance is an optimization. The ledger is the audit trail.

Recommended Prisma models:

```prisma
model CreditAccount {
  id           String   @id @default(cuid())
  userId       String?  @unique
  guestId      String?  @unique
  balance      Int      @default(0)
  lifetimeEarned Int    @default(0)
  lifetimeSpent  Int    @default(0)
  periodStart  DateTime
  periodEnd    DateTime
  version      Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries      CreditLedgerEntry[]
}

model CreditLedgerEntry {
  id             String   @id @default(cuid())
  accountId      String
  amount         Int      // positive earn/refund, negative spend
  reason         String   // grant, generation_reserve, generation_commit, refund, expiry, admin_adjustment
  generationId   String?
  idempotencyKey String   @unique
  metadata       Json?
  createdAt      DateTime @default(now())
  account        CreditAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
}
```

If the project prefers not to add a separate guest account table, use a deterministic hashed guest identifier as `guestId`. Never store raw IP addresses or browser fingerprints in the ledger.

### 3. Generation reservation records

Add a reservation model or extend the existing usage model with:

- generation/request ID;
- account ID;
- reserved amount;
- committed amount;
- status (`reserved`, `committed`, `released`, `expired`);
- idempotency key;
- timestamps and expiry.

Reservations prevent two concurrent browser tabs from spending the same credits.

## Phase 2: Implement atomic balance operations

Create a server-only service, for example `frontend/lib/credits/creditService.ts`.

Required operations:

```ts
getCreditAccount(identity): Promise<CreditAccountView>
reserveCredits(identity, cost, idempotencyKey): Promise<ReservationResult>
commitReservation(reservationId): Promise<void>
releaseReservation(reservationId, reason): Promise<void>
grantCredits(identity, amount, reason, idempotencyKey): Promise<void>
```

### Reservation requirements

`reserveCredits` must be atomic:

1. Resolve or create the account.
2. Refresh the account period if it has expired.
3. Return an existing reservation for the same idempotency key, if present.
4. Verify balance is at least the requested cost.
5. Decrease balance and increment the account version in one transaction.
6. Create a ledger entry with a negative amount.
7. Create the reservation record.

Use a database transaction for persistent accounts. If queued jobs are coordinated through Redis, the database remains the source of truth for credits; Redis must not be the only balance store.

### Idempotency

The same generation request may be retried by the browser or proxy. An idempotency key must prevent double charging.

Recommended key inputs:

- authenticated user ID or guest ID;
- normalized prompt hash;
- requested detail level;
- client request ID.

Do not use only the prompt hash: two intentional regenerations of the same prompt must be distinguishable when the user explicitly requests regeneration.

## Phase 3: Integrate with the generation API

### Request schema

Extend the request schema in `generate-diagram/route.ts` with:

```ts
detailLevel?: 1 | 2 | 3;
requestId?: string;
```

The server remains authoritative. Never trust a client-provided credit cost.

Resolve the effective detail level and diagram size server-side:

```text
L1 → small → 1 credit
L2 → medium → 2 credits
L3 → large → 4 credits
```

### Response fields

Successful synchronous responses should include:

```json
{
  "success": true,
  "data": {},
  "credits": {
    "charged": 2,
    "remaining": 8,
    "detailLevel": 2
  }
}
```

Insufficient balance should return HTTP `402 Payment Required` or a product-consistent `429` error with:

```json
{
  "success": false,
  "code": "INSUFFICIENT_CREDITS",
  "required": 4,
  "available": 1,
  "upgradePrompt": "Use a lower detail level or sign in for more credits."
}
```

Use one canonical error code across synchronous, streaming, and queued routes.

### Cache ordering

The order must be:

1. Validate request.
2. Resolve identity.
3. Normalize prompt/model/detail/cache version.
4. Check diagram cache.
5. If cache miss, reserve credits.
6. Generate.

Never reserve credits before a cache lookup.

## Phase 4: Integrate queued generation and provider limits

Credit admission and provider admission are separate controls:

- credits answer “is this user allowed to generate?”;
- the global token bucket answers “can the provider handle this now?”;
- the active-job limit answers “how much concurrency can this deployment safely run?”

For queued jobs:

1. Reserve credits when the job is accepted.
2. Store the reservation ID on the job.
3. Run the provider call only when the global limiter admits it.
4. Commit credits after a valid diagram result.
5. Release credits on provider failure, cancellation, expiry, or catastrophic materialization failure.

Do not charge repair calls separately. If repair is deferred because provider capacity is unavailable, the original credit charge remains tied to the generation result.

If a queued job expires before execution, release the reservation and write a refund ledger entry.

## Phase 5: Guest identity and account transitions

### Guest accounts

Guests need a stable but privacy-conscious identity. Use the existing guest ID mechanism from `quotaCheck.ts` and make it the credit account key.

Do not use only IP address because shared networks would incorrectly share balances. Do not rely only on localStorage because users can clear it.

Recommended guest identity inputs:

- signed, httpOnly guest cookie;
- server-side hashed guest ID;
- IP/device signals only as abuse-detection inputs, not as the balance owner.

### Sign-in conversion

When a guest signs in:

- do not silently multiply credits;
- either keep guest credits separate or offer a clearly defined one-time merge;
- if merging, make it idempotent and record a ledger entry explaining the transfer.

Recommended first version: keep guest and authenticated accounts separate and start the authenticated account with its own grant. This is simpler and avoids accidental double grants.

## Phase 6: UI and user messaging

### Credit balance display

Show the balance in the generation UI and account/dashboard surfaces:

- current balance;
- next refill date;
- optional “how credits work” explanation;
- link to sign in or upgrade when appropriate.

### Pre-generation confirmation

Before starting, show the exact cost:

```text
Essential diagram · 1 credit
Standard diagram · 2 credits
Comprehensive diagram · 4 credits
```

Disable generation when the selected level exceeds the current balance, but keep the server check authoritative.

### Progress and failures

During generation show:

- credit reservation status;
- queued/running state;
- whether the result is using a cached response;
- final charged amount and remaining balance.

On failure, state clearly that the reservation was released. Avoid showing “credits spent” if the generation failed before producing a valid result.

## Phase 7: Migration from fixed quotas

### Compatibility period

For one release, calculate both systems without changing behavior:

- existing guest/auth quota decision;
- calculated credit cost and projected balance.

Log differences without exposing user data.

### Enablement sequence

1. Create accounts for existing authenticated users with the initial grant.
2. Create guest accounts lazily on the first generation request.
3. Enable credit reservation behind a feature flag.
4. Keep the old fixed quota as a hard safety ceiling.
5. Compare rejection rates, average credits/day, and provider token usage.
6. Remove fixed generation-count messaging after credit behavior is stable.

### Existing users

Do not grant credits repeatedly on every request. Use a unique grant idempotency key such as `initial-grant:{userId}:{period}`.

## Phase 8: Abuse prevention

Credits alone do not solve burst traffic or account farming.

Keep these controls:

- per-user and per-guest hourly request limits;
- per-user concurrent-job limit;
- global provider token bucket;
- bounded queue depth;
- prompt-length limits;
- in-flight duplicate request coalescing;
- signed guest cookies and abuse monitoring;
- server-side cost calculation;
- no client-controlled balance or cost fields.

A user who has credits but repeatedly submits oversized prompts should be rejected before provider admission.

## Phase 9: Observability

Track:

- credits granted, reserved, committed, released, and expired;
- balance distribution by account type;
- generations by detail level;
- average credits spent per active user;
- cache-hit rate and free cached generations;
- insufficient-credit rejection rate;
- reservation conflicts/idempotent retries;
- provider tokens per credit;
- queue wait and provider wait;
- generation success/failure by detail level;
- guest-to-authenticated conversion.

Never log raw prompts, API keys, or raw guest identifiers.

Useful dashboards:

- credits consumed per day;
- provider token consumption per day;
- percentage of L1/L2/L3 usage;
- 429 rate and queue depth;
- average and p95 generation duration;
- refund rate;
- users reaching zero balance.

## Testing plan

### Unit tests

- each detail level resolves to the correct cost;
- server ignores a forged client cost;
- reservation rejects insufficient balance;
- concurrent reservations cannot overspend;
- commit is idempotent;
- release/refund is idempotent;
- expired reservations release credits;
- cache hits cost zero;
- regeneration with a new request ID charges normally;
- guest and authenticated balances remain isolated;
- initial grants happen once;
- L3 automatically maps to large diagram size.

### API tests

- successful L1/L2/L3 responses include charged and remaining credits;
- insufficient credits return the canonical error code;
- provider failure releases the reservation;
- queued jobs reserve once and commit once;
- cancelled jobs refund correctly;
- polling never reveals another user’s job or balance;
- streaming and synchronous paths charge identically;
- duplicate HTTP retries do not double-charge.

### Load tests

Run with 20–30 concurrent users:

1. mixed L1/L2/L3 requests;
2. all L3 requests;
3. duplicate prompts;
4. insufficient-credit users;
5. forced provider 429 responses;
6. worker restart with reserved jobs;
7. Redis outage and database outage scenarios.

Success criteria:

- no account becomes negative;
- no request is charged twice;
- failed jobs release reservations;
- duplicate prompts share one generation;
- provider concurrency stays within configured limits;
- queue behavior remains bounded and observable;
- credit responses remain consistent across all API paths.

## Rollout configuration

Suggested initial environment variables:

```text
AI_CREDITS_ENABLED=false
AI_GUEST_CREDITS=10
AI_AUTH_CREDITS=30
AI_CREDITS_PERIOD=monthly
AI_L1_CREDIT_COST=1
AI_L2_CREDIT_COST=2
AI_L3_CREDIT_COST=4
AI_CREDITS_QUEUE_ENABLED=false
AI_CREDITS_RESERVATION_TTL_SECONDS=900
```

The names may be adjusted to match the project’s existing environment conventions. Production secrets must never be committed.

## Definition of done

The feature is complete when:

- users see a balance and level-specific cost before generation;
- L1/L2/L3 consume the configured number of credits;
- cache hits cost zero;
- reservations prevent concurrent overspending;
- failures and cancellations refund reservations;
- guest and authenticated identities are isolated and auditable;
- queued jobs preserve reservation state;
- provider limits remain enforced independently;
- old fixed quota paths cannot double-charge or bypass credits;
- 20–30-user load tests pass without negative balances, duplicate charges, or unbounded provider calls;
- credit costs and grants can change through configuration without rewriting pipeline logic.

