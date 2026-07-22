# Design System Updates - Feature Gating Components

**Date**: 2026-07-22  
**Status**: ✅ Complete - Redesigned to match ArchDraw aesthetics

---

## 🎨 Design Philosophy Applied

All new components now follow your established design language:

### Core Principles
1. **Soft shadows** - `shadow-[0_4px_16px_rgba(0,0,0,0.08)]` instead of harsh shadows
2. **Rounded corners** - `rounded-[16px]` to `rounded-[20px]` for modals, `rounded-[8px]` for buttons
3. **Gradient accents** - `from-[#5e6ad2] to-[#828fff]` brand gradient
4. **Subtle borders** - `border-border/20` to `border-border/40` instead of solid colors
5. **Backdrop blur** - `backdrop-blur-sm` for depth
6. **Smooth transitions** - `duration-150` for all hover states
7. **CSS variables** - Using `hsl(var(--foreground))` pattern
8. **Gentle animations** - framer-motion with `ease-out` timing

---

## ✨ Component Redesigns

### 1. UpgradeModal Component

**Before**: Dark themed (`bg-[#1e293b]`), yellow accent, basic layout  
**After**: Matches your card aesthetic with gradient accents

#### Visual Changes
```tsx
// Header with gradient icon
<div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#5e6ad2] to-[#828fff]">
  <Sparkles className="w-5 h-5 text-white" />
</div>

// Benefits with green checkmarks
<div className="w-5 h-5 rounded-full bg-[#DCFCE7]">
  <Check className="w-3 h-3 text-[#22C55E]" />
</div>

// Primary button with your brand color
<button className="bg-[#5e6ad2] hover:bg-[#828fff] rounded-[10px]">
  Continue with Google
</button>
```

#### Key Features
- ✅ White modal (`bg-card`) instead of dark
- ✅ Gradient brand icon (sparkle)
- ✅ Green success checkmarks for benefits
- ✅ Smooth scale animations (`active:scale-[0.98]`)
- ✅ Google OAuth button with proper icon
- ✅ "Maybe later" as secondary action
- ✅ Matches ShareModal and TemplateModal styles

---

### 2. QuotaIndicator Component

**Before**: Yellow warning box with alert icon  
**After**: Elegant floating card with brand colors and animations

#### Visual Changes
```tsx
// Card with gradient header
<div className="bg-card border border-border/40 rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
  <div className="bg-gradient-to-br from-[#5e6ad2]/10 to-transparent">
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#5e6ad2] to-[#828fff]">
      <Sparkles className="w-3.5 h-3.5 text-white" />
    </div>
  </div>
</div>

// CTA button with hover arrow animation
<button className="bg-[#5e6ad2] hover:bg-[#828fff]">
  <ArrowRight className="group-hover:translate-x-0.5 transition-transform" />
</button>
```

#### Key Features
- ✅ Framer Motion entrance animation
- ✅ Dismissible (with session storage persistence)
- ✅ Gradient brand icon instead of alert icon
- ✅ Clean quota display ("2/3 this hour")
- ✅ Hover effects on CTA button
- ✅ Matches FloatingAIBar styling
- ✅ Bottom-right positioning with safe-area support

---

### 3. Editor Guest Banner

**Before**: Yellow warning banner (`bg-yellow-500/10`)  
**After**: Subtle branded banner matching nav bars

#### Visual Changes
```tsx
// Subtle gradient background
<div className="bg-gradient-to-r from-[#5e6ad2]/5 to-transparent border-b border-border/20 backdrop-blur-sm">
  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#5e6ad2] to-[#828fff]">
    {/* Info icon */}
  </div>
  <button className="bg-[#5e6ad2] hover:bg-[#828fff] text-white">
    Sign in
  </button>
</div>
```

#### Key Features
- ✅ Non-intrusive gradient background
- ✅ Brand color icon instead of alert
- ✅ Compact text with emphasis
- ✅ Branded CTA button
- ✅ Matches sticky header patterns
- ✅ Responsive truncation

---

## 🎨 Color Palette Used

### Brand Colors (Your Primary)
```css
--primary: #5e6ad2 (Brand Blue)
--primary-hover: #828fff (Lighter Blue)
```

### Semantic Colors
```css
--success: #22C55E (Green checkmarks)
--success-bg: #DCFCE7 (Light green backgrounds)
--border: hsl(var(--border)) (Adaptive borders)
--muted-foreground: hsl(var(--muted-foreground)) (Secondary text)
```

### Surface Colors
```css
--card: hsl(var(--card)) (Card backgrounds)
--secondary: hsl(var(--secondary)) (Hover states)
--foreground: hsl(var(--foreground)) (Primary text)
```

---

## 📐 Typography Scale

Matching your existing patterns:

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| Modal title | `16px` | `semibold` | Primary headings |
| Body text | `14px` | `normal` | Main content |
| Secondary | `13px` | `normal` | Descriptions |
| Small text | `12px` | `normal/semibold` | Labels, badges |
| Micro text | `11px` | `normal` | Meta info |

---

## 🔄 Animation Patterns

### Entrance Animations
```tsx
// Modal fade-in
animate-in fade-in zoom-in-95 duration-200

// Floating card motion
<motion.div
  initial={{ opacity: 0, y: 20, scale: 0.95 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
/>
```

### Interaction Animations
```tsx
// Button press
active:scale-[0.98]

// Hover translation
group-hover:translate-x-0.5 transition-transform duration-150

// Hover scale
group-hover:scale-110 transition-transform duration-150
```

---

## 🎯 Before & After Comparison

### UpgradeModal

**BEFORE**:
```
❌ Dark themed (#1e293b)
❌ Harsh border (border-white/10)
❌ Yellow accent colors
❌ Basic layout
❌ Generic emoji icon (✨)
❌ Simple green checkmarks
```

**AFTER**:
```
✅ Light themed (bg-card)
✅ Soft border (border-border/10)
✅ Brand gradient colors
✅ Polished layout matching ShareModal
✅ Gradient icon with proper component
✅ Green success badges with rounded backgrounds
✅ Google OAuth icon
✅ Smooth animations
```

### QuotaIndicator

**BEFORE**:
```
❌ Yellow warning theme
❌ AlertCircle icon
❌ Basic box layout
❌ Static display
❌ No dismiss option
```

**AFTER**:
```
✅ Brand gradient header
✅ Sparkles icon (branded)
✅ Card-based design
✅ Animated entrance
✅ Dismissible with persistence
✅ Hover effects on CTA
✅ Matches FloatingAIBar style
```

### Guest Banner

**BEFORE**:
```
❌ Yellow warning colors
❌ Harsh border
❌ Alert-style design
```

**AFTER**:
```
✅ Subtle gradient
✅ Soft border with blur
✅ Info-style (non-alarming)
✅ Branded CTA button
✅ Compact and elegant
```

---

## 🛠️ Implementation Details

### Imports Added
```typescript
// UpgradeModal.tsx
import { Sparkles, Loader2 } from 'lucide-react';

// QuotaIndicator.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
```

### CSS Classes Pattern
Following your conventions:
- `rounded-[Npx]` for explicit border radius
- `text-[Npx]` for explicit font sizes
- `shadow-[...]` for custom shadows
- `transition-all duration-150` for all interactions
- `hsl(var(--variable))` for color references

---

## ✅ Quality Checklist

- [x] Matches existing modal styles (ShareModal, TemplateModal)
- [x] Uses brand gradient colors
- [x] Soft shadows instead of harsh ones
- [x] Smooth animations (framer-motion)
- [x] Responsive design
- [x] Dismissible where appropriate
- [x] Accessible (proper ARIA labels)
- [x] TypeScript compiles cleanly
- [x] No console warnings
- [x] Dark mode compatible (via CSS variables)

---

## 🎨 Visual Hierarchy

### UpgradeModal
```
1. Header (gradient icon + title)
2. Benefits list (green checkmarks)
3. Primary CTA (Google sign-in)
4. Secondary action ("Maybe later")
```

### QuotaIndicator
```
1. Header (gradient icon + "Guest Mode")
2. Quota stats (X/3 this hour)
3. Description text
4. CTA button
5. Dismiss button (subtle, top-right)
```

---

## 🚀 Usage Examples

### UpgradeModal
```tsx
import { UpgradeModal, UPGRADE_BENEFITS } from '@/components/UpgradeModal';

<UpgradeModal
  isOpen={upgradeModal !== null}
  onClose={() => setUpgradeModal(null)}
  feature={upgradeModal?.feature || 'this feature'}
  message={upgradeModal?.message || 'Sign in to continue'}
  benefits={upgradeModal?.benefits || UPGRADE_BENEFITS.general}
/>
```

### QuotaIndicator
```tsx
import { QuotaIndicator } from '@/components/QuotaIndicator';

// Simply render - it handles guest detection
<QuotaIndicator />
```

---

## 📱 Responsive Behavior

### UpgradeModal
- Max width: `md` (448px)
- Mobile: Full width with 4 padding
- Centered on all screens
- Scrollable content if needed

### QuotaIndicator
- Fixed bottom-right
- Max width: 280px
- Mobile: 2 padding from edge
- `safe-area-bottom` for notched devices

---

## 🎭 Dark Mode Compatibility

All components use CSS variables:
```css
hsl(var(--card))           → Adaptive background
hsl(var(--foreground))     → Adaptive text
hsl(var(--border))         → Adaptive borders
hsl(var(--muted-foreground)) → Adaptive secondary text
```

Works in both light and dark themes automatically!

---

## 📊 Performance

### Optimizations Applied
- ✅ SessionStorage for QuotaIndicator dismissal (no re-render spam)
- ✅ Lazy loading for animations (framer-motion treeshaking)
- ✅ Minimal re-renders (proper React hooks)
- ✅ No layout shifts (fixed dimensions)
- ✅ GPU-accelerated transforms (`translate`, `scale`)

---

## 🔍 Accessibility

### ARIA Labels
```tsx
// Dismiss button
<button aria-label="Dismiss">

// Primary button
<button disabled={loading}>
  {loading ? 'Signing in…' : 'Continue with Google'}
</button>
```

### Keyboard Navigation
- ✅ Tab order maintained
- ✅ Focus states visible
- ✅ Escape to close (inherited from backdrop)
- ✅ Enter to submit

---

## 🎯 Next Steps

### Optional Enhancements
1. **Add pulse animation** to QuotaIndicator when quota is low (1 remaining)
2. **Show confetti** after successful sign-in
3. **Progress bar** in QuotaIndicator showing quota visually
4. **Toast notification** when quota resets

### Testing
```bash
# Visual testing
npm run dev

# Test guest mode
1. Clear localStorage
2. Open /editor
3. Verify QuotaIndicator appears
4. Test dismiss functionality
5. Try to export SVG → UpgradeModal should appear
6. Test responsive design (mobile view)
```

---

**Summary**: All new components now perfectly match your established design system with soft shadows, brand gradients, rounded corners, and smooth animations. The yellow warning theme has been replaced with your elegant brand colors. 🎨✨
