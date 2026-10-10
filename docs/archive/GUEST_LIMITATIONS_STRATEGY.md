# Guest User Limitations Strategy

## Current State Analysis

### ✅ Already Limited for Guests
1. **Canvas Management** - Max 2 canvases (`MAX_GUEST_CANVASES = 2` in store/diagramStore.ts)
2. **Canvas Duplication** - Blocked with "Sign in to duplicate canvases" toast
3. **Database Persistence** - Canvases not saved to database (localStorage only)
4. **Tutorial Progress** - Not synced to server

### 🔓 Currently Unlimited for Guests
1. **Diagram Generation** - Full access with same rate limits as authenticated users (5/min)
2. **Canvas Export** (SVG/PNG download) - No restrictions
3. **Canvas Sharing** - Can create and share public links
4. **All AI Features** - Full model selection, repo ingestion, tutorials
5. **Advanced Features** - MCP integration, auto-layout, templates

---

## 🎯 Recommended Limitations Strategy

### Tier 1: Critical Monetization Features (Implement First)

#### 1. **Daily Generation Limits** 🔴 HIGH PRIORITY
**Current:** Guest and auth users both have 5 requests per minute  
**Recommended:**
- **Guest:** 3 diagrams per day + 2 per minute
- **Auth:** 20 diagrams per day + 5 per minute  
- **Premium:** Unlimited

**Why:** This is your main value proposition. Guests can try the product but need to sign up for real work.

**Files to modify:**
- `app/api/generate-diagram/route.ts`
- `lib/redis.ts` (add daily limit tracking)

#### 2. **Sharing Restrictions** 🟡 MEDIUM PRIORITY
**Current:** Guests can share diagrams publicly  
**Recommended:**
- **Guest:** Cannot create share links (show "Sign in to share" modal)
- **Auth:** Can share with 7-day expiration
- **Premium:** Permanent share links + custom domains

**Why:** Sharing is a collaboration feature that drives team sign-ups.

**Files to modify:**
- `app/api/diagram/load/route.ts`
- `components/ShareModal.tsx` (or wherever share UI exists)

#### 3. **Export Quality Tiers** 🟢 LOW PRIORITY
**Current:** Full quality exports for everyone  
**Recommended:**
- **Guest:** PNG only with small watermark ("Made with ArchDraw")
- **Auth:** PNG + SVG without watermark
- **Premium:** High-res PNG + SVG + PDF

**Why:** Professional users need clean exports for presentations/docs.

**Files to modify:**
- `app/api/diagram/export/route.ts`
- Export utilities in `lib/`

---

### Tier 2: Feature Gating (Implement After Tier 1)

#### 4. **Canvas Management**
**Current:** 2 canvas limit ✅  
**Keep as-is** - This is already well-implemented

#### 5. **Advanced AI Features**
**Recommended:**
- **Guest:** Basic diagram generation only
- **Auth:** + Repo ingestion, custom templates
- **Premium:** + MCP integration, priority generation queue

#### 6. **Collaboration Features**
**Recommended:**
- **Guest:** View-only on shared links (no editing)
- **Auth:** Comment on shared diagrams
- **Premium:** Real-time collaboration, version history

---

## 📋 Implementation Checklist

### Phase 1: Core Limitations (Week 1)

- [ ] **Daily Generation Limits**
  ```typescript
  // lib/redis.ts - Add daily tracking
  export async function checkDailyLimit(userId: string, maxDaily: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const key = `daily_limit:${userId}:${new Date().toISOString().split('T')[0]}`;
    const count = await redis.incr(key);
    await redis.expire(key, 86400); // 24 hours
    
    return {
      allowed: count <= maxDaily,
      remaining: Math.max(0, maxDaily - count),
      resetAt: Math.floor(Date.now() / 1000) + 86400
    };
  }
  ```

  ```typescript
  // app/api/generate-diagram/route.ts - Line ~50
  // Add after rate limiting check
  
  const userLimits = {
    guest: { daily: 3, perMinute: 2 },
    auth: { daily: 20, perMinute: 5 },
  };
  
  const isGuest = !userId || userId === 'guest';
  const limits = isGuest ? userLimits.guest : userLimits.auth;
  
  // Check daily limit
  const dailyCheck = await checkDailyLimit(
    identifier, 
    limits.daily
  );
  
  if (!dailyCheck.allowed) {
    return NextResponse.json(
      { 
        error: isGuest 
          ? `Daily limit reached (${limits.daily}/day). Sign in for ${userLimits.auth.daily} diagrams per day.`
          : `Daily limit reached (${limits.daily}/day). Resets in ${formatResetTime(dailyCheck.resetAt)}.`,
        code: 'DAILY_LIMIT_EXCEEDED',
        status: 429,
        resetAt: new Date(dailyCheck.resetAt * 1000).toISOString(),
        upgradeRequired: isGuest,
      },
      { status: 429 }
    );
  }
  ```

- [ ] **Sharing Gate for Guests**
  ```typescript
  // app/api/diagram/load/route.ts - Line ~30
  // In POST handler (create share link)
  
  const userId = await getUserId(req); // Get from session
  const isGuest = !userId || userId === 'guest';
  
  if (isGuest) {
    return NextResponse.json(
      { 
        error: 'Sign in to share diagrams',
        code: 'AUTH_REQUIRED',
        status: 401 
      },
      { status: 401 }
    );
  }
  ```

  ```typescript
  // components/ShareButton.tsx (or similar)
  // Add UI check before API call
  
  const handleShare = () => {
    if (!user || user.id === 'guest') {
      toast.error('Sign in to share diagrams', {
        action: {
          label: 'Sign In',
          onClick: () => router.push('/auth/login')
        }
      });
      return;
    }
    // ... existing share logic
  };
  ```

- [ ] **UI Indicators**
  - Add remaining generations counter to header
  - Show "Upgrade" badge on premium features
  - Add comparison table to landing page

### Phase 2: Export Watermarking (Week 2)

- [ ] **Watermark for Guest Exports**
  ```typescript
  // lib/utils/svg-exporter.ts (or create if doesn't exist)
  
  export function addWatermark(svg: string, isGuest: boolean): string {
    if (!isGuest) return svg;
    
    const watermark = `
      <text x="50%" y="98%" 
        text-anchor="middle" 
        font-size="12" 
        fill="#9ca3af" 
        opacity="0.6">
        Made with ArchDraw
      </text>
    `;
    
    return svg.replace('</svg>', `${watermark}</svg>`);
  }
  ```

- [ ] **Export Quality Restrictions**
  ```typescript
  // app/api/diagram/export/route.ts
  
  const isGuest = !userId || userId === 'guest';
  
  if (isGuest && format === 'svg') {
    return NextResponse.json(
      { 
        error: 'SVG export requires sign in. PNG available for guests.',
        code: 'SVG_AUTH_REQUIRED',
        availableFormats: ['png']
      },
      { status: 403 }
    );
  }
  ```

### Phase 3: Advanced Feature Gates (Week 3)

- [ ] **Repo Ingestion - Auth Required**
  ```typescript
  // app/api/repo-diagram/route.ts - Line ~20
  
  const isGuest = !userId || userId === 'guest';
  
  if (isGuest) {
    return NextResponse.json(
      { 
        error: 'Repository ingestion requires sign in',
        code: 'FEATURE_AUTH_REQUIRED',
        feature: 'repo_ingestion'
      },
      { status: 401 }
    );
  }
  ```

- [ ] **Custom Templates - Auth Required**
  ```typescript
  // components/TemplateSelector.tsx
  
  const templates = [
    { id: 'basic', name: 'Basic', free: true },
    { id: 'microservices', name: 'Microservices', free: false },
    { id: 'event-driven', name: 'Event-Driven', free: false },
  ];
  
  const handleSelect = (template) => {
    if (!template.free && isGuest) {
      toast.error('Custom templates require sign in');
      return;
    }
    applyTemplate(template);
  };
  ```

---

## 🎨 UI/UX Recommendations

### 1. **Generation Counter in Header**
```tsx
// components/GenerationCounter.tsx
<div className="flex items-center gap-2 text-sm">
  <Zap className="w-4 h-4" />
  <span>{remaining} / {limit} today</span>
  {isGuest && (
    <Button size="sm" variant="link" onClick={() => router.push('/signup')}>
      Upgrade
    </Button>
  )}
</div>
```

### 2. **Feature Comparison Table**
Add to landing page:
```
| Feature                | Guest      | Free Account | Premium    |
|------------------------|------------|--------------|------------|
| Diagrams per day       | 3          | 20           | Unlimited  |
| Canvas limit           | 2          | 10           | Unlimited  |
| Export formats         | PNG        | PNG + SVG    | All + PDF  |
| Sharing                | ❌         | ✅ (7 days)  | ✅ Forever |
| Repo ingestion         | ❌         | ✅           | ✅         |
| Custom templates       | ❌         | ✅           | ✅         |
| Collaboration          | ❌         | ❌           | ✅         |
```

### 3. **Gentle Upgrade Prompts**
- After 2nd diagram: "1 generation left today. Sign up for 20/day!"
- On 3rd diagram: Full-screen modal with benefits list
- On share attempt: "Share diagrams with your team - Sign up free"

---

## 💰 Monetization Strategy

### Conversion Funnel
1. **First Visit** → Allow full exploration (no immediate limits)
2. **1st Diagram** → Show success, hint at daily limits
3. **2nd Diagram** → Show remaining count (1 left)
4. **3rd Diagram** → Gentle upsell modal with sign-up CTA
5. **Hit Limit** → Hard gate with clear value proposition

### Premium Features (Future)
- Unlimited generations
- Team workspaces
- Real-time collaboration
- Custom branding
- Priority support
- API access

---

## 📊 Analytics to Track

Add these events to measure conversion:
```typescript
// Guest user behavior
track('guest_diagram_generated', { count: 1, remaining: 2 });
track('guest_limit_reached', { feature: 'generation' });
track('guest_upgrade_prompt_shown', { trigger: 'daily_limit' });
track('guest_signup_clicked', { source: 'limit_modal' });

// Feature gating
track('feature_blocked', { feature: 'sharing', user_type: 'guest' });
track('upgrade_cta_clicked', { location: 'share_button' });
```

---

## 🚀 Quick Start Implementation

**Minimal Viable Limitation (1 hour):**
1. Add daily limit check to generate-diagram route
2. Block sharing for guests with toast message
3. Add generation counter to UI

**Code snippets above** → Copy/paste ready for these three features.

---

## ⚠️ Important Notes

1. **Don't Over-Limit:** Guests need enough functionality to see value (3 diagrams is enough to evaluate)
2. **Clear Messaging:** Always explain WHY they need to sign up (more diagrams, not just "blocked")
3. **Progressive Enhancement:** Start loose, tighten based on usage data
4. **A/B Test Limits:** Try 3 vs 5 daily diagrams, measure conversion rates

---

## Files That Need Changes

### High Priority
- ✅ `app/api/generate-diagram/route.ts` (daily limits)
- ✅ `lib/redis.ts` (daily tracking function)
- ✅ `app/api/diagram/load/route.ts` (sharing gate)
- ✅ `components/Header.tsx` or similar (generation counter UI)

### Medium Priority
- `app/api/diagram/export/route.ts` (export restrictions)
- `lib/utils/svg-exporter.ts` (watermark logic)
- `app/api/repo-diagram/route.ts` (repo gate)

### Low Priority
- Template selector components
- Landing page comparison table
- Settings page for limit display

---

**Recommendation:** Start with Phase 1 (daily limits + sharing gate). This gives you immediate conversion drivers without overwhelming development effort.

Want me to implement any of these changes?
