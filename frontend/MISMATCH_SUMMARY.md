# UI/UX Mismatches - Quick Summary

## 🔴 Critical Issues (Block Feature Gating)

### Missing Components (Must Create)
1. **QuotaIndicator.tsx** - No quota visibility for users
2. **UpgradeModal.tsx** - No clear upgrade path when blocked
3. **API: /api/user/quota** - No way to fetch quota status

### Broken Enforcement (APIs bypass-able)
4. **API: generate-diagram** - Same limits for everyone (5/60s)
5. **API: user/canvases** - No canvas count/size limits enforced
6. **API: diagram/load** - Guests can create shares (shouldn't)
7. **API: diagram/export** - No format restrictions by tier

---

## 🟡 Incomplete Features (Need Updates)

### Existing Components That Need Work
8. **Toolbar.tsx** - Basic blocks, no benefit explanation
9. **DashboardClient.tsx** - Shows fake metrics ("100 AI credits")
10. **Editor.tsx** - Banner only shows after 72h (should be immediate)
11. **EmailCaptureModal.tsx** - Too simple, poor conversion
12. **TemplateModal.tsx** - All templates accessible to guests
13. **TemplatesClient.tsx** - No lock icons on premium templates

---

## 🟢 Working (Minor Tweaks)

14. **store/diagramStore.ts** - Has limits, just change 2→1 canvas
15. **store/authStore.ts** - Perfect, no changes needed

---

## 📊 By The Numbers

- **Missing components**: 3 critical pieces
- **API routes needing enforcement**: 4 endpoints
- **UI components needing updates**: 6 files
- **Total estimated effort**: 27 hours (3-4 days)
- **Quick wins**: 4 tasks under 1 hour each

---

## 🎯 Priority Actions (Next 24 Hours)

### High Priority (Do First)
1. Create `/api/user/quota/route.ts` - 1 hour
2. Update `/api/generate-diagram/route.ts` - 3 hours  
3. Create `QuotaIndicator.tsx` - 2 hours
4. Create `UpgradeModal.tsx` - 3 hours

**Total**: 9 hours (1 focused work day)

### Medium Priority (Day 2)
5. Update `Toolbar.tsx` with UpgradeModal - 2 hours
6. Add guest banner to `Editor.tsx` - 1 hour
7. Update `DashboardClient.tsx` with real quotas - 3 hours
8. Add template locks - 3 hours

**Total**: 9 hours (second work day)

### Low Priority (Polish)
9. Replace `EmailCaptureModal.tsx` usage
10. Add watermark to guest PNG exports
11. Server-side template filtering

---

## 🚨 What Happens If You Deploy Now?

**Without fixes**:
- ❌ Guests can bypass all limits via API calls
- ❌ No quota visibility = confused users
- ❌ Poor conversion (blocks without explaining value)
- ❌ Auth users have same limits as guests (no benefit)
- ❌ Fake metrics in dashboard mislead users

**After Day 1 fixes**:
- ✅ Quotas enforced server-side (can't bypass)
- ✅ Users see remaining quota
- ✅ Clear upgrade prompts with benefits
- ⚠️ Templates still not locked (do Day 2)

---

## 🎨 Visual Design Needs

### New Components Required
```
┌─────────────────────────────┐
│ QuotaIndicator.tsx          │
│ ┌─────────────────────────┐ │
│ │ 🎨 Guest Mode          │ │
│ │ 2/3 AI generations left│ │
│ │ [Sign in free →]       │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘

┌─────────────────────────────┐
│ UpgradeModal.tsx            │
│ ┌─────────────────────────┐ │
│ │ ✨ Sign in to unlock    │ │
│ │                         │ │
│ │ ✅ 10 generations/day  │ │
│ │ ✅ 5 saved canvases    │ │
│ │ ✅ Share & export      │ │
│ │                         │ │
│ │ [Sign in with Google]  │ │
│ │ [Maybe later]          │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### Existing Components Needing Visual Updates
- **Dashboard**: Add quota usage cards
- **Templates**: Add lock icons + opacity for locked items
- **Toolbar**: Better CTAs (not just "Sign in")
- **Editor**: Persistent yellow banner at top

---

## 💡 Recommendations

### Do This First (Today)
1. Read `UI_UX_MISMATCHES.md` in detail
2. Start with infrastructure (Day 1 tasks)
3. Test each change incrementally

### Don't Do This
- ❌ Don't deploy without server-side enforcement
- ❌ Don't skip quota visibility (users need to see limits)
- ❌ Don't use EmailCaptureModal for feature blocks (too weak)

### Consider This
- 💡 A/B test quota limits (3 vs 5 guest generations)
- 💡 Add "first sign-in bonus" (extra generations)
- 💡 Show social proof ("10k users signed up")

---

**Full details in `UI_UX_MISMATCHES.md`**
