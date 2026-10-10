# Quick Fix for Missing Node Labels

## Problem
Some nodes show only icons without labels/titles.

## Instant Fix (No Code Changes Needed)

### Method 1: Browser Console Command
1. Open your app in the browser
2. Press **F12** to open Developer Tools
3. Go to the **Console** tab
4. Paste this command and press Enter:

```javascript
// Import the store (if not already available)
const { useDiagramStore } = await import('./store/diagramStore');

// Run the fix
useDiagramStore.getState().fixMissingLabels();
```

This will:
- Find all nodes with empty labels or `iconOnly: true`
- Set default "Service" label if missing
- Set `iconOnly: false` to show labels
- Display a success toast notification

### Method 2: Individual Node Fix
1. Click on a node that's missing its label
2. Open the Properties Panel (right sidebar)
3. Scroll to "Label display" section
4. Click "With label" button

### Method 3: Check Icon Mode Setting
1. Look for the icon toggle button in the toolbar (image icon)
2. Make sure it's set to "On" (not "Off")
3. If icons are off, labels should still show - but if both are missing, use Method 1

## Permanent Solution (Already Implemented)

The code now includes a `fixMissingLabels()` function in the diagram store that you can call anytime:

```typescript
// From anywhere in your app:
useDiagramStore.getState().fixMissingLabels();
```

## Adding a UI Button (Optional)

If you want a button in the UI to fix this, add to your Toolbar or Settings:

```tsx
import { useDiagramStore } from '@/store/diagramStore';

function FixLabelsButton() {
  const fixMissingLabels = useDiagramStore((s) => s.fixMissingLabels);
  
  return (
    <button
      onClick={fixMissingLabels}
      className="px-3 py-2 rounded-lg bg-primary text-white text-sm"
      title="Fix nodes with missing labels"
    >
      Fix Labels
    </button>
  );
}
```

## What Was Changed

1. **Fixed icon visibility logic** - Manual icons now show in "normal" mode
2. **Added `fixMissingLabels()` function** - Utility to batch-fix label issues
3. **Updated documentation** - Clear guides for fixing the issue

## Prevention

When creating new nodes, always:
1. Provide a `label` in node data
2. Don't set `iconOnly: true` unless you specifically want icon-only display
3. Use the icon visibility toggle for global icon control, not per-node settings

## Testing

Run this to see which nodes have issues:

```javascript
const { useDiagramStore } = await import('./store/diagramStore');
const nodes = useDiagramStore.getState().nodes;

const problematic = nodes.filter(n => 
  !n.data?.label || 
  n.data.label.trim() === '' || 
  n.data.iconOnly === true
);

console.log('Problematic nodes:', problematic.map(n => ({
  id: n.id,
  label: n.data?.label,
  iconOnly: n.data?.iconOnly
})));
```
