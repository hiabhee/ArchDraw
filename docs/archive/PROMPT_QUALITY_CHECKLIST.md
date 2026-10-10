# AI Diagram Generation - Quality Checklist

## What Changed

The system prompt was completely overhauled to enforce **production-grade architecture diagrams** with complete flows, proper semantics, and technical accuracy.

---

## Quality Standards (Now Enforced)

### ✅ Complete Flows
- **Before:** `User → Service → Database` (one way, incomplete)
- **After:** `User → Service → Database → Service → User` (full round trip)

### ✅ Specific Edge Labels
- **Before:** "calls", "sends", "data" (vague)
- **After:** "validates JWT token", "queries user data", "publishes order event" (specific operations)

### ✅ Required Components
- Systems that store data → MUST have database
- User-facing apps → MUST show auth flow
- Queue-based systems → MUST show enqueue → process → complete cycle
- External APIs → MUST show third-party services (Stripe, Twilio, etc.)

### ✅ Correct Shapes
- Database → Cylinder [()] (tall/vertical)
- Message Queue → Queue shape (Kafka, RabbitMQ, SQS)
- Cache → Cache shape (Redis, Memcached)
- Serverless → Function shape (Lambda)
- Object Storage → Bucket shape (S3)
- Auth Service → Shield shape
- Load Balancer → Hexagon
- External API → Cloud shape
- Web Client → Monitor shape
- Mobile App → Mobile shape

### ✅ No Dead Ends
- Every node must have purpose
- Response paths must be shown
- Async workers must show completion

### ✅ Architectural Context
- 1-3 notes explaining non-obvious design decisions
- Subgraphs grouping by architectural layer
- Clear system boundaries

---

## Node Count Increases

To accommodate quality requirements:
- **Small:** 7 → 8 nodes (need room for cache/auth)
- **Medium:** 12 → 15 nodes (proper architecture needs detail)
- **Large:** 20 → 25 nodes (complex systems comprehensive)

---

## Reasoning Steps (Now 8 Steps)

1. **Intent classification** - Why this approach fits
2. **Component justification** - Each component's purpose
3. **Forward flow** - Complete request path
4. **Response flow** - Trace back OR async completion
5. **Edge semantics** - Specific operation labels
6. **Shape assignment** - Why each shape was chosen
7. **Subgraph organization** - Architectural grouping
8. **Validation** - No dead ends, all flows complete

---

## Example Quality Improvements

### Login Flow (Before)
```
Browser → Auth → Database
```
**Issues:** No response, no cache, incomplete

### Login Flow (After)
```
Browser → Load Balancer → Auth Service → Session Cache (check) → User DB
User DB → Auth Service → Session Cache (store) → Auth Service → LB → Browser
```
**Fixed:** Complete round trip, cache optimization, proper shapes, specific labels

---

## Test Prompts

### Basic Web App
**Prompt:** "User authentication with OAuth and session management"
**Should include:**
- Browser (monitor shape)
- Load balancer (hexagon)
- Auth service (shield shape)
- OAuth provider (cloud shape)
- Session cache (cache shape)
- User database (cylinder)
- Complete OAuth redirect flow
- Token validation and session creation

### E-commerce
**Prompt:** "Order checkout with Stripe payment and email notifications"
**Should include:**
- API Gateway
- Order service
- Payment service
- Stripe (cloud shape)
- Inventory service
- Order database (cylinder)
- Event queue (queue shape)
- Email worker (function shape)
- Sync payment flow + async email flow

### Event-Driven
**Prompt:** "Microservices with Kafka event bus"
**Should include:**
- Multiple services
- Kafka (queue shape)
- Event publishers/consumers
- Database per service pattern
- Async event flow with acknowledgments

### Serverless
**Prompt:** "Image processing pipeline with Lambda and S3"
**Should include:**
- Upload S3 bucket (bucket shape)
- SQS queue (queue shape)
- Lambda function (function shape)
- Output S3 bucket (bucket shape)
- CloudFront CDN (cloud shape)
- Trigger → Queue → Process → Store flow

---

## Common Issues Fixed

### ❌ One-Way Flows
**Problem:** Only showing requests, not responses
**Fix:** Bidirectional edges for sync calls

### ❌ Missing Infrastructure
**Problem:** No database when data needs persistence
**Fix:** Architecture quality rules enforce required components

### ❌ Vague Labels
**Problem:** "calls API" doesn't explain what happens
**Fix:** "validates payment with Stripe API"

### ❌ Wrong Shapes
**Problem:** Using rectangle for everything
**Fix:** Semantic shape guide with 15+ shape types

### ❌ Floating Nodes
**Problem:** Components with no connections
**Fix:** Validation step ensures all nodes participate in flow

---

## What to Expect

### Better Diagrams Will:
1. Show complete request/response cycles
2. Include necessary infrastructure (DB, cache, auth)
3. Use descriptive edge labels (actual operations)
4. Assign appropriate shapes for each component type
5. Group components by architectural layer
6. Explain complex decisions with notes
7. Have no orphaned or dead-end nodes

### Users Will See:
- **More accurate** system representations
- **Clearer** data and control flow
- **Professional** diagram quality
- **Complete** architectures (not oversimplified)
- **Better learning** from example diagrams

---

## Monitoring

Track these metrics after deployment:
1. **User feedback** - Are diagrams more helpful?
2. **Edit frequency** - Do users need fewer manual corrections?
3. **Complexity** - Are diagrams showing appropriate detail?
4. **Shape usage** - Are semantic shapes being used correctly?
5. **Flow completeness** - Are responses being shown?

---

## Rollback Plan

If quality degrades:
1. Check if reasoning steps are being followed
2. Verify examples are clear and correct
3. Adjust node count limits if too constrained
4. Review edge label specificity
5. Monitor which rules are being violated most

The old prompt is available in git history for comparison/rollback if needed.
