# Edge Types: Sync & Async

## Overview
Added visual distinction between synchronous and asynchronous edges with easy toggle in the Properties Panel.

---

## ✅ Features Added

### **1. Sync Edge (Solid Line)**
- **Visual**: Solid line with arrow
- **Use Cases**: 
  - Synchronous HTTP calls
  - gRPC requests
  - Direct function calls
  - REST API requests
  - GraphQL queries
  - Database queries
- **Default**: All new edges are sync by default

### **2. Async Edge (Dashed Line)**
- **Visual**: Dashed line with arrow
- **Use Cases**:
  - Return/response messages
  - Async operations
  - Event responses
  - Message queue responses
  - Webhook callbacks
  - Async processing results
- **Pattern**: `8px dash, 6px gap`

---

## 🎨 Visual Distinction

### Sync (Solid)
```
Source ──────────────→ Target
      Synchronous call
```

### Async (Dashed)
```
Source ─ ─ ─ ─ ─ ─ → Target
      Return/response
```

---

## 🎯 How to Use

### **Method 1: Properties Panel (Recommended)**

1. **Select an edge** on the canvas
2. **Properties Panel** opens on the right
3. **Click "Sync" or "Async"** button
4. Edge updates instantly with visual change

### **Method 2: Context Menu**

1. **Right-click** an edge
2. Hover over **"Type"** submenu
3. Select **"Sync"** or **"Async"**

---

## 📋 Properties Panel UI

### Edge Type Selector

```
┌─────────────────────────────────┐
│ Edge Type                        │
├──────────────┬──────────────────┤
│   ────────→  │   ─ ─ ─ ─ ─ →   │
│   Sync       │   Async          │
│   Solid line │   Dashed line    │
└──────────────┴──────────────────┘
```

**Sync**: Synchronous calls (HTTP, gRPC, direct)  
**Async**: Return/response messages, async operations

---

## 🔧 Technical Implementation

### Files Modified

#### 1. **`components/PropertiesPanel.tsx`**
- Added edge type selector UI with visual icons
- Added `handleEdgeTypeChange` function
- Added `ArrowRight` icon import
- Calls `updateEdgeData` to update edge properties

#### 2. **`store/diagram/slices/edgeEditSlice.ts`**
- Added `updateEdgeData` method
- Updates edge data fields: `edgeType`, `connectionType`, `async`
- Persists changes to database
- Added to `EdgeEditSlice` type export

#### 3. **`store/diagram/types.ts`**
- Added `updateEdgeData: (edgeId: string, dataUpdates: Record<string, unknown>) => void`
- Type-safe edge data updates

### Edge Data Structure

When edge type is changed, the following properties are updated:

```typescript
{
  edgeType: 'sync' | 'async',
  connectionType: 'sync' | 'async',
  async: boolean,
}
```

### Existing Edge Rendering

The edge rendering logic already supports these properties:
- **Solid line**: `edgeType === 'sync'` (default)
- **Dashed line**: `edgeType === 'async'` or `async === true`
- Pattern: Defined in `/data/edgeTypes.ts`

---

## 📊 Edge Type Configurations

From `/data/edgeTypes.ts`:

```typescript
sync: {
  id: 'sync',
  label: 'Sync',
  color: '#3B82F6',      // Blue
  dash: '',               // Solid
  animated: false,
  markerEnd: true,
  pathType: 'Smoothstep',
}

async: {
  id: 'async',
  label: 'Async',
  color: '#F59E0B',      // Amber
  dash: '8 6',           // Dashed
  animated: true,         // Animated flow
  markerEnd: true,
  pathType: 'Smoothstep',
}
```

---

## 🎨 Design Patterns

### Common Architecture Patterns

**1. Request-Response**
```
Client ──────→ API Server
       (Sync)

Client ← ─ ─ ─ API Server
       (Async response)
```

**2. Message Queue**
```
Producer ──────→ Queue
         (Sync publish)

Queue ─ ─ ─ ─ → Consumer
       (Async consume)
```

**3. Async Processing**
```
Frontend ──────→ Backend
         (Sync submit)

Frontend ← ─ ─ ─ Backend
         (Async result)
```

**4. Event-Driven**
```
Service A ──────→ Event Bus
          (Sync emit)

Event Bus ─ ─ ─ ─ → Service B
          (Async delivery)
```

---

## 🔄 Workflow

### User selects edge
1. User clicks on an edge
2. Properties Panel appears on right
3. Current edge type is highlighted (Sync or Async)

### User changes type
1. User clicks "Sync" or "Async" button
2. `handleEdgeTypeChange()` is called
3. `updateEdgeData()` updates edge properties
4. Edge visual updates immediately (solid → dashed or vice versa)
5. Changes saved to database automatically

---

## 💡 Use Case Examples

### Sync Edges (Solid)
- ✅ REST API call: `Frontend → Backend API`
- ✅ Database query: `Service → PostgreSQL`
- ✅ gRPC call: `Service A → Service B`
- ✅ Function invocation: `Controller → Service`
- ✅ GraphQL query: `Client → GraphQL Server`

### Async Edges (Dashed)
- ✅ HTTP response: `API Server ─ ─ → Client`
- ✅ Kafka consume: `Kafka ─ ─ → Consumer`
- ✅ Webhook callback: `Payment Gateway ─ ─ → Backend`
- ✅ Event notification: `Event Bus ─ ─ → Subscriber`
- ✅ Async job result: `Worker ─ ─ → Queue`

---

## ✅ Verification

```bash
✅ ArrowRight icon imported: true
✅ Edge type selector added: true
✅ Sync button added: true
✅ Async button added: true
✅ handleEdgeTypeChange function: true
✅ updateEdgeData added to slice: true
✅ updateEdgeData type added: true
```

---

## 🎯 Benefits

### Visual Clarity
- **Instant recognition** of synchronous vs asynchronous flows
- **Standard notation** (solid = sync, dashed = async)
- **Clean diagrams** that communicate architecture intent

### User Experience
- **Simple toggle** in Properties Panel
- **No manual styling** required
- **Consistent across** all diagrams

### Architecture Communication
- **Clear data flow** visualization
- **Request/response** patterns visible
- **Async boundaries** highlighted

---

## 📝 Summary

Successfully added sync/async edge type distinction to ArchDraw:
- ✅ **Solid lines** for synchronous calls
- ✅ **Dashed lines** for async/return messages
- ✅ **Easy toggle** in Properties Panel
- ✅ **Visual icons** showing line style
- ✅ **Type-safe** implementation
- ✅ **Auto-persisted** changes

The feature integrates seamlessly with existing edge rendering logic and provides clear visual distinction between different communication patterns in architecture diagrams.

---

*Last Updated: 2026-08-16*
*Edge Types: 2 (Sync, Async)*
