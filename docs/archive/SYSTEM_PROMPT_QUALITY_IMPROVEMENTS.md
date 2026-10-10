# System Prompt Quality Improvements

## Problem Statement
Diagram quality was not up to par with issues including:
- Incomplete flows (only showing one direction)
- Poor connection semantics (unclear what edges represent)
- Missing critical components (databases, caches when needed)
- Dead-end nodes with no purpose
- Generic, vague edge labels ("calls", "sends")
- Wrong shapes for components
- No architectural context or notes

## Major Improvements Made

### 1. ✅ Added Architecture Quality Rules
**New section enforcing best practices:**
- **Bidirectional flows**: Request AND response paths must be shown
- **Data persistence**: Systems storing data MUST have database/storage
- **Authentication**: User-facing apps should show auth flow
- **Load distribution**: Multi-instance services behind LB shown clearly
- **Error paths**: Critical flows show fallback/retry
- **Async patterns**: Queue systems show complete enqueue → process → complete cycle
- **External dependencies**: Third-party services (Stripe, Twilio) shown when integral
- **State management**: Show where state lives (cache, session store, database)

### 2. ✅ Enhanced Connection Semantics
**Old:** Edge labels "max 2 words" → vague labels like "calls", "sends"

**New:** Edge labels "2-4 words describing actual operation":
- Good: "validates JWT token", "queries user data", "publishes order event"
- Bad: "calls", "sends", "data"

**Added connection types guide:**
- Synchronous calls: solid edges with request/response labeled
- Async messages: edges to/from queues with "publishes event" / "consumes message"
- Data reads/writes: "queries", "inserts", "updates", "deletes"
- State checks: "validates", "authenticates", "authorizes"
- External calls: "charges card", "sends SMS", "uploads file"

### 3. ✅ Complete Flow Requirements
**New rule:** Show BOTH request AND response paths
- User → Service → DB → Service → User (not just User → Service → DB)
- API → External Service → API (show callback/response)
- Queue → Worker → Queue (acknowledge) or → Result Store

### 4. ✅ Expanded Shape Guide with Clear Use Cases
**Before:** Basic shape list with minimal context

**After:** Comprehensive shape guide with specific technologies:
- **Database** = cylinder (Postgres, MySQL, MongoDB) - tall/portrait
- **Queue** = queue shape (Kafka, RabbitMQ, SQS, event bus) - horizontal/landscape
- **Cache** = cache shape (Redis, Memcached)
- **Serverless** = function shape (Lambda, Cloud Functions, Azure Functions)
- **Object storage** = bucket shape (S3, Azure Blob, GCS)
- **Auth** = shield shape (Auth0, Cognito, WAF)
- **Load balancer** = hexagon (ALB, NLB, Nginx, Traefik)
- **External cloud** = cloud shape (Stripe, Twilio, SendGrid)
- And 9 more shape types with specific use cases

### 5. ✅ Improved Reasoning Steps
**Old:** 7 generic steps

**New:** 8 detailed validation steps:
- Step 0: Intent + why generic web stack is/isn't appropriate
- Step 1: Core components with specific justification for EACH
- Step 2: Forward flow - trace COMPLETE request path
- Step 3: Response/return flow - trace back OR async completion
- Step 4: Edge labels - list key connections with specific operations
- Step 5: Shapes - assign semantic shapes with reasoning
- Step 6: Subgraph organization - architectural layers/bounded contexts
- Step 7: Validation - verify no dead ends, all flows complete
- Step 8: Final node count + complexity check

### 6. ✅ Better Examples Showing Quality
**Example 1 (Agent Loop):**
- Added cache shape for working memory
- Shows complete loop back from memory → orchestrator → LLM
- Architectural note explaining iteration
- Multiple tool types shown
- Clear flow: input → reasoning → tool selection → execution → observation → loop back

**Example 3 (Auth Flow):**
- Complete bidirectional flow: Browser ↔ LB ↔ Auth ↔ Cache/DB
- Shows cache check before DB query
- Session creation and caching explicitly shown
- Response path traced back to browser
- Note explaining subsequent requests use cache
- Shield shape for auth, monitor for browser, cache shape for session store

**Example 4 (E-commerce):**
- Full orchestration: Gateway → Checkout → Payment → Stripe integration
- Shows external service (Stripe) with cloud shape
- Complete async path: Order → Queue → Worker → Email
- Bidirectional confirmations from Payment and Inventory
- Function shape for worker, queue shape for event bus
- Architectural note on async processing

**Example 5 (Serverless):**
- All new semantic shapes: bucket (S3), queue (SQS), function (Lambda), cache (Redis)
- Shows S3 trigger → SQS → Lambda flow
- Cache check before processing
- Output to S3 shown

### 7. ✅ Quality Requirements in User Prompt
**New 8-point quality checklist enforced:**
1. Classify intent first
2. Include ALL components needed (don't oversimplify)
3. Show COMPLETE flows (bidirectional)
4. Use specific, descriptive edge labels
5. Assign correct semantic shapes
6. Group logically with subgraphs
7. Ensure no dead-end nodes
8. Every component must serve clear purpose

### 8. ✅ Enhanced Detail Level Guidance
**Before:** Generic "keep it simple" / "moderate" / "full detail"

**After:** Specific requirements at each level:
- **Level 1:** Essential only BUT must still show complete request/response cycle
- **Level 2:** Standard + key supporting services + error paths + bidirectional edges
- **Level 3:** Comprehensive + secondary flows + async + monitoring + architectural notes

### 9. ✅ Architectural Notes Requirement
**New:** User prompt now asks for "1-3 architectural notes to explain non-obvious design decisions or important flows"

This helps explain:
- Why certain patterns are used
- How async processing works
- Where caching improves performance
- Security considerations
- Scaling strategies

## Anti-Patterns Enhanced
Added specific warnings:
- ❌ Do NOT show one-way connections when response path is important
- ❌ Do NOT create dead-end nodes with no outgoing edges (except final storage/logs)
- ❌ Do NOT omit database if system needs to persist data

## Expected Quality Improvements

### Before (Low Quality):
```
User → Service → Database
```
- One direction only
- No response path
- Generic labels
- Missing cache/auth

### After (High Quality):
```
Browser → Load Balancer → Auth Service → Cache (check) → Database
Database → Auth Service → Cache (store token) → Auth Service → Load Balancer → Browser
```
- Complete round trip
- Specific operations labeled
- Cache optimization shown
- Proper shapes (monitor, hexagon, shield, cache, cylinder)
- Architectural note explaining session management

## Impact

### Diagram Completeness ⬆️
- Shows full request/response cycles
- Includes necessary infrastructure (DB, cache, auth, queues)
- No orphaned nodes

### Connection Clarity ⬆️
- Descriptive edge labels (2-4 words with actual operations)
- Clear data flow direction
- Async vs sync patterns distinguished

### Visual Semantics ⬆️
- Correct shapes for each component type
- Recognizable at a glance (database vs queue vs cache)
- Consistent shape vocabulary

### Architectural Context ⬆️
- Notes explain design decisions
- Subgroups show system layers
- Complex flows documented

## Testing Recommendations

Try these prompts to validate improvements:

1. **"Design a user authentication system with OAuth"**
   - Should show: Browser, OAuth provider (cloud), auth service (shield), session cache, user DB
   - Complete flow: login request → OAuth redirect → callback → token validation → session creation → response

2. **"E-commerce order processing with payment gateway"**
   - Should show: API Gateway, Order service, Payment service, External payment API (Stripe/cloud), Inventory, Database, Queue, Email worker
   - Both sync (payment) and async (email) paths

3. **"Real-time chat application with Redis"**
   - Should show: Web/Mobile clients, Load balancer, Chat service, Redis pub/sub (cache shape), Message DB, WebSocket connections
   - Bidirectional message flow

4. **"Serverless image thumbnail generator"**
   - Should show: S3 bucket (bucket shape), Lambda (function shape), SQS queue, output S3, CloudFront (cloud)
   - Trigger → queue → process → store flow

## Files Modified
- `/Users/abhisheksureshjamdade/Desktop/ArchDraw/frontend/lib/ai/pipeline/mermaid-pipeline/plannerPrompts.ts`

## Breaking Changes
None - all changes are additive improvements to prompt quality.

## Next Steps
1. Test with diverse prompts (web apps, microservices, event-driven, serverless)
2. Monitor generated diagram quality
3. Collect user feedback on clarity and completeness
4. Iterate on examples if specific patterns are still unclear
