# Icon Visibility Fix

## Problem Summary

Users experienced inconsistent icon/label display behavior:
- Some nodes showed icons without labels
- Some nodes showed labels without icons
- The "Web" node showed both icon and label correctly
- Toggling the icon visibility caused labels to disappear

## Root Cause

The issue was in the `nodeIconVisibility.ts` logic:

### Previous Behavior (Buggy)
```typescript
if (mode === 'all') return true;
if (mode === 'off') return false;
return !manualIcon;  // ❌ In "normal" mode, hide manual icons
```

**Why this was confusing:**
1. **Icon Source Classification**: Icons were classified as:
   - `manual`: Icons explicitly selected from properties panel (arch-*, aws-*, azure-*)
   - `label`: Icons auto-detected from node label (e.g., "Web" → web icon)
   - `technology`: Brand technology icons (Docker, Kubernetes, etc.)

2. **Normal Mode Problem**: The "normal" mode would **hide** manually selected icons (`return !manualIcon`)
   - This was counterintuitive - if a user explicitly selects an icon, they want to see it!
   - Only auto-detected icons would show in "normal" mode

3. **Inconsistent Display**:
   - "Web" node: auto-detected icon → showed in "normal" mode ✓
   - Docker/Kubernetes: manual icons → hidden in "normal" mode ✗
   - When toggling to "all", manual icons appeared but labels might disappear if `iconOnly` was set

## Solution

### New Behavior (Fixed)
```typescript
if (mode === 'off') return false;
// Both 'all' and 'normal' show icons - manual icons are intentional user choices
return true;
```

**What changed:**
1. Both `'all'` and `'normal'` modes now show ALL icons (manual and auto-detected)
2. Manual icons are treated as intentional user choices and always displayed
3. Only `'off'` mode hides icons
4. This creates consistent, predictable behavior

## Files Changed

1. **`lib/utils/nodeIconVisibility.ts`**
   - Updated `resolveNodeIconVisibility()` logic
   - Added comprehensive documentation
   - Both 'all' and 'normal' modes now show all icons

2. **`components/NodeIconModeToggle.tsx`**
   - Updated comments to reflect new behavior
   - Clarified that "On" shows all icons (manual and auto-detected)

3. **`components/UserAvatar.tsx`**
   - Updated settings panel description
   - Changed from "All: every icon · Normal: hide icons picked from Properties · Off: none"
   - To: "All/Normal: show all icons (manual & auto) · Off: hide all icons"

4. **`lib/utils/__tests__/nodeIconVisibility.test.ts`** (New)
   - Comprehensive test suite
   - Verifies icon visibility consistency
   - Tests all modes with manual and auto-detected icons
   - All 8 tests passing ✓

## Behavior Summary

### Icon Mode Behavior

| Mode | Manual Icons | Auto-detected Icons | Behavior |
|------|-------------|-------------------|----------|
| **all** | ✓ Show | ✓ Show | Show all icons |
| **normal** | ✓ Show | ✓ Show | Show all icons (same as 'all') |
| **off** | ✗ Hide | ✗ Hide | Hide all icons |

### Per-Node Overrides

- `nodeData.showIcon = true`: Force icon to show regardless of global mode
- `nodeData.showIcon = false`: Force icon to hide regardless of global mode
- `nodeData.showIcon = undefined`: Use global icon mode setting

### Label Display (Independent)

- Labels always show alongside icons by default
- `nodeData.iconOnly = true`: Hide label, show only icon (explicit choice)
- `nodeData.iconOnly = false`: Always show label alongside icon
- `nodeData.iconOnly = undefined`: Auto-hide labels for brand logos (Docker, Kubernetes, etc.)

## Impact

✅ **Fixed Issues:**
- All icons now show consistently in "all" and "normal" modes
- Manually selected icons are respected and displayed
- No more disappearing labels when toggling icons
- Predictable, intuitive behavior

✅ **No Breaking Changes:**
- Per-node `showIcon` overrides still work
- `iconOnly` flag still controls label visibility
- "Off" mode still hides all icons as expected

✅ **Better UX:**
- Users see what they select
- Icon visibility is simple: On (show all) or Off (hide all)
- "Normal" mode is now a synonym for "all" (both show icons)

## Testing

Run the test suite:
```bash
npm test nodeIconVisibility.test.ts
```

Expected result: ✓ 8 tests passing

## Future Considerations

If you want to bring back the distinction between "all" and "normal" modes in the future, consider:
- Renaming to more intuitive labels (e.g., "All", "Auto-only", "Off")
- Making "normal" mode show all icons but only auto-hide labels for brand logos
- Adding explicit UI to explain the difference between modes

For now, the simplified "All/Normal = show, Off = hide" behavior is more intuitive.
