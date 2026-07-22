# Feature Gating Implementation Checklist

Quick reference for implementing guest vs authenticated user restrictions.

## Phase 1: Core Infrastructure ✅

### Files to Create
- [ ] `lib/userQuotas.ts` - Quota configuration and helpers
- [ ] `lib/middleware/quotaCheck.ts` - Server-side quota checking

### Database Changes
- [ ] Update `prisma/schema.prisma` (add User quota fields + UsageLog model)
- [ ] Run: `npx prisma migrate dev --name add_user_quotas_and_usage_logs`
- [ ] Run: `npx prisma generate`

---

## Phase 2: Server-Side Enforcement ✅

### API Routes to Update
- [ ] `app/api/generate-diagram/route.ts` - AI generation quota
- [ ] `app/api/user/canvases/route.ts` - Canvas save/create limits
- [ ] `app/api/diagram/load/route.ts` - Sharing restriction
- [ ] `app/api/diagram/export/route.ts` - Export format restriction
- [ ] `app/api/components/templates/route.ts` - Template filtering

### API Routes to Create
- [ ] `app/api/user/quota/route.ts` - Get user quota status

---

## Phase 3: Client-Side UI/UX ✅

### Components to Create
- [ ] `components/QuotaIndicator.tsx` - Floating quota reminder
- [ ] `components/UpgradeModal.tsx` - Feature gate CTA modal

### Files to Update
- [ ] `store/diagramStore.ts` - Quota-aware canvas operations
- [ ] `components/Toolbar.tsx` - Better export/share CTAs
- [ ] `components/dashboard/DashboardClient.tsx` - Quota usage cards
- [ ] `views/Editor.tsx` - Guest banner
- [ ] `app/dashboard/templates/page.tsx` - Lock premium templates

---

## Phase 4: Testing ✅

### Guest User Tests
- [ ] AI generation quota (3/hour)
- [ ] Canvas limit (1 active)
- [ ] Export restrictions (JSON/PNG only, watermarked)
- [ ] Share blocked
- [ ] Template access (5 basic only)
- [ ] No persistence across sessions

### Authenticated User Tests
- [ ] AI generation quota (10/day)
- [ ] Canvas limit (5 saved)
- [ ] Full export (JSON/PNG/SVG, no watermark)
- [ ] Sharing works
- [ ] All templates accessible
- [ ] Persistence works
- [ ] Auto-save works

### API Protection Tests
- [ ] All endpoints enforce quotas
- [ ] Error messages are clear
- [ ] Rate limiting works with Redis
- [ ] Graceful degradation without Redis

---

## Deployment Checklist

- [ ] Database migration applied to production
- [ ] Environment variables set (if needed)
- [ ] Analytics tracking configured
- [ ] User documentation updated
- [ ] Support team notified of changes
- [ ] Monitor dashboard setup for conversion tracking

---

## Quick Commands

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_user_quotas_and_usage_logs

# Reset database (development only!)
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio
```

---

## Testing URLs

- Guest experience: `/editor` (without signing in)
- Dashboard: `/dashboard` (sign in required)
- Templates: `/dashboard/templates`
- Tutorials: `/dashboard/learn`

---

## Rollback

If issues arise:
1. Set `DISABLE_FEATURE_GATING=true` in `.env.local`
2. Deploy immediately
3. Investigate and fix
4. Re-enable when ready

---

**See `FEATURE_GATING_PLAN.md` for detailed implementation guide.**
