# Icon System Migration Guide

## Overview

This guide helps you migrate from the old icon system to the new role-first icon system with Kubernetes support and semantic colors.

## What Changed

### ✅ Automatic (No Action Required)

1. **Purple colors replaced** - All `#6366f1` automatically becomes semantic colors
2. **Kubernetes role icons** - etcd, API Server, etc. show role icons automatically
3. **Semantic color categories** - Icons get category-appropriate colors
4. **Backward compatibility** - All existing diagrams work without changes

### 🔧 Optional (Better Experience)

1. **Pass renderStyle to NodeIcon** - Enable mode-specific filtering
2. **Use semantic colors in custom code** - Import from `lib/semanticColors.ts`
3. **Leverage K8s role mappings** - Use standard K8s component names

## Migration Steps

### Step 1: Update NodeIcon Usage (Optional)

If you're using `NodeIcon` directly, pass the render style:

**Before:**
```typescript
<NodeIcon
  technology={tech}
  fallbackIcon={icon}
  fallbackColor={color}
  size={18}
/>
```

**After:**
```typescript
import type { RenderStyleId } from '@/lib/iconModeFilter';

<NodeIcon
  technology={tech}
  fallbackIcon={icon}
  fallbackColor={color}
  size={18}
  renderStyle={renderStyle} // 'sketch' or 'precision'
/>
```

### Step 2: Use Semantic Colors (Optional)

If you're setting node colors programmatically:

**Before:**
```typescript
const nodeColor = technology 
  ? iconRegistry[technology]?.color 
  : '#6366f1'; // generic purple
```

**After:**
```typescript
import { normalizeColor } from '@/lib/semanticColors';

const nodeColor = normalizeColor(
  iconRegistry[technology]?.color,
  iconName, // e.g., 'arch-database'
  isDark
);
```

### Step 3: Leverage Kubernetes Mappings (Optional)

Use standard Kubernetes component names for automatic role resolution:

**Good Names (Auto-Resolved):**
- `etcd` → key-value icon
- `API Server` → gateway icon
- `Scheduler` → scheduler icon
- `Controller Manager` → config icon
- `Kubelet` → agent icon
- `Pod` → container icon

**Avoid:**
- Generic names like "K8s Component" (fallback to generic k8s icon)
- Technology field `kubernetes` without descriptive label

## Common Scenarios

### Scenario 1: Kubernetes Diagram

**Goal**: Show control plane components with role-specific icons

**Before:**
```typescript
// All nodes show purple K8s logo
const nodes = [
  { label: 'K8s Component 1', technology: 'kubernetes' },
  { label: 'K8s Component 2', technology: 'kubernetes' },
  { label: 'K8s Component 3', technology: 'kubernetes' },
];
```

**After:**
```typescript
// Each shows role-specific icon and color
const nodes = [
  { label: 'etcd', technology: 'kubernetes' },           // → key-value (green)
  { label: 'API Server', technology: 'kubernetes' },     // → gateway (purple)
  { label: 'Scheduler', technology: 'kubernetes' },      // → scheduler (indigo)
];
```

### Scenario 2: Technology with Brand Logo

**Goal**: Show role in sketch mode, brand in precision mode

**Before:**
```typescript
// Always shows brand logo (may clash in sketch mode)
const node = {
  label: 'Session Cache',
  technology: 'redis',
};
```

**After (Automatic):**
```typescript
// Sketch mode: arch-cache glyph (matches hand-drawn style)
// Precision mode: Redis logo (recognizable brand)
const node = {
  label: 'Session Cache',
  technology: 'redis',
};
```

### Scenario 3: Generic Node Without Technology

**Goal**: Get semantic color instead of purple

**Before:**
```typescript
// Generic purple color
const node = {
  label: 'Message Queue',
  serviceType: 'queue',
};
// → icon: 'arch-message-queue', color: '#6366f1' (purple)
```

**After (Automatic):**
```typescript
// Semantic orange color
const node = {
  label: 'Message Queue',
  serviceType: 'queue',
};
// → icon: 'arch-message-queue', color: '#EA580C' (orange - async category)
```

## Testing Your Migration

### 1. Visual Inspection

Create test diagrams with these node types:

```typescript
const testNodes = [
  // Kubernetes components
  { label: 'etcd', technology: 'kubernetes' },
  { label: 'API Server', technology: 'kubernetes' },
  { label: 'Pod', technology: 'kubernetes' },
  
  // Technology brands
  { label: 'Cache', technology: 'redis' },
  { label: 'Queue', technology: 'kafka' },
  { label: 'Database', technology: 'postgresql' },
  
  // Generic nodes
  { label: 'Service', serviceType: 'service' },
  { label: 'Queue', serviceType: 'queue' },
  { label: 'Database', serviceType: 'database' },
];
```

**Expected Results:**
- ✅ K8s nodes show role icons (not all K8s logo)
- ✅ No purple (#6366f1) colors
- ✅ Sketch mode uses internal glyphs
- ✅ Precision mode may show brand logos
- ✅ Colors match semantic categories

### 2. Mode Toggle Test

1. Create diagram in **sketch mode**
2. Check: technology brands show as arch-* glyphs
3. Toggle to **precision mode**
4. Check: brands may show recognizable logos
5. Toggle back to **sketch mode**
6. Check: glyphs restored

### 3. Color Category Test

Check these categories have correct colors:

| Node Type | Expected Color | Category |
|-----------|---------------|----------|
| Service/Function | Cyan | compute |
| Database/Cache | Green/Emerald | data |
| Queue/Stream | Orange | async |
| API Gateway/Load Balancer | Purple | networking |
| Auth/Firewall | Red | security |
| K8s/Coordinator | Indigo | orchestration |
| Metrics/Logs | Pink | observability |

### 4. Regression Test

Verify existing diagrams still work:

1. Load old diagrams
2. Check: all nodes render correctly
3. Check: manual icon overrides respected
4. Check: cloud provider icons still work (AWS/Azure)
5. Check: no visual glitches or missing icons

## Troubleshooting

### Issue: Kubernetes node shows generic K8s icon

**Cause**: Label doesn't match known component names

**Solution**: Use standard names like `etcd`, `API Server`, `Scheduler`, `Pod`

```typescript
// ❌ Not recognized
{ label: 'K8s Storage' }

// ✅ Recognized
{ label: 'etcd' }
```

### Issue: Node still shows purple color

**Cause**: Explicit color set to `#6366f1`

**Solution**: Remove explicit color or use semantic color:

```typescript
// ❌ Explicit purple
{ label: 'Service', color: '#6366f1' }

// ✅ Semantic color (auto-resolved)
{ label: 'Service' }

// ✅ Or use semantic color explicitly
import { getSemanticColor } from '@/lib/semanticColors';
{ label: 'Service', color: getSemanticColor('compute') }
```

### Issue: Brand logo shows in sketch mode

**Cause**: `renderStyle` not passed to `NodeIcon`

**Solution**: Pass renderStyle prop:

```typescript
<NodeIcon
  technology="mongodb"
  renderStyle="sketch" // Add this
/>
```

### Issue: Custom icon not working

**Cause**: Icon name not normalized

**Solution**: Use arch-* prefix or Lucide alias:

```typescript
// ❌ Not recognized
{ icon: 'my-custom-icon' }

// ✅ Use arch-* prefix
{ icon: 'arch-service' }

// ✅ Or use Lucide alias (auto-converted)
{ icon: 'Database' } // → arch-database
```

## Rollback Plan

If you encounter issues, you can temporarily disable features:

### Disable Kubernetes Role Resolution

Comment out priority step #2 in `lib/nodeIconResolver.ts`:

```typescript
export function resolveNodeIcon(input: ResolveNodeIconInput): ResolvedNodeIcon {
  // ... step 1: manual override
  
  // DISABLED: Kubernetes role resolution
  // if (isKubernetesContext(...)) { ... }
  
  // ... continue with step 3
}
```

### Disable Mode-Specific Filtering

Always return precision mode in `lib/iconModeFilter.ts`:

```typescript
export function filterIconForMode(...): string {
  // DISABLED: Always use precision mode
  return iconName;
}
```

### Revert to Old Colors

Use old purple fallback in `lib/semanticColors.ts`:

```typescript
export const DEFAULT_SEMANTIC_COLOR = '#6366f1'; // Old purple
```

## Support

### Documentation
- **Architecture**: `docs/ICON-SYSTEM.md`
- **Summary**: `docs/ICON-SYSTEM-SUMMARY.md`
- **This guide**: `docs/ICON-SYSTEM-MIGRATION.md`

### Code References
- Icon resolution: `lib/nodeIconResolver.ts`
- Kubernetes mappings: `lib/kubernetes.ts`
- Semantic colors: `lib/semanticColors.ts`
- Mode filtering: `lib/iconModeFilter.ts`

### Testing
1. Create test diagrams with various node types
2. Toggle sketch/precision modes
3. Check console for warnings/errors
4. Verify visual output matches expectations

## FAQ

**Q: Will my existing diagrams break?**  
A: No, the system is fully backward compatible.

**Q: Do I need to update all my diagrams?**  
A: No, improvements apply automatically.

**Q: Can I still use manual icon overrides?**  
A: Yes, manual overrides have highest priority.

**Q: What if I don't want semantic colors?**  
A: Set explicit colors on nodes; they won't be overridden.

**Q: Can I add custom Kubernetes mappings?**  
A: Yes, edit `KUBERNETES_ROLE_MAP` in `lib/kubernetes.ts`.

**Q: How do I add a new semantic category?**  
A: Add to `SEMANTIC_COLOR_PALETTES` and `ICON_TO_CATEGORY` in `lib/semanticColors.ts`.

**Q: Can I disable mode-specific filtering?**  
A: Yes, don't pass `renderStyle` prop (defaults to precision).

## Next Steps

1. ✅ Read architecture docs: `docs/ICON-SYSTEM.md`
2. ✅ Review code changes in new files
3. ✅ Test with sample diagrams
4. ✅ Update custom code to use new features (optional)
5. ✅ Report any issues or unexpected behavior

## Success Metrics

After migration, you should see:

- ✅ **0% purple nodes** (all use semantic colors)
- ✅ **Kubernetes roles clear** (etcd, API Server, etc. distinguishable)
- ✅ **Sketch mode consistent** (no pasted-on brand logos)
- ✅ **Visual hierarchy** (colors communicate categories)
- ✅ **No regressions** (existing diagrams work)

The system is designed for seamless migration with immediate benefits!
