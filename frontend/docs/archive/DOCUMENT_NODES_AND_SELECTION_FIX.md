# Document Nodes & Double Stroke Selection Fix

## Overview
Added document and multiple-document node shapes to ArchDraw with proper stacked visualization, and fixed the double stroke issue that appeared when selecting nodes.

---

## ✅ Issues Fixed

### 1. **Double Stroke on Node Selection** (FIXED)

**Problem:**
- When selecting a node, two colored strokes appeared around it (double border effect)
- Caused by ReactFlow's default `box-shadow: 0 0 0 0.5px #1a192b` conflicting with ArchDraw's custom selection shadow

**Solution:**
- Added CSS override in `app/globals.css` to disable ReactFlow's default selection shadow:
```css
/* Override ReactFlow's default selection box-shadow to prevent double stroke */
.react-flow__node.selected,
.react-flow__node.selected:focus,
.react-flow__node.selected:focus-visible {
  box-shadow: none !important;
}
```

**Result:**
- ✅ Single, clean stroke around selected nodes
- ✅ Selection color matches node accent color
- ✅ No visual artifacts or double borders

---

## ✅ Features Added

### 2. **Document Node Shape**

**Visual Design:**
- Single document with folded corner at top-right
- 3 horizontal lines representing text content
- Clean, recognizable document silhouette

**Use Cases:**
- Configuration files
- Reports
- Documentation
- Contracts
- Specifications
- README files

**Technical Implementation:**
- Shape type: `'document'`
- Folded corner size: 15% of width (minimum 12px)
- Text lines: 3 horizontal lines at 35%, 47%, 59% height
- Default color: `#64748B` (neutral gray)

### 3. **Documents Node Shape (Multiple Stacked)**

**Visual Design:**
- 3 stacked documents with offset layers
- Front document shows full detail (folded corner + text lines)
- Middle and back layers visible with progressive offset
- Creates depth perception showing multiple documents

**Use Cases:**
- Document collections
- File sets
- Multiple records
- Archives
- Document repositories
- Configuration sets

**Technical Implementation:**
- Shape type: `'documents'`
- Stack pattern: 3 layers offset by 6px each
- Back layer: offset (+12px, -12px), size reduction 12px
- Middle layer: offset (+6px, -6px), size reduction 6px
- Front layer: full size at (0, 0)
- 2 text lines on front document only

---

## 📁 Files Modified

### 1. **`app/globals.css`**
- Added CSS override to fix double stroke on selected nodes
- Prevents ReactFlow's default selection shadow from interfering

### 2. **`lib/shapeRegistry.ts`**
- Added `'document'` to `ShapeType` union
- Added `'documents'` to `ShapeType` union
- Added `DOCUMENT` and `DOCUMENTS` to `VARIANT_TO_SHAPE` mapping
- Updated `SUPPORTED_SHAPES` array

### 3. **`lib/theme/shapeGeometry/index.ts`**
- Added `documentPrimitives()` function
  - Creates document body with folded corner path
  - Adds folded corner triangle
  - Renders 3 text content lines
- Added `documentsPrimitives()` function
  - Creates 3-layer stacked document effect
  - Each layer has document body + folded corner
  - Front layer includes 2 text lines
- Updated `getShapePrimitives()` switch statement

### 4. **`components/ShapeNode.tsx`**
- Added `Document` component
  - Renders single document with SVG primitives
  - Supports both precision and sketch render modes
  - Handles selection states
- Added `Documents` component
  - Renders stacked documents with SVG primitives
  - Supports both precision and sketch render modes
  - Handles selection states
- Updated `renderShape()` switch to include both new shapes

### 5. **`data/db-components.json`**
- Added "Document" component entry:
  ```json
  {
    "id": "document",
    "label": "Document",
    "category": "Documentation",
    "color": "#64748B",
    "technology": "document"
  }
  ```
- Added "Documents" component entry:
  ```json
  {
    "id": "documents",
    "label": "Documents",
    "category": "Documentation",
    "color": "#64748B",
    "technology": "documents"
  }
  ```

---

## 🎨 Visual Specifications

### Document Node
```
┌─────────────────┐
│ ╱             │
│╱──────────────┤  ← Folded corner
│               │
│  ───────────  │  ← Text line 1
│               │
│  ───────────  │  ← Text line 2
│               │
│  ───────────  │  ← Text line 3
│               │
└───────────────┘
```

### Documents Node (Stacked)
```
    ┌──────────┐
   ┌┼──────────┤  ← Back layer (offset)
  ┌┼┼──────────┤  ← Middle layer (offset)
 ┌┼┼┼╱─────────┤  ← Front layer (full detail)
 │╱─────────   │
 │  ─────────  │  ← Text lines
 │  ─────────  │
 └─────────────┘
```

---

## 🔧 Usage

### Adding Document Nodes

**Via Command Palette (⌘K):**
1. Press `⌘K` to open Command Palette
2. Search "document" → Add single document node
3. Search "documents" → Add stacked documents node

**Programmatically:**
```typescript
const documentNode = {
  id: 'doc-1',
  type: 'shape',
  position: { x: 100, y: 100 },
  data: {
    label: 'API Spec',
    shape: 'document',
    color: '#64748B',
  },
};

const documentsNode = {
  id: 'docs-1',
  type: 'shape',
  position: { x: 300, y: 100 },
  data: {
    label: 'Documentation',
    shape: 'documents',
    color: '#64748B',
  },
};
```

### Selection Behavior
- Single stroke with node's accent color
- No double borders or visual artifacts
- Clean, professional appearance
- Consistent across all shape types

---

## ✅ Testing Checklist

- [x] JSON files validated (no syntax errors)
- [x] TypeScript types updated correctly
- [x] Document primitives render correctly
- [x] Documents stack pattern renders correctly
- [x] Both shapes available in Command Palette
- [x] Selection styling fixed (no double stroke)
- [x] Shapes work in both light and dark mode
- [x] Sketch mode rendering works
- [x] Labels display correctly
- [x] Connection handles appear on selection

---

## 📊 Component Registry Stats

**Before:** 128 components
**After:** 130 components (+2)

**New Category:** Documentation
- Document (single)
- Documents (stacked)

---

## 🎯 Architecture Decision

### Why Document Shapes?

1. **Common Use Case**: Documentation, configuration files, and reports are fundamental architecture components
2. **Visual Clarity**: Distinct folded-corner silhouette is universally recognized
3. **Stack Pattern**: Multiple documents pattern clearly communicates collections/sets
4. **Semantic Meaning**: Separates data storage (cylinder) from documentation (document)

### Shape Geometry Approach

**Single Document:**
- Folded corner: 15% of width (responsive to node size)
- Text lines: 3 lines for visual balance
- Clean paths for crisp rendering

**Stacked Documents:**
- 3-layer depth for clear stacking without clutter
- Progressive size reduction (12px, 6px, 0px)
- Offset pattern creates 3D perspective
- Only front layer shows text detail (performance optimization)

---

## 🚀 What's Next

### Potential Enhancements
1. **More Document Variants:**
   - Sealed document (with stamp icon)
   - Signed document (with signature line)
   - Encrypted document (with lock icon)

2. **Additional Shapes:**
   - Folder (for grouping documents)
   - Archive box (for stored documents)
   - File cabinet (for document repositories)

3. **Interactive Features:**
   - Document preview on hover
   - Badge/counter for document count
   - Color coding by document type

---

## 📝 Summary

Successfully added document visualization capabilities to ArchDraw:
- ✅ **2 new shape types**: `document` and `documents`
- ✅ **Clean stacking pattern** for multiple documents
- ✅ **Fixed double stroke bug** on node selection
- ✅ **Accessible via Command Palette** (⌘K)
- ✅ **Full render mode support** (precision + sketch)
- ✅ **130 total components** in registry

The document shapes provide a clear, recognizable way to represent documentation, configuration files, and document collections in architecture diagrams, complementing the existing database, service, and infrastructure node types.

---

*Last Updated: 2026-08-16*
*Total Shape Types: 20*
*Total Components: 130*
