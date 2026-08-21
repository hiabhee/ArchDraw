# System Prompt Fixes - Architecture Planner

## Issues Found & Fixed

### 1. ✅ Missing New Semantic Shapes in Documentation
**Problem:** System prompt listed old shapes but didn't include the new semantic shapes added to the codebase:
- `queue` (horizontal message broker/Kafka/RabbitMQ)
- `cache` (Redis/Memcached)
- `function` (serverless/Lambda)
- `container` (Docker/containerized services)
- `bucket` (S3/blob storage)
- `document` (single file/API doc)
- `documents` (file collection)

**Fix:** Updated shape documentation in section 4 to include all new shapes with usage examples.

---

### 2. ✅ No Examples Using New Semantic Shapes
**Problem:** The 4 examples in the prompt only showed old shapes. The AI model wouldn't learn when to use `queue`, `cache`, `function`, `bucket`, etc.

**Fix:** 
- Updated Example 2 (Kafka) to use `queue` shape for the leader partition
- Added new Example 5 showing serverless architecture with:
  - `bucket` shape for S3 (input/output)
  - `queue` shape for SQS
  - `function` shape for Lambda
  - `cache` shape for Redis

---

### 3. ✅ Outdated Queue Syntax
**Problem:** Prompt mentioned `queue / event bus = horizontal pill ~[]` which is old Mermaid syntax.

**Fix:** Updated to show the proper archdraw-shape directive format:
```
%% archdraw-shape: {"id":"kafka","shape":"queue"}
kafka["Kafka"]
```

---

### 4. ✅ Reasoning Step 5 Too Generic
**Problem:** Step 5 just said "Shapes and subgraph grouping" without mentioning semantic shapes.

**Fix:** Updated to:
```
Step 5 - Shapes and subgraph grouping (use semantic shapes: cylinder for DB, 
queue for message brokers, cache for Redis, function for serverless, 
bucket for S3, etc.).
```

---

## What This Improves

1. **Better Shape Selection** - AI will now correctly use:
   - `queue` for Kafka/RabbitMQ/SQS instead of generic rectangles
   - `cache` for Redis/Memcached instead of cylinders
   - `function` for Lambda/serverless instead of rectangles
   - `bucket` for S3/Azure Blob instead of cylinders

2. **Consistent with Codebase** - Prompt now matches the shapes actually implemented in:
   - `/lib/utils/nodeSizing.ts` (SHAPE_TEXT_BAND, SHAPE_HEIGHT_RANGE)
   - `/components/ShapeNode.tsx` (shape rendering)
   - `/lib/shapeRegistry.ts` (SERVICE_TYPE_TO_SHAPE mappings)

3. **Learning by Example** - Example 5 demonstrates real-world serverless architecture with all the new semantic shapes working together.

---

## Files Modified
- `/Users/abhisheksureshjamdade/Desktop/ArchDraw/frontend/lib/ai/pipeline/mermaid-pipeline/plannerPrompts.ts`

## Related Context
- This complements the earlier fix to shape dimension recalculation when switching between cylinder/queue shapes
- Ensures AI-generated diagrams use the correct semantic shapes from the start
