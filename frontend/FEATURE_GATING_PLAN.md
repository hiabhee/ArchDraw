# Feature Gating Implementation Plan
## Guest Users vs Authenticated Users

**Date Created**: 2026-07-22  
**Status**: Implementation Ready  
**Priority**: High

---

## Executive Summary

This document outlines the implementation plan for enforcing feature gates between **Guest Users** (unauthenticated) and **Authenticated Users** (logged in with Google OAuth). The goal is to encourage sign-ups while maintaining a functional free tier that demonstrates value.

---

## Current State Analysis

### What Works Now
- ✅ Guest mode fallback (when not authenticated or database offline)
- ✅ Basic rate limiting (5 req/60s for AI generation via Redis)
- ✅ UI-only canvas limit hints (2 for guests, 5 for auth users)
- ✅ Toolbar gates for export/share (shows email capture modal for guests)
- ✅ LocalStorage persistence for guest canvases
- ✅ Database persistence for authenticated user canvases

### What Needs Enforcement
- ❌ **Canvas creation limits** (not enforced server-side)
- ❌ **AI generation quotas** (same rate limit for all users)
- ❌ **Canvas size limits** (no node count restrictions)
- ❌ **Export format restrictions** (guests blocked on client only)
- ❌ **Sharing restrictions** (guests blocked on client only)
- ❌ **Template access** (all templates available to everyone)
- ❌ **Tutorial progress** (guests can't save progress)
- ❌ **Canvas auto-save** (not enforced for guests)

---

## Feature Matrix


| Feature | Guest Users | Authenticated Users |
|---------|-------------|---------------------|
| **AI Generation** | 3 per hour | 10 per day |
| **Canvas Limit** | 1 active session | 5 saved canvases |
| **Canvas Persistence** | LocalStorage only (session) | Database (persistent) |
| **Canvas Size** | Max 25 nodes | Max 100 nodes |
| **Templates** | 5 basic templates | All templates |
| **Export PNG** | ✅ With watermark | ✅ No watermark |
| **Export SVG** | ❌ Blocked | ✅ Allowed |
| **Export JSON** | ✅ Allowed | ✅ Allowed |
| **Share Links** | ❌ Blocked | ✅ 7-day expiry |
| **Tutorial System** | ✅ Can access | ✅ Progress saved |
| **Dashboard** | ❌ Redirect to editor | ✅ Full access |
| **Canvas Versioning** | ❌ None | ✅ Last 3 versions |
| **Auto-save** | ❌ Manual only | ✅ Every 30s |
| **Collaboration** | ❌ Blocked | ✅ View-only links |
| **Duplicate Canvas** | ❌ Blocked | ✅ Allowed |

---

## Implementation Phases

### **Phase 1: Core Infrastructure** (Day 1-2)
Setup foundational utilities and database schema changes.

### **Phase 2: Server-Side Enforcement** (Day 3-4)
Implement API route guards and quota tracking.

### **Phase 3: Client-Side UI/UX** (Day 5-6)
Update UI components to reflect limits and encourage sign-ups.

### **Phase 4: Testing & Polish** (Day 7)
End-to-end testing, edge cases, and user experience refinement.

---

## Phase 1: Core Infrastructure

### 1.1 Create User Quota Tracking System

**File**: `lib/userQuotas.ts` (new file)

```typescript
// Centralized user quota configuration and helpers
export const USER_QUOTAS = {
  guest: {
    aiGenerationsPerHour: 3,
    maxCanvases: 1,
    maxNodesPerCanvas: 25,
    allowedExportFormats: ['json', 'png'],
    allowSharing: false,
    allowTemplates: ['microservices-basic', 'three-tier-web', 'event-driven-simple', 'cicd-pipeline', 'rest-api'],
    allowTutorialProgress: false,
    autoSave: false,
    canDuplicateCanvas: false,
    watermarkExports: true,
  },
  authenticated: {
    aiGenerationsPerDay: 10,
    maxCanvases: 5,
    maxNodesPerCanvas: 100,
    allowedExportFormats: ['json', 'png', 'svg'],
    allowSharing: true,
    allowTemplates: 'all',
    allowTutorialProgress: true,
    autoSave: true,
    canDuplicateCanvas: true,
    watermarkExports: false,
    shareExpiryDays: 7,
    maxVersions: 3,
  },
} as const;

export type UserTier = keyof typeof USER_QUOTAS;

export function getUserTier(userId: string | null | undefined): UserTier {
  return !userId || userId === 'guest' ? 'guest' : 'authenticated';
}

export function getUserQuotas(userTier: UserTier) {
  return USER_QUOTAS[userTier];
}

export function canAccessFeature(
  userTier: UserTier,
  feature: 'share' | 'svgExport' | 'tutorialProgress' | 'autoSave' | 'duplicate'
): boolean {
  const quotas = getUserQuotas(userTier);
  switch (feature) {
    case 'share':
      return quotas.allowSharing;
    case 'svgExport':
      return quotas.allowedExportFormats.includes('svg');
    case 'tutorialProgress':
      return quotas.allowTutorialProgress;
    case 'autoSave':
      return quotas.autoSave;
    case 'duplicate':
      return quotas.canDuplicateCanvas;
    default:
      return false;
  }
}
```

**Purpose**: Single source of truth for all quota configurations.

---

### 1.2 Extend Prisma Schema

**File**: `prisma/schema.prisma`

```prisma
model User {
  // ... existing fields
  
  // Quota tracking fields
  dailyGenerations     Int      @default(0)
  dailyGenerationsDate DateTime @default(now()) @map("daily_generations_date")
  totalGenerations     Int      @default(0)
  
  // Feature flags (for future flexibility)
  featureFlags         Json     @default("{}") @map("feature_flags")
}

model UsageLog {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String?  @map("user_id") // null for guests
  guestId   String?  @map("guest_id") // anonymous identifier for guests
  action    String   // 'ai_generation', 'canvas_create', 'export', 'share'
  metadata  Json?    // additional context (node count, format, etc.)
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@index([guestId, createdAt])
  @@index([action, createdAt])
  @@map("usage_logs")
}
```

**Migration Command**:
```bash
npx prisma migrate dev --name add_user_quotas_and_usage_logs
```

**Purpose**: Track user actions and enforce daily limits server-side.

---

### 1.3 Create Quota Middleware

**File**: `lib/middleware/quotaCheck.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserTier, getUserQuotas } from '@/lib/userQuotas';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function checkAIGenerationQuota(
  req: NextRequest
): Promise<{ allowed: boolean; error?: string; remaining?: number }> {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  const tier = getUserTier(userId);
  const quotas = getUserQuotas(tier);

  if (tier === 'guest') {
    // Use Redis rate limiting for guests (already implemented)
    const identifier = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const { checkRateLimit } = await import('@/lib/redis');
    
    const result = await checkRateLimit(
      `guest-ai:${identifier}`,
      quotas.aiGenerationsPerHour,
      3600
    );
    
    return {
      allowed: result.allowed,
      error: result.allowed ? undefined : `Guest limit: ${quotas.aiGenerationsPerHour} generations per hour. Sign in for ${getUserQuotas('authenticated').aiGenerationsPerDay}/day.`,
      remaining: result.remaining,
    };
  }

  // Authenticated user: check daily quota
  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { dailyGenerations: true, dailyGenerationsDate: true },
  });

  if (!user) {
    return { allowed: false, error: 'User not found' };
  }

  // Reset daily counter if it's a new day
  const today = new Date().toDateString();
  const lastReset = new Date(user.dailyGenerationsDate).toDateString();
  
  if (today !== lastReset) {
    await prisma.user.update({
      where: { id: userId! },
      data: { dailyGenerations: 0, dailyGenerationsDate: new Date() },
    });
    return { allowed: true, remaining: quotas.aiGenerationsPerDay - 1 };
  }

  // Check if under limit
  if (user.dailyGenerations >= quotas.aiGenerationsPerDay) {
    return {
      allowed: false,
      error: `Daily limit reached (${quotas.aiGenerationsPerDay} generations). Resets at midnight.`,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: quotas.aiGenerationsPerDay - user.dailyGenerations - 1,
  };
}

export async function incrementAIGeneration(userId: string | null) {
  if (!userId || userId === 'guest') return;
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyGenerations: { increment: 1 },
      totalGenerations: { increment: 1 },
    },
  });
}

export async function logUsage(
  userId: string | null,
  guestId: string | null,
  action: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.usageLog.create({
      data: {
        userId,
        guestId,
        action,
        metadata: metadata || {},
      },
    });
  } catch (error) {
    console.error('[Usage Log] Failed to log action:', error);
  }
}
```

**Purpose**: Reusable middleware for checking quotas across API routes.

---

## Phase 2: Server-Side Enforcement

### 2.1 Enforce AI Generation Quotas

**File**: `app/api/generate-diagram/route.ts`

**Changes**:
```typescript
import { checkAIGenerationQuota, incrementAIGeneration, logUsage } from '@/lib/middleware/quotaCheck';

export async function POST(req: NextRequest) {
  // Add quota check at the beginning
  const quotaCheck = await checkAIGenerationQuota(req);
  
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      {
        error: quotaCheck.error,
        code: 'QUOTA_EXCEEDED',
        status: 429,
        remaining: quotaCheck.remaining || 0,
        upgradePrompt: 'Sign in for more generations',
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(quotaCheck.remaining || 0),
        },
      }
    );
  }

  // ... existing generation logic

  // After successful generation, increment counter
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  
  await incrementAIGeneration(userId || null);
  await logUsage(userId || null, getGuestId(req), 'ai_generation', {
    description: description.substring(0, 100),
    nodeCount: result.nodes?.length || 0,
  });

  // Include remaining quota in response
  return NextResponse.json({
    ...result,
    quotaRemaining: quotaCheck.remaining,
  });
}
```

**Purpose**: Hard enforcement of generation limits with clear error messages.

---

### 2.2 Restrict Canvas Operations

**File**: `app/api/user/canvases/route.ts`

**Changes**:
```typescript
import { getUserTier, getUserQuotas } from '@/lib/userQuotas';
import { auth } from '@/lib/auth';

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  
  if (!userId || userId === 'guest') {
    return NextResponse.json(
      { error: 'Sign in required to save canvases' },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { nodes } = body;
  
  // Enforce node count limit
  const tier = getUserTier(userId);
  const quotas = getUserQuotas(tier);
  
  if (nodes.length > quotas.maxNodesPerCanvas) {
    return NextResponse.json(
      {
        error: `Canvas too large. Maximum ${quotas.maxNodesPerCanvas} nodes allowed.`,
        code: 'CANVAS_SIZE_EXCEEDED',
      },
      { status: 400 }
    );
  }

  // Check canvas count limit
  const existingCanvases = await prisma.userCanvas.count({
    where: { userId },
  });

  const isNewCanvas = !(await prisma.userCanvas.findUnique({
    where: { id: body.id },
  }));

  if (isNewCanvas && existingCanvases >= quotas.maxCanvases) {
    return NextResponse.json(
      {
        error: `Maximum ${quotas.maxCanvases} canvases allowed. Delete one to create new.`,
        code: 'CANVAS_LIMIT_EXCEEDED',
      },
      { status: 400 }
    );
  }

  // ... existing save logic
}
```

**Purpose**: Prevent canvas limit circumvention via API calls.

---

### 2.3 Gate Sharing Feature

**File**: `app/api/diagram/load/route.ts`

**Changes**:
```typescript
import { getUserTier, canAccessFeature } from '@/lib/userQuotas';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  const tier = getUserTier(userId);

  // Block guests from creating share links
  if (!canAccessFeature(tier, 'share')) {
    return NextResponse.json(
      {
        error: 'Sign in to share diagrams',
        code: 'AUTH_REQUIRED',
        feature: 'sharing',
      },
      { status: 401 }
    );
  }

  // ... existing share logic

  await logUsage(userId || null, null, 'share_created', {
    nodeCount: body.nodes.length,
    accessType: body.accessType,
  });
}
```

**Purpose**: Server-side enforcement prevents API bypass.

---

### 2.4 Restrict Export Formats

**File**: `app/api/diagram/export/route.ts`

**Changes**:
```typescript
import { getUserTier, getUserQuotas } from '@/lib/userQuotas';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  const tier = getUserTier(userId);
  const quotas = getUserQuotas(tier);

  const body = await req.json();
  const { format } = body;

  // Check if format is allowed for this tier
  if (!quotas.allowedExportFormats.includes(format)) {
    return NextResponse.json(
      {
        error: `${format.toUpperCase()} export requires sign in`,
        code: 'FEATURE_RESTRICTED',
        allowedFormats: quotas.allowedExportFormats,
      },
      { status: 403 }
    );
  }

  // Add watermark flag for guest PNG exports
  const shouldWatermark = tier === 'guest' && format === 'png';

  return NextResponse.json({
    format,
    watermark: shouldWatermark,
    // ... existing data
  });
}
```

**Purpose**: Control export format access by user tier.

---

### 2.5 Filter Templates by Tier

**File**: `app/api/components/templates/route.ts` (modify or create)

**Changes**:
```typescript
import { getUserTier, getUserQuotas } from '@/lib/userQuotas';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  const tier = getUserTier(userId);
  const quotas = getUserQuotas(tier);

  const allTemplates = await prisma.componentTemplate.findMany({
    include: { category: true },
  });

  // Filter templates for guest users
  if (quotas.allowTemplates !== 'all') {
    const allowed = new Set(quotas.allowTemplates);
    const filtered = allTemplates.filter(t => allowed.has(t.id));
    
    return NextResponse.json({
      templates: filtered,
      tier,
      upgradeCTA: tier === 'guest' ? 'Sign in to unlock all templates' : null,
    });
  }

  return NextResponse.json({ templates: allTemplates, tier });
}
```

**Purpose**: Limit template access for guests to encourage sign-ups.

---

## Phase 3: Client-Side UI/UX

### 3.1 Update Diagram Store with Quota Awareness

**File**: `store/diagramStore.ts`

**Changes**:
```typescript
import { getUserTier, getUserQuotas } from '@/lib/userQuotas';

// In addCanvas function
addCanvas: (customName?: string, canvasId?: string) => {
  const { canvases, userProfile } = get();
  const tier = getUserTier(userProfile?.id);
  const quotas = getUserQuotas(tier);
  
  const userCanvases = tier === 'guest'
    ? canvases.filter(c => c.id.startsWith('guest-canvas'))
    : canvases;
  
  if (userCanvases.length >= quotas.maxCanvases) {
    toast.error(
      tier === 'guest'
        ? 'Guest limit: 1 canvas. Sign in for 5 canvases.'
        : `Maximum ${quotas.maxCanvases} canvases reached. Delete one first.`,
      { duration: 5000 }
    );
    return get().activeCanvasId || 'guest-canvas';
  }
  
  // ... existing logic
},

// In duplicateCanvas function
duplicateCanvas: (id: string) => {
  const { userProfile } = get();
  const tier = getUserTier(userProfile?.id);
  
  if (!canAccessFeature(tier, 'duplicate')) {
    toast.error('Sign in to duplicate canvases');
    return;
  }
  
  // ... existing logic
},
```

**Purpose**: Consistent quota enforcement in the store layer.

---

### 3.2 Add Quota Display Component

**File**: `components/QuotaIndicator.tsx` (new file)

```typescript
'use client';

import { useAuthStore } from '@/store/authStore';
import { getUserTier, getUserQuotas } from '@/lib/userQuotas';
import { AlertCircle, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

export function QuotaIndicator() {
  const { user } = useAuthStore();
  const tier = getUserTier(user?.id);
  const quotas = getUserQuotas(tier);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Fetch remaining quota from API
    fetch('/api/user/quota')
      .then(res => res.json())
      .then(data => setRemaining(data.remaining))
      .catch(() => setRemaining(null));
  }, []);

  if (tier === 'authenticated') return null; // Hide for authenticated users

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 max-w-xs z-50">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-yellow-100">Guest Mode</p>
          <p className="text-xs text-yellow-200/80 mt-1">
            {remaining !== null && `${remaining}/3 AI generations left. `}
            Sign in for 10/day + saved canvases.
          </p>
          <button
            onClick={() => window.location.href = '/api/auth/signin'}
            className="mt-2 text-xs font-semibold text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            Sign in free
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Usage**: Add to `views/Editor.tsx` and `app/page.tsx`.

**Purpose**: Constant reminder of guest limitations to drive sign-ups.

---

### 3.3 Enhance Toolbar with Better CTAs

**File**: `components/Toolbar.tsx`

**Changes**:
```typescript
// Replace simple isGuest checks with quota-aware messaging

const handleExport = (format: ExportFormat) => {
  const tier = getUserTier(user?.id);
  const quotas = getUserQuotas(tier);
  
  if (!quotas.allowedExportFormats.includes(format)) {
    // Show upgrade modal instead of simple email capture
    setUpgradeModal({
      feature: 'export',
      message: `${format.toUpperCase()} export is available for signed-in users.`,
      benefits: [
        'Export to PNG, SVG, and JSON',
        'No watermarks',
        '5 saved canvases',
        '10 AI generations per day',
      ],
    });
    return;
  }
  
  doExport(format);
};

const handleShare = () => {
  const tier = getUserTier(user?.id);
  
  if (!canAccessFeature(tier, 'share')) {
    setUpgradeModal({
      feature: 'share',
      message: 'Sharing requires a free account.',
      benefits: [
        'Create shareable links',
        'Collaborate with your team',
        'Links expire in 7 days',
        'Control view/edit permissions',
      ],
    });
    return;
  }
  
  doShare();
};
```

**Purpose**: Better conversion by showing value, not just blocking features.

---

### 3.4 Create Upgrade Modal Component

**File**: `components/UpgradeModal.tsx` (new file)

```typescript
'use client';

import { X, Check, ArrowRight } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  message: string;
  benefits: string[];
}

export function UpgradeModal({
  isOpen,
  onClose,
  feature,
  message,
  benefits,
}: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-xl max-w-md w-full p-6 relative border border-white/10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✨</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Sign in to unlock {feature}
          </h3>
          <p className="text-sm text-gray-400">{message}</p>
        </div>

        <div className="space-y-3 mb-6">
          {benefits.map((benefit, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-300">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => window.location.href = '/api/auth/signin'}
            className="w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            Sign in with Google
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Purpose**: Convert feature blocks into sign-up opportunities.

---

### 3.5 Update Dashboard to Show Quota Usage

**File**: `components/dashboard/DashboardClient.tsx`

**Changes**:
```typescript
import { useEffect, useState } from 'react';
import { getUserTier, getUserQuotas } from '@/lib/userQuotas';

export function DashboardClient({ templates, aiPrompts }: DashboardClientProps) {
  const { user } = useAuthStore();
  const { canvases } = useDiagramStore();
  const [quotaStats, setQuotaStats] = useState<{
    dailyGenerations: number;
    totalGenerations: number;
  } | null>(null);

  const tier = getUserTier(user?.id);
  const quotas = getUserQuotas(tier);

  useEffect(() => {
    // Fetch quota stats for authenticated users
    if (tier === 'authenticated') {
      fetch('/api/user/quota')
        .then(res => res.json())
        .then(data => setQuotaStats(data))
        .catch(() => setQuotaStats(null));
    }
  }, [tier]);

  const userCanvases = tier === 'guest'
    ? canvases.filter(c => c.id.startsWith('guest-canvas'))
    : canvases;

  return (
    <div className="space-y-6">
      {/* Quota Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuotaCard
          title="AI Generations"
          used={quotaStats?.dailyGenerations || 0}
          limit={tier === 'guest' ? 'Hourly limit' : quotas.aiGenerationsPerDay}
          icon="✨"
          description={tier === 'guest' ? '3 per hour' : 'Resets daily'}
        />
        <QuotaCard
          title="Saved Canvases"
          used={userCanvases.length}
          limit={quotas.maxCanvases}
          icon="📊"
          description={tier === 'guest' ? 'Session only' : 'Persistent storage'}
        />
        <QuotaCard
          title="Max Canvas Size"
          used={null}
          limit={quotas.maxNodesPerCanvas}
          icon="🎯"
          description="Nodes per canvas"
        />
      </div>

      {/* Upgrade Banner for Guests */}
      {tier === 'guest' && (
        <div className="bg-gradient-to-r from-accent/10 to-purple-500/10 border border-accent/30 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Unlock the Full Experience
              </h3>
              <ul className="text-sm text-gray-300 space-y-1 mb-4">
                <li>✅ 10 AI generations per day (vs 3/hour)</li>
                <li>✅ Save up to 5 canvases (vs 1 session canvas)</li>
                <li>✅ Export to PNG, SVG without watermarks</li>
                <li>✅ Share diagrams with your team</li>
              </ul>
              <button
                onClick={() => window.location.href = '/api/auth/signin'}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold transition-colors"
              >
                Sign in free with Google
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rest of dashboard content... */}
    </div>
  );
}

function QuotaCard({ title, used, limit, icon, description }) {
  return (
    <div className="border border-border-default rounded-xl p-4 bg-surface-panel">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      </div>
      <div className="text-2xl font-bold text-white mb-1">
        {used !== null ? `${used} / ${limit}` : `Up to ${limit}`}
      </div>
      <p className="text-xs text-text-muted">{description}</p>
    </div>
  );
}
```

**Purpose**: Transparency about usage and clear upgrade value proposition.

---

### 3.6 Add Persistent Banner for Guests

**File**: `views/Editor.tsx`

**Changes**:
```typescript
import { QuotaIndicator } from '@/components/QuotaIndicator';
import { getUserTier } from '@/lib/userQuotas';

export default function Editor() {
  const { user } = useAuthStore();
  const tier = getUserTier(user?.id);

  return (
    <div className="h-screen flex flex-col">
      {/* Guest Banner */}
      {tier === 'guest' && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-center justify-between">
          <p className="text-xs text-yellow-200">
            <strong>Guest Mode:</strong> Your work isn't saved. Sign in to save diagrams permanently.
          </p>
          <button
            onClick={() => window.location.href = '/api/auth/signin'}
            className="text-xs font-semibold text-yellow-400 hover:text-yellow-300 px-3 py-1 rounded border border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
          >
            Sign in
          </button>
        </div>
      )}

      {/* Existing editor UI */}
      <Toolbar />
      <Canvas />
      
      {/* Floating quota indicator */}
      <QuotaIndicator />
    </div>
  );
}
```

**Purpose**: Constant reminder that drives conversion without being intrusive.

---

### 3.7 Restrict Template Access in UI

**File**: `app/dashboard/templates/page.tsx`

**Changes**:
```typescript
'use client';

import { useAuthStore } from '@/store/authStore';
import { getUserTier, getUserQuotas } from '@/lib/userQuotas';
import { Lock } from 'lucide-react';

export default function TemplatesPage() {
  const { user } = useAuthStore();
  const tier = getUserTier(user?.id);
  const quotas = getUserQuotas(tier);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    fetch('/api/components/templates')
      .then(res => res.json())
      .then(data => setTemplates(data.templates));
  }, []);

  const isTemplateAllowed = (templateId: string) => {
    if (quotas.allowTemplates === 'all') return true;
    return (quotas.allowTemplates as string[]).includes(templateId);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => {
        const allowed = isTemplateAllowed(template.id);
        
        return (
          <div
            key={template.id}
            className={`border rounded-xl p-4 relative ${
              allowed
                ? 'border-border-default hover:border-accent cursor-pointer'
                : 'border-border-default opacity-60 cursor-not-allowed'
            }`}
          >
            {!allowed && (
              <div className="absolute top-2 right-2 bg-gray-800 rounded-full p-1.5">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
            )}

            <h3 className="font-semibold text-white mb-2">{template.name}</h3>
            <p className="text-sm text-gray-400 mb-4">{template.description}</p>

            {allowed ? (
              <button
                onClick={() => router.push(`/editor?template=${template.id}`)}
                className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold transition-colors"
              >
                Use Template
              </button>
            ) : (
              <button
                onClick={() => window.location.href = '/api/auth/signin'}
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
              >
                Sign in to unlock
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Purpose**: Visual differentiation between available and locked templates.

---

## Phase 4: Testing & Polish

### 4.1 Testing Checklist

**Guest User Flow**:
- [ ] Can generate 3 diagrams per hour (4th blocked with clear message)
- [ ] Can only create/work with 1 canvas at a time
- [ ] Canvas is lost on browser refresh (intentional)
- [ ] Can only export JSON and PNG (with watermark)
- [ ] PNG/SVG export shows upgrade modal
- [ ] Share button shows upgrade modal
- [ ] Can access only 5 basic templates
- [ ] Premium templates show lock icon + "Sign in to unlock"
- [ ] Tutorial access works but progress isn't saved
- [ ] Dashboard redirects to editor
- [ ] Persistent banner shows "Sign in to save" message
- [ ] Floating quota indicator shows remaining generations

**Authenticated User Flow**:
- [ ] Can generate 10 diagrams per day (11th blocked until reset)
- [ ] Can create up to 5 canvases
- [ ] 6th canvas creation shows limit message
- [ ] Canvases persist across sessions
- [ ] Auto-save works every 30 seconds
- [ ] Can export JSON, PNG (no watermark), SVG
- [ ] Can create share links (7-day expiry)
- [ ] Can access all templates
- [ ] Tutorial progress is saved to database
- [ ] Dashboard shows quota usage cards
- [ ] Can duplicate canvases
- [ ] No guest mode banners shown

**API Endpoint Protection**:
- [ ] `/api/generate-diagram` enforces quotas correctly
- [ ] `/api/user/canvases` rejects guest saves
- [ ] `/api/user/canvases` enforces canvas count limit
- [ ] `/api/user/canvases` enforces node count limit
- [ ] `/api/diagram/load` (sharing) rejects guest requests
- [ ] `/api/diagram/export` enforces format restrictions
- [ ] `/api/components/templates` filters templates by tier
- [ ] All protected endpoints return meaningful error messages

**Edge Cases**:
- [ ] Daily quota resets at midnight (check timezone handling)
- [ ] Redis failure degrades gracefully (allows requests)
- [ ] Database failure falls back to guest mode
- [ ] Offline mode shows appropriate messaging
- [ ] Race condition when hitting quota limit simultaneously
- [ ] Guest ID collision handling (unlikely but possible)
- [ ] LocalStorage quota exceeded for guests (test with large canvases)

---

### 4.2 Migration Strategy

**For Existing Users**:

1. **Add default values in migration**:
```sql
-- In the Prisma migration file
UPDATE "User" SET 
  "daily_generations" = 0,
  "daily_generations_date" = NOW(),
  "total_generations" = 0
WHERE "daily_generations" IS NULL;
```

2. **Backfill usage logs** (optional):
```typescript
// One-time script: scripts/backfill-usage-logs.ts
import prisma from '@/lib/prisma';

async function backfillUsageLogs() {
  // Estimate historical usage from existing canvas counts
  const users = await prisma.user.findMany({
    include: { userCanvases: true },
  });

  for (const user of users) {
    // Conservative estimate: 1 generation per canvas
    await prisma.user.update({
      where: { id: user.id },
      data: { totalGenerations: user.userCanvases.length },
    });
  }

  console.log('✅ Usage backfill complete');
}

backfillUsageLogs();
```

3. **Communicate changes to existing users**:
   - In-app notification banner: "We've added usage tracking to improve the experience. Your existing canvases are safe!"
   - Email announcement (if you have user emails): Explain the free tier benefits

---

### 4.3 Monitoring & Analytics

**Track These Metrics**:

```typescript
// In lib/analytics.ts or your tracking setup

// Conversion funnel
analytics.track('guest_feature_blocked', { feature, timestamp });
analytics.track('upgrade_modal_shown', { feature, timestamp });
analytics.track('upgrade_modal_dismissed', { feature, timestamp });
analytics.track('signin_completed', { source: 'upgrade_modal', feature });

// Quota hit rates
analytics.track('quota_limit_reached', { tier, quotaType, timestamp });
analytics.track('quota_warning_shown', { tier, percentageUsed, timestamp });

// Feature usage by tier
analytics.track('feature_used', { feature, tier, timestamp });
```

**Dashboard Queries**:
- Guest → Signed-in conversion rate
- Feature block → Sign-in conversion rate (by feature)
- Quota exhaustion frequency (identify if limits are too restrictive)
- Average canvases per user (by tier)
- Daily active users by tier

---

## Phase 5: Optional Enhancements

### 5.1 Email Capture for Guests (Alternative to Immediate Sign-in)

If you want a softer conversion funnel, capture emails before forcing sign-up:

```typescript
// components/EmailCaptureModal.tsx
export function EmailCaptureModal({ feature, onSubmit, onClose }) {
  const [email, setEmail] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save to database for future marketing
    await fetch('/api/track/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, feature, source: 'feature_gate' }),
    });
    
    onSubmit(email);
  };
  
  return (
    <div className="modal">
      <h3>Get notified when this feature is available</h3>
      <p>We'll email you when {feature} is ready for guest users.</p>
      <form onSubmit={handleSubmit}>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          placeholder="your@email.com"
          required 
        />
        <button type="submit">Notify Me</button>
      </form>
      <button onClick={onClose}>Maybe Later</button>
    </div>
  );
}
```

---

### 5.2 Progressive Disclosure of Limitations

Instead of blocking immediately, show warnings before hitting limits:

```typescript
// In generate-diagram API
if (tier === 'authenticated') {
  const remaining = quotas.aiGenerationsPerDay - user.dailyGenerations;
  
  if (remaining <= 2) {
    // Include warning in response
    return NextResponse.json({
      ...result,
      warning: `You have ${remaining} generation${remaining === 1 ? '' : 's'} left today. Resets at midnight.`,
      showUpgradeHint: remaining === 1,
    });
  }
}
```

Show banner in UI when warning is present:
```typescript
// In editor
{warning && (
  <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2">
    <p className="text-sm text-yellow-200">{warning}</p>
  </div>
)}
```

---

### 5.3 Temporary Quota Boosts (Incentives)

Reward users for specific actions:

```typescript
// Give +5 bonus generations for:
// - Completing tutorial
// - Sharing on social media
// - Referring a friend

async function grantQuotaBoost(userId: string, amount: number, reason: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      featureFlags: {
        bonusGenerations: (user.featureFlags.bonusGenerations || 0) + amount,
        bonusReason: reason,
        bonusExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    },
  });
  
  await logUsage(userId, null, 'quota_boost_granted', { amount, reason });
}
```

---

### 5.4 Guest Session Recovery

Allow guests to "claim" their work when they sign up:

```typescript
// In /api/auth/callback/route.ts (after successful sign-in)
export async function GET(req: NextRequest) {
  // ... existing auth logic
  
  // Check if guest had unsaved work
  const guestCanvas = req.cookies.get('archdraw-guest-canvas-id')?.value;
  
  if (guestCanvas) {
    // Migrate guest canvas to authenticated user
    const canvasData = localStorage.getItem(guestCanvas); // Retrieve on client
    if (canvasData) {
      await prisma.userCanvas.create({
        data: {
          id: guestCanvas,
          userId: user.id,
          name: 'Recovered Canvas',
          nodes: JSON.parse(canvasData).nodes,
          edges: JSON.parse(canvasData).edges,
        },
      });
      
      toast.success('Your guest canvas has been saved to your account!');
    }
  }
  
  // Clear guest cookies
  res.cookies.delete('archdraw-guest-canvas-id');
}
```

---

## Implementation Timeline

### Week 1: Foundation
**Day 1-2**: Phase 1 - Core Infrastructure
- [ ] Create `lib/userQuotas.ts`
- [ ] Extend Prisma schema (User + UsageLog models)
- [ ] Run migration: `npx prisma migrate dev --name add_user_quotas_and_usage_logs`
- [ ] Create `lib/middleware/quotaCheck.ts`
- [ ] Unit test quota calculation logic

**Day 3-4**: Phase 2 - Server-Side Enforcement
- [ ] Update `/api/generate-diagram/route.ts` (AI quota)
- [ ] Update `/api/user/canvases/route.ts` (canvas limits)
- [ ] Update `/api/diagram/load/route.ts` (sharing)
- [ ] Update `/api/diagram/export/route.ts` (export formats)
- [ ] Create `/api/components/templates/route.ts` (template filtering)
- [ ] Create `/api/user/quota/route.ts` (quota status endpoint)
- [ ] Test all API endpoints with Postman/Insomnia

**Day 5-6**: Phase 3 - Client-Side UI/UX
- [ ] Update `store/diagramStore.ts` with quota awareness
- [ ] Create `components/QuotaIndicator.tsx`
- [ ] Create `components/UpgradeModal.tsx`
- [ ] Update `components/Toolbar.tsx` (export/share CTAs)
- [ ] Update `components/dashboard/DashboardClient.tsx` (quota cards)
- [ ] Update `views/Editor.tsx` (guest banner)
- [ ] Update `app/dashboard/templates/page.tsx` (locked templates)

**Day 7**: Phase 4 - Testing & Polish
- [ ] Run through guest user testing checklist
- [ ] Run through authenticated user testing checklist
- [ ] Test API endpoint protection
- [ ] Test edge cases (quota resets, Redis failure, etc.)
- [ ] Browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsiveness testing
- [ ] Performance testing (especially with quota checks)

### Week 2: Monitor & Iterate
- [ ] Deploy to production
- [ ] Monitor analytics (conversion rates, quota exhaustion)
- [ ] Gather user feedback
- [ ] Iterate on messaging and limits based on data

---

## Configuration Quick Reference

### Adjust Quotas
Edit `lib/userQuotas.ts`:
```typescript
export const USER_QUOTAS = {
  guest: {
    aiGenerationsPerHour: 3, // ← Change here
    maxCanvases: 1,
    // ...
  },
  authenticated: {
    aiGenerationsPerDay: 10, // ← Change here
    maxCanvases: 5,
    // ...
  },
};
```

### Disable Feature Gating (Emergency)
Add environment variable:
```bash
# .env.local
DISABLE_FEATURE_GATING=true
```

Then in middleware:
```typescript
export async function checkAIGenerationQuota(req: NextRequest) {
  if (process.env.DISABLE_FEATURE_GATING === 'true') {
    return { allowed: true };
  }
  // ... existing logic
}
```

---

## Success Metrics

### Target KPIs (3-Month Horizon)
- **Guest → Sign-up conversion**: 20-30%
- **Feature block → Sign-up conversion**: 35-45% (when blocked)
- **Daily Active Users**: 70% authenticated vs 30% guest
- **Average canvases per user**: 2.5 (authenticated)
- **Quota exhaustion rate**: <15% (sweet spot: users feel generous limits)

### Warning Signals
- Conversion rate <10%: Limits too restrictive or value prop unclear
- Quota exhaustion >30%: Limits too tight, frustrating users
- Bounce rate spike: Guest experience too limited

---

## Support & Documentation

### User-Facing Documentation

**Create**: `docs/quotas-and-limits.md`
```markdown
# Quotas & Limits

## Guest Users
- 3 AI diagram generations per hour
- 1 active canvas (session-only, not saved)
- Export to JSON and PNG (with watermark)
- Access to 5 starter templates

## Signed-In Users (Free)
- 10 AI diagram generations per day (resets at midnight)
- 5 saved canvases (persistent across devices)
- Export to JSON, PNG, SVG (no watermarks)
- Create shareable links (7-day expiry)
- Access to all 20+ templates
- Auto-save every 30 seconds

## FAQ
**Q: What happens to my guest canvas when I sign in?**  
A: Your work is automatically saved to your account.

**Q: When does the daily quota reset?**  
A: At midnight in your local timezone.

**Q: Can I request a quota increase?**  
A: Contact us at support@archdraw.com for special cases.
```

---

## Rollback Plan

If feature gating causes major issues:

1. **Immediate**: Set `DISABLE_FEATURE_GATING=true`
2. **Short-term**: Increase quotas to be more generous
3. **Long-term**: Revisit feature matrix based on feedback

**Rollback Database Migration**:
```bash
npx prisma migrate resolve --rolled-back add_user_quotas_and_usage_logs
```

---

## Next Steps After Implementation

1. **Week 2-4**: Monitor metrics, iterate on messaging
2. **Month 2**: Consider A/B testing different quota levels
3. **Month 3**: Analyze data to inform paid tier pricing
4. **Month 4**: Begin paid tier implementation (if metrics support it)

---

## Questions to Answer During Implementation

- [ ] Should guests get a trial boost on first use? (e.g., 10 generations on day 1)
- [ ] Should we show "X users signed up today" social proof?
- [ ] Should we offer temporary premium access for bug reports/feedback?
- [ ] Should we implement a referral system? ("Invite a friend, both get +5 generations")
- [ ] Should expired share links show a recovery option?

---

**END OF IMPLEMENTATION PLAN**

For questions or clarifications, reference this document and update it as decisions are made.
