# System Prompt Fixes - Quick Reference

## What Changed (TL;DR)

10 improvements to make AI-generated diagrams better and more consistent.

---

## 1. Intent Classification - More Examples ✅

**What:** Added 5 boundary examples to help AI classify user intent correctly.

**Why:** Edge cases like "How does Kafka integrate" were ambiguous.

**Now includes:**
- "Describe Kafka cluster" = EXPLAIN_CONCEPT
- "My app uses Kafka" = APPLICATION  
- "How does Kafka integrate with microservices" = APPLICATION
- "Kafka architecture best practices" = EXPLAIN_CONCEPT
- "Build event-driven system with Kafka" = APPLICATION

---

## 2. Smart Graph Direction ✅

**What:** AI now chooses LR (horizontal) vs TD (vertical) based on architecture type.

**Old:** Always LR unless user asks for TD  
**New:** 
- LR for workflows, pipelines, event chains
- TD for layered architectures (client → server → data)
- Default to LR if unclear

**Example:**
- "Event-driven order pipeline" → LR
- "Web app authentication" → TD

---

## 3. Slash Rule Relaxed ✅

**What:** Allow "/" in technical terms, but avoid in ambiguous cases.

**Old:** NO slashes ever  
**New:** 
- ✅ OK: "HTTP/REST", "TCP/UDP", "read/write cache"
- ❌ Bad: "request/response" → use "validates and responds"

---

## 4. Reasoning Scales with Size ✅

**What:** Bigger diagrams get more detailed reasoning.

**Old:** 2-3 sentences max (all diagrams)  
**New:**
- Small (≤8 nodes): 2-3 sentences
- Medium (9-15 nodes): 3-5 sentences
- Large (16-25 nodes): 5-8 sentences

---

## 5. Better Shape Documentation ✅

**What:** Every shape now shows directive example.

**Old:**
```
- queue: Kafka, RabbitMQ, SQS
```

**New:**
```
- queue: Kafka, RabbitMQ, SQS
  Example: %% archdraw-shape: {"id":"kafka","shape":"queue"}
           kafka["Kafka Cluster"]
```

All 14 shapes now have examples.

---

## 6. Infrastructure Example Added ✅

**What:** New Example 4 showing K8s deployment.

**Teaches:**
- INFRASTRUCTURE intent classification
- Nested subgraphs (pods within services)
- Graph TD for layered deployment
- ConfigMap/PersistentVolume patterns

---

## 7. Subgraph Nesting Guidance ✅

**What:** Clear rules for when/how to nest subgraphs.

**Rules:**
- Nest when multiple related components within a layer
- Max 2 levels deep
- Minimum 2 nodes per subgraph

**Example:**
```
subgraph Apps["Application Layer"]
  subgraph Frontend["Frontend Service"]
    frontend["Service"]
    pod1["Pod 1"]
  end
end
```

---

## 8. Enhanced Anti-Patterns ✅

**Added:**
- Don't use "/" unless standard tech term
- Don't nest subgraphs more than 2 levels
- Don't create subgraphs for single nodes

---

## 9. Detail Level + Reasoning ✅

**What:** Each detail level now specifies reasoning length.

- Level 1: "Reasoning: 2-3 sentences"
- Level 2: "Include 1-2 notes. Reasoning: 3-5 sentences"
- Level 3: "Include 2-3 notes. Reasoning: 5-8 sentences"

---

## 10. User Prompt Updated ✅

**What:** Quality requirements now match system prompt improvements.

**Added:**
- Choose direction wisely (LR vs TD)
- Nest subgraphs when needed
- Allow "/" for standard tech terms

---

## Impact Summary

### Before
- Intent classification unclear for edge cases
- All diagrams horizontal (LR)
- No "/" allowed anywhere
- All diagrams get 2-3 sentence reasoning
- Missing infrastructure example
- No nested subgraph guidance

### After
- 5 clear intent examples
- Smart direction choice (LR vs TD)
- "/" OK for tech terms
- Reasoning scales with complexity
- K8s example teaches nesting
- Clear nesting rules + examples

---

## Test Results

✅ All existing tests pass (7/7)

```bash
npm test -- lib/ai/pipeline/mermaid-pipeline/__tests__/plannerPrompts.test.ts
```

---

## Verification Prompts

Quick tests to verify improvements:

1. **"Describe Redis architecture"** → should be EXPLAIN_CONCEPT (internals)
2. **"User login flow with Redis cache"** → should be TD layout (layered)
3. **"Event pipeline with Kafka"** → should be LR layout (workflow)
4. **"Kubernetes deployment"** → should have nested subgraphs
5. Check labels for "HTTP/REST" (allowed) not "request/response" (forbidden)

---

## Files Changed

- `/lib/ai/pipeline/mermaid-pipeline/plannerPrompts.ts` (main prompt file)

## Documentation

- `SYSTEM_PROMPT_IMPROVEMENTS_V2.md` - Full detailed analysis
- `PROMPT_FIXES_QUICK_REFERENCE.md` - This file

---

## No Breaking Changes

✅ All changes are improvements  
✅ Tests pass  
✅ Backward compatible  
✅ No API changes
