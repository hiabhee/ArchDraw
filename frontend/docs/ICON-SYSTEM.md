# Icon System Architecture

## Overview

ArchDraw uses a **role-first icon system** that prioritizes component function over technology branding. This ensures diagrams communicate architecture clearly, especially in sketch mode where hand-drawn aesthetics require visual consistency.

## Design Principles

1. **Icons represent role first, technology second, theme compatibility third**
2. **One icon contract per render style**: sketch mode prefers internal glyphs, precision mode allows brand logos
3. **Semantic colors** replace generic fallbacks with category-appropriate colors
4. **Kubernetes components show their specific role**, not just a generic K8s logo
5. **No purple fallback plague**: every icon category has a meaningful color

## Two Visual Systems

### Internal Glyph System (arch-*)
- **100+ custom SVG glyphs** in `CustomNodeIcon.tsx`
- Thin line icons (strokeWidth: 1.4-1.8)
- Consistent optical sizing (24x24 viewBox)
- Match hand-drawn sketch style
- Examples: `arch-database`, `arch-api-gateway`, `arch-message-queue`

### External Brand System
- **Simple Icons CDN** for third-party logos
- **AWS/Azure provider icons** as SVG glyphs
- Different visual density and proportions
- Used strategically in precision mode

## Icon Resolution Priority Chain

The system uses a **10-step priority chain** to resolve icons:

### 1. Manual Override
Explicit icon set from properties panel (arch-*, aws-*, azure-*)
- **Source**: `manual`
- **When**: User explicitly chose an icon

### 2. Kubernetes Role Resolution 🆕
Kubernetes components resolve to their specific role icon
- **Source**: `kubernetes-role`
- **Examples**:
  - `etcd` → `arch-key-value` (not generic k8s logo)
  - `API Server` → `arch-api-gateway`
  - `Scheduler` → `arch-scheduler`
  - `Pod` → `arch-docker`
  - `Kubelet` → `arch-agent`
- **Mapping**: `lib/kubernetes.ts`

### 3. Technology Registry
Technology field maps to icon + brand color
- **Source**: `technology`
- **Examples**:
  - `technology: 'redis'` → `arch-cache` (orange)
  - `technology: 'kafka'` → `arch-event-stream` (black)
  - `technology: 'aws-s3'` → AWS S3 icon (green)
- **Registry**: `lib/iconRegistry.ts`

### 4. Cloud Provider Affinity
AWS/Azure from palette or repo import
- **Source**: `technology`
- **Detection**: `typeId`, `componentId`, `technology`, or `icon` starts with `aws-` or `azure-`

### 5. Cloud Service Classification
Label-based AWS/Azure service matching
- **Source**: `label`
- **Classifier**: `lib/cloudIcons/classifier.ts`

### 6. Component Type
Palette component mappings
- **Source**: `component`
- **Examples**: `microservice` → `arch-service`, `sql_db` → `arch-database`

### 7. Lucide → Arch Aliases
Property panel icon names mapped to arch-* glyphs
- **Source**: `manual`
- **Examples**: `Database` → `arch-database`, `Server` → `arch-server`
- **Aliases**: `lib/iconAliases.ts`

### 8. Label Pattern Matching
Regex patterns on node label
- **Source**: `label`
- **Examples**: 
  - Label contains "redis" → `arch-cache`
  - Label contains "scheduler" → `arch-scheduler`

### 9. Service Type
High-level service category
- **Source**: `serviceType`
- **Examples**: `queue` → `arch-message-queue`, `cache` → `arch-cache`

### 10. Fallback
- **Source**: `fallback`
- **Icon**: `arch-service`
- **Color**: Semantic cyan

## Mode-Specific Rendering

### Sketch Mode
- **Prefers internal arch-* glyphs** to match hand-drawn aesthetic
- **70+ technology brands replaced** with role glyphs:
  - `mongodb` → `arch-document-db`
  - `kubernetes` → `arch-kubernetes`
  - `redis` → `arch-cache`
  - `kafka` → `arch-event-stream`
- **Why**: Brand logos look "pasted on" in sketch mode
- **Implementation**: `lib/iconModeFilter.ts`

### Precision Mode
- **Allows all brand logos** when they add recognition
- **AWS/Azure icons always shown** (already role-appropriate glyphs)
- **Why**: Clean, technical diagrams benefit from recognizable brands

## Semantic Color System 🆕

Replaces legacy purple (#6366f1) with **10 semantic categories**:

| Category | Color | Use Case |
|----------|-------|----------|
| **compute** | Cyan (teal) | Servers, services, functions, workers |
| **data** | Emerald (green) | Databases, caches, storage |
| **async** | Orange | Queues, streams, events, messaging |
| **external** | Stone (gray) | Third-party APIs, external services |
| **security** | Red (rose) | Auth, firewall, secrets, encryption |
| **orchestration** | Indigo | Kubernetes, coordinators, config |
| **networking** | Purple | Routing, CDN, DNS, proxies |
| **observability** | Pink (magenta) | Metrics, logs, traces, monitoring |
| **ai** | Violet | ML models, embeddings, agents |
| **integration** | Amber | Webhooks, payments, email, chat |

**Implementation**: `lib/semanticColors.ts`

## Kubernetes-Specific Handling

### Problem
Every Kubernetes node (etcd, API Server, Scheduler, Pod) was showing the same purple Kubernetes logo. The role of each component was lost.

### Solution
**50+ Kubernetes component mappings** in `lib/kubernetes.ts`:

```typescript
const KUBERNETES_ROLE_MAP = {
  'etcd': { icon: 'arch-key-value', category: 'data' },
  'api server': { icon: 'arch-api-gateway', category: 'networking' },
  'scheduler': { icon: 'arch-scheduler', category: 'orchestration' },
  'controller manager': { icon: 'arch-config', category: 'orchestration' },
  'kubelet': { icon: 'arch-agent', category: 'compute' },
  'pod': { icon: 'arch-docker', category: 'compute' },
  // ... 40+ more
};
```

### Detection
- Label contains kubernetes keywords: `kubernetes`, `k8s`, `kube-`, `eks`, `aks`, `gke`
- Technology field: `technology: 'kubernetes'`

### Resolution
1. Check if node is in Kubernetes context
2. Look up component by normalized label
3. Return role-specific icon and category color
4. Falls back to generic `arch-kubernetes` if no match

## Code Organization

```
lib/
├── kubernetes.ts              # K8s component role mappings
├── semanticColors.ts          # Category-based color system
├── iconModeFilter.ts          # Sketch vs precision filtering
├── nodeIconResolver.ts        # Main 10-step priority chain
├── iconRegistry.ts            # Technology → icon + color registry
├── iconAliases.ts             # Lucide → arch-* mappings
├── archIconCatalog.ts         # All 100+ arch-* icon definitions
└── cloudIcons/
    ├── classifier.ts          # AWS/Azure service classification
    ├── resolution.ts          # Cloud icon toggle resolution
    └── autoResolution.ts      # Per-node provider resolution

components/
├── NodeIcon.tsx               # Icon rendering orchestrator
└── icons/
    ├── CustomNodeIcon.tsx     # All arch-* glyph SVGs
    ├── TechnologyBrandIcon.tsx # Simple Icons CDN loader
    ├── ProviderServiceIcon.tsx # AWS/Azure icon router
    └── CloudProviderIcon.tsx   # Cloud provider SVG glyphs
```

## Usage Examples

### Creating Kubernetes Diagrams

**Before** (all purple K8s logos):
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ 🐳 etcd     │  │ 🐳 API Srv  │  │ 🐳 Scheduler│
│ (purple)    │  │ (purple)    │  │ (purple)    │
└─────────────┘  └─────────────┘  └─────────────┘
```

**After** (role-specific icons):
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ 🗃️ etcd     │  │ 🌐 API Srv  │  │ ⏰ Scheduler│
│ (green)     │  │ (purple)    │  │ (indigo)    │
└─────────────┘  └─────────────┘  └─────────────┘
   key-value        gateway          scheduler
```

### Sketch vs Precision Mode

**Sketch Mode** (role-first):
```typescript
// Node with technology: 'mongodb'
// Renders: arch-document-db (green document icon)
// Why: In hand-drawn diagrams, role > brand recognition
```

**Precision Mode** (brand-aware):
```typescript
// Node with technology: 'mongodb'
// Renders: MongoDB leaf logo from Simple Icons
// Why: Technical diagrams benefit from brand recognition
```

### Semantic Colors

**Before**:
```typescript
// Everything without explicit color → purple #6366f1
resolveNodeIcon({ label: 'Redis Cache' })
// → { icon: 'arch-cache', color: '#6366f1' } ❌
```

**After**:
```typescript
// Category-based semantic colors
resolveNodeIcon({ label: 'Redis Cache' })
// → { icon: 'arch-cache', color: '#EA580C' } ✅ (orange - data/cache)

resolveNodeIcon({ label: 'API Gateway' })
// → { icon: 'arch-api-gateway', color: '#9333EA' } ✅ (purple - networking)

resolveNodeIcon({ label: 'Worker Queue' })
// → { icon: 'arch-message-queue', color: '#F97316' } ✅ (orange - async)
```

## Migration Notes

### Breaking Changes
None - system is fully backward compatible.

### New Features
1. Kubernetes role resolution (priority #2)
2. Mode-specific icon filtering (sketch/precision)
3. Semantic color categories
4. Purple (#6366f1) automatically replaced

### Opt-In Behavior
- **Render style** must be passed to `NodeIcon` for mode filtering
- **Default**: precision mode (no filtering) for backward compatibility

## Future Improvements

1. **User-defined role mappings**: Allow workspace-specific icon→role overrides
2. **Icon size normalization**: Optical adjustments for very complex vs simple glyphs
3. **Dark mode color variants**: All semantic colors have light/dark variants defined
4. **Animation support**: Prepare for animated icon states (loading, error, healthy)
5. **Accessibility**: ARIA labels for screen readers describing icon role

## Testing

### Manual Testing Checklist
- [ ] Create Kubernetes diagram with etcd, API Server, Scheduler, Pod
- [ ] Verify each shows role-specific icon (not all K8s logo)
- [ ] Toggle sketch vs precision mode
- [ ] Verify brand logos hide in sketch, show in precision
- [ ] Check no purple (#6366f1) icons remain
- [ ] Verify semantic colors: orange for queues, green for databases, etc.

### Visual Regression
Compare before/after screenshots:
1. Kubernetes control plane diagram
2. Microservices with Redis, Kafka, PostgreSQL
3. Sketch mode with technology brands
4. Precision mode with same brands

## References

- [Simple Icons](https://simpleicons.org/) - Third-party brand logos
- [Lucide Icons](https://lucide.dev/) - Generic fallback icons
- [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) - Official AWS glyphs
- [Tailwind Colors](https://tailwindcss.com/docs/customizing-colors) - Semantic color palette

## Contributors

This system was designed to solve the "two visual systems fighting" problem where technology branding leaked into nodes that should communicate their architectural role first.

**Problem**: Everything purple and branded, especially in Kubernetes diagrams.
**Solution**: Role-first icon priority, mode-specific rendering, semantic colors.
