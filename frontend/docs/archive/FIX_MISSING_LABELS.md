# Fix for Missing Node Labels

## Problem
Some nodes are showing only icons without any labels/titles.

## Possible Causes

1. **`iconOnly: true` flag is set** on those nodes
2. **Empty or missing `label` property** in node data
3. **CSS hiding the label** (unlikely based on code review)
4. **ShapeNode `autoIconOnly` logic** for brand logos (Docker, Kubernetes)

## How to Fix

### Option 1: Check Individual Nodes
1. Click on a node that's missing its label
2. Open the Properties Panel (right sidebar)
3. Look for "Label display" section
4. Make sure it's set to "With label" not "Icon only"

### Option 2: Reset All Nodes to Show Labels
Open the browser console (F12) and run:

```javascript
// Get the diagram store
const store = window.__ZUSTAND_STORE__ || useDiagramStore.getState();

// Fix all nodes to show labels
const nodes = store.nodes.map(node => ({
  ...node,
  data: {
    ...node.data,
    iconOnly: false  // Force labels to show
  }
}));

store.setNodes(nodes);
```

### Option 3: Check for Empty Labels
```javascript
// Find nodes with empty or missing labels
const nodesWithoutLabels = store.nodes.filter(n => !n.data.label || n.data.label.trim() === '');

console.log('Nodes without labels:', nodesWithoutLabels.map(n => ({ 
  id: n.id, 
  label: n.data.label,
  iconOnly: n.data.iconOnly 
})));

// Fix them
const fixed = store.nodes.map(node => ({
  ...node,
  data: {
    ...node.data,
    label: node.data.label || 'Service',  // Add default label if missing
    iconOnly: false  // Ensure label shows
  }
}));

store.setNodes(fixed);
```

### Option 4: Bulk Fix via Store Action
Add this to your diagram store for a one-time fix:

```typescript
// In graphSlice.ts, add this action:
fixMissingLabels: () => {
  const state = get();
  const fixed = state.nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      label: node.data.label || 'Service',
      iconOnly: false
    }
  }));
  set({ nodes: fixed });
}
```

Then call it from console:
```javascript
useDiagramStore.getState().fixMissingLabels();
```

## For ShapeNode Brand Logos

If you're using cylindrical or diamond shapes with Docker/Kubernetes/etc logos, they have special `autoIconOnly` behavior.

To force labels to show on these:

1. Select the node
2. In Properties Panel, find "Label display"
3. Change from "Auto" to "With label"

Or via code:
```javascript
const fixed = store.nodes.map(node => ({
  ...node,
  data: {
    ...node.data,
    iconOnly: false  // Override auto behavior
  }
}));
store.setNodes(fixed);
```

## Prevention

To prevent this in the future, ensure when creating nodes that:

1. Always provide a `label` in node data
2. Don't set `iconOnly: true` unless intentionally wanting icon-only display
3. For brand technology nodes, explicitly set `iconOnly: false` if you want labels

Example:
```typescript
addNode({
  id: 'docker-1',
  type: 'systemNode',
  position: { x: 100, y: 100 },
  data: {
    label: 'Docker Container',  // ✓ Always include label
    icon: 'Docker',
    iconOnly: false,  // ✓ Explicitly show label
    category: 'Container',
    color: '#2496ED'
  }
});
```
