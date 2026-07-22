# UI/UX Components Mismatch Analysis
## What Exists vs What's Needed for Feature Gating

**Generated**: 2026-07-22  
**Reference**: FEATURE_GATING_PLAN.md

---

## ❌ MISSING Components (Need to Create)

### 1. **QuotaIndicator.tsx** 
**Status**: Does not exist  
**Needed for**: Floating quota reminder for guests  
**Priority**: High  
**Location**: `components/QuotaIndicator.tsx`

**What it should do**:
- Show guest users remaining AI generations (e.g., "2/3 left this hour")
- Display "Sign in for more" CTA
- Float in bottom-right corner
- Hide for authenticated users
- Fetch quota status from `/api/user/quota`

**Current workaround**: None - guests have no visibility into quotas

---

### 2. **UpgradeModal.tsx**
**Status**: Does not exist  
**Needed for**: Feature-blocked CTA with benefits list  
**Priority**: High  
**Location**: `components/UpgradeModal.tsx`

**What it should do**:
- Show when guest hits feature limit (export SVG, share, etc.)
- Display specific benefits of signing in
- Clear "Sign in with Google" button
- "Maybe later" dismiss option
- Better conversion than current EmailCaptureModal

**Current implementation**: `EmailCaptureModal.tsx` (too simple, lacks benefit explanation)

---

### 3. **Quota Status API Endpoint**
**Status**: Does not exist  
**Needed for**: Real-time quota display in UI  
**Priority**: High  
**Location**: `app/api/user/quota/route.ts`

**What it should return**:
```typescript
{
  tier: 'guest' | 'authenticated',
  aiGenerations: {
    used: 2,
    limit: 3,
    window: 'hour' | 'day',
    resetAt: '2026-07-22T15:00:00Z'
  },
  canvases: {
    current: 1,
    limit: 5
  }
}
```

**Current workaround**: None - no API to query quota status

---

## ⚠️ INCOMPLETE Components (Need Updates)

### 4. **components/Toolbar.tsx**
**Current state**: Basic guest blocks with `EmailCaptureModal`  
**What's missing**:
- ✅ Has: `isGuest` check for export/share
- ❌ Missing: Quota-aware messaging (doesn't show WHY blocked)
- ❌ Missing: Different CTAs per feature (export vs share should have different messaging)
- ❌ Missing: PNG watermark flag for guests
- ❌ Missing: SVG export block (currently allows JSON for guests - should be JSON + PNG only)

**Lines to update**: 448-453, 529-532

**Recommended changes**:
```typescript
// Instead of simple EmailCapture modal
if (!quotas.allowedExportFormats.includes(format)) {
  setUpgradeModal({
    feature: 'export',
    message: `${format.toUpperCase()} export requires sign in`,
    benefits: ['Export PNG, SVG, JSON', 'No watermarks', '...']
  });
  return;
}
```

---

### 5. **components/dashboard/DashboardClient.tsx**
**Current state**: Shows static placeholder metrics  
**What's missing**:
- ❌ No quota usage cards
- ❌ No "Upgrade" banner for guests
- ❌ Shows hardcoded "5 canvases, 100 AI credits" (not enforced)
- ❌ No real-time quota fetching

**Lines to update**: 170-310 (metrics section)

**What exists**:
```tsx
// Line 307-309: Fake "Upgrade" button (doesn't work)
<button className="...">Upgrade</button>
```

**What's needed**:
- Real quota display from API
- Guest conversion banner with benefits
- Live canvas count vs limit
- "X/10 generations left today" for auth users

---

### 6. **views/Editor.tsx**
**Current state**: Has guest expiration nudge, but incomplete  
**What's working**:
- ✅ Has: Guest unsaved work warning on page leave (line 134-140)
- ✅ Has: Guest expiration banner after 72 hours (line 133, 454-467)

**What's missing**:
- ❌ No persistent "Sign in to save" banner at top for all guests
- ❌ No QuotaIndicator component
- ❌ Banner only shows after 72 hours (should show immediately)
- ❌ No tier-aware UI adjustments

**Recommended changes**:
```typescript
// Add persistent banner for ALL guests (not just 72h+)
{tier === 'guest' && (
  <div className="bg-yellow-500/10 border-b ...">
    <p>Your work isn't saved. Sign in to save permanently.</p>
    <button onClick={signin}>Sign in</button>
  </div>
)}

// Add floating quota indicator
<QuotaIndicator />
```

---

### 7. **components/EmailCaptureModal.tsx**
**Current state**: Simple sign-in prompt  
**What's working**:
- ✅ Has: Google OAuth integration
- ✅ Has: Session state preservation

**What's missing**:
- ❌ No benefit explanation (just says "Sign in to share/download")
- ❌ No visual appeal (plain, boring)
- ❌ No urgency or value prop
- ❌ Doesn't explain what user gets by signing in

**Recommendation**: Replace with `UpgradeModal.tsx` that has:
- Feature-specific benefits list
- Visual icons/checkmarks
- Clearer value proposition
- Better conversion copy

---

### 8. **components/TemplateModal.tsx** & **components/dashboard/TemplatesClient.tsx**
**Current state**: Shows all templates to everyone  
**What's missing**:
- ❌ No template locking for guests
- ❌ No "Sign in to unlock" badges
- ❌ No visual differentiation (lock icon, opacity, etc.)
- ❌ No server-side filtering

**Lines to update**:
- `TemplateModal.tsx`: Line 18-22 (filtering logic)
- `TemplatesClient.tsx`: Line 28-60 (TemplateCard component)

**What's needed**:
```typescript
// Check if template is allowed
const tier = getUserTier(user?.id);
const quotas = getUserQuotas(tier);
const isLocked = !isTemplateAllowed(template.id, quotas);

// Visual lock indicator
{isLocked && (
  <div className="absolute top-2 right-2">
    <Lock className="w-4 h-4 text-gray-400" />
  </div>
)}
```

---

## ✅ WORKING Components (No Changes Needed)

### 9. **store/diagramStore.ts**
**Status**: Partially working  
**What's good**:
- ✅ Has: `MAX_GUEST_CANVASES = 2` constant
- ✅ Has: Guest canvas limit check (line 834-840)
- ✅ Has: Duplicate canvas block for guests (line 904-907)
- ✅ Has: Toast messages for limits

**What needs adjustment**:
- Change `MAX_GUEST_CANVASES` from 2 to 1 (per plan)
- Add quota checking before AI generation
- Add node count limit enforcement

---

### 10. **store/authStore.ts**
**Status**: Working perfectly  
**What's good**:
- ✅ Has: Guest mode fallback
- ✅ Has: Proper user ID detection
- ✅ Has: `user.id === 'guest'` pattern
- ✅ Has: Graceful degradation

**No changes needed** - this is the foundation that works!

---

## 🚫 FEATURE GAPS (Server-Side)

### 11. **app/api/generate-diagram/route.ts**
**Current state**: Rate limiting exists but not quota-aware  
**What's working**:
- ✅ Has: Redis rate limiting (line 48-78)
- ✅ Has: 5 req/60s limit for all users

**What's wrong**:
- ❌ Same limit for guests and auth users (should be different)
- ❌ No daily quota tracking for auth users
- ❌ No usage logging to database
- ❌ No tier-aware limits

**Needs**: Replace Redis-only approach with tier-aware quota system

---

### 12. **app/api/user/canvases/route.ts**
**Current state**: Saves without restrictions  
**What's missing**:
- ❌ No canvas count limit enforcement
- ❌ No node count limit per canvas
- ❌ Guests can't save (correct) but no clear error message
- ❌ No tier checking

**Needs**: Add quota enforcement middleware

---

### 13. **app/api/diagram/load/route.ts** (Sharing)
**Current state**: Allows everyone to create shares  
**What's missing**:
- ❌ No guest restriction
- ❌ Anyone can create share links (should be auth-only)
- ❌ No usage tracking

**Needs**: Add auth check at top of POST handler

---

### 14. **app/api/diagram/export/route.ts**
**Current state**: Basic export endpoint  
**What's missing**:
- ❌ No format restrictions by tier
- ❌ No watermark flag for guests
- ❌ Same export capability for all users

**Needs**: Add tier-based format filtering

---

### 15. **app/api/components/templates/route.ts**
**Status**: Does not exist  
**What's missing**:
- ❌ No server-side template filtering
- ❌ All templates accessible to everyone

**Needs**: Create new API route that filters templates by tier

---

## 📊 COMPARISON TABLE

| Component/Feature | Current State | Needed State | Priority | Effort |
|-------------------|---------------|--------------|----------|--------|
| **QuotaIndicator.tsx** | ❌ Missing | ✅ Create | High | 2h |
| **UpgradeModal.tsx** | ❌ Missing | ✅ Create | High | 3h |
| **API: /api/user/quota** | ❌ Missing | ✅ Create | High | 1h |
| **Toolbar.tsx** | ⚠️ Basic | ✅ Enhance | High | 2h |
| **DashboardClient.tsx** | ⚠️ Fake metrics | ✅ Real quotas | Medium | 3h |
| **Editor.tsx** | ⚠️ Partial banner | ✅ Full banner | Medium | 1h |
| **EmailCaptureModal.tsx** | ⚠️ Too simple | ✅ Replace | Low | 2h |
| **TemplateModal.tsx** | ❌ No locks | ✅ Add locks | Medium | 2h |
| **TemplatesClient.tsx** | ❌ No locks | ✅ Add locks | Medium | 1h |
| **API: generate-diagram** | ⚠️ Same limits | ✅ Tier-aware | High | 3h |
| **API: user/canvases** | ❌ No limits | ✅ Enforce | High | 2h |
| **API: diagram/load** | ❌ No auth | ✅ Auth-only | High | 1h |
| **API: diagram/export** | ❌ No tiers | ✅ Tier-based | Medium | 2h |
| **API: templates** | ❌ Missing | ✅ Create | Medium | 2h |

**Total Estimated Effort**: ~27 hours (3-4 days for one developer)

---

## 🎯 PRIORITY IMPLEMENTATION ORDER

### **Day 1: Core Infrastructure** (8 hours)
1. Create `lib/userQuotas.ts` (1h)
2. Update Prisma schema + migrate (1h)
3. Create `lib/middleware/quotaCheck.ts` (2h)
4. Create `/api/user/quota/route.ts` (1h)
5. Update `store/diagramStore.ts` quota constant (0.5h)
6. Test infrastructure (2.5h)

### **Day 2: Server-Side Enforcement** (8 hours)
1. Update `/api/generate-diagram/route.ts` (3h)
2. Update `/api/user/canvases/route.ts` (2h)
3. Update `/api/diagram/load/route.ts` (1h)
4. Create `/api/components/templates/route.ts` (2h)

### **Day 3: Client UI Components** (8 hours)
1. Create `QuotaIndicator.tsx` (2h)
2. Create `UpgradeModal.tsx` (3h)
3. Update `Toolbar.tsx` (2h)
4. Update `Editor.tsx` banner (1h)

### **Day 4: Dashboard & Templates** (3 hours)
1. Update `DashboardClient.tsx` (3h)
2. Update `TemplateModal.tsx` + `TemplatesClient.tsx` (2h)
3. Final testing (3h)

---

## 🔍 KEY INSIGHTS

### What's Good
1. **Auth system works perfectly** - `authStore.ts` is solid
2. **Guest detection is consistent** - `userId === 'guest'` pattern everywhere
3. **EmailCaptureModal exists** - just needs enhancement
4. **Basic rate limiting works** - just needs to be tier-aware

### What's Broken
1. **No quota visibility** - users can't see limits until they hit them
2. **No server-side enforcement** - API routes trust client-side checks
3. **Same experience for all** - guests and auth users get same features
4. **No upgrade incentive** - blocking without explaining value

### Quick Wins (< 1 hour each)
1. Update `MAX_GUEST_CANVASES` from 2 → 1
2. Add persistent guest banner in `Editor.tsx`
3. Block sharing in `/api/diagram/load/route.ts` (auth check)
4. Add watermark flag to export endpoint

---

## 📝 TESTING CHECKLIST

After implementation, verify:

- [ ] Guest sees quota indicator with "2/3 left"
- [ ] Guest hitting limit sees UpgradeModal (not EmailCapture)
- [ ] UpgradeModal explains benefits clearly
- [ ] Template locks show on premium templates for guests
- [ ] Dashboard shows real quota usage (not fake "100 credits")
- [ ] Auth user sees "7/10 generations left today"
- [ ] API endpoints reject unauthorized actions
- [ ] Error messages are clear and actionable
- [ ] "Sign in" buttons work from all CTAs
- [ ] Guest work is preserved after sign-in

---

## 🚀 NEXT STEPS

1. **Review this document** with team
2. **Prioritize** which mismatches to fix first
3. **Assign** tasks to developers
4. **Start with Day 1** (infrastructure + database)
5. **Test incrementally** (don't wait until Day 4)
6. **Monitor conversion rates** after deployment

---

**Questions? See FEATURE_GATING_PLAN.md for implementation details.**
