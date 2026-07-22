# Quick Troubleshooting Guide

## Diagram Generation Getting Stuck

If your diagram generation is hanging or getting stuck, follow these steps:

### Step 1: Check GROQ_API_KEY

Your `.env.local` file should have:

```bash
# Make sure this is UNCOMMENTED (no # at the start)
GROQ_API_KEY=your_groq_api_key_here

# OR use the fallback key (also works)
GROQ_API_KEY_FOR_DESC_1=your_groq_api_key_here
```

**Currently:** Your `GROQ_API_KEY` is commented out in `.env.local`:
```bash
# GROQ_API_KEY=your_groq_api_key_here... ← THIS IS COMMENTED OUT!
```

**Fix:** Uncomment it or copy the value from `GROQ_API_KEY_FOR_DESC_1`.

---

### Step 2: Temporarily Disable Rate Limiting

Add to your `.env.local`:

```bash
ENABLE_RATE_LIMITING=false
```

This bypasses any potential Redis issues.

---

### Step 3: Restart Development Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

---

### Step 4: Test Diagram Generation

1. Open http://localhost:3000
2. Try generating a simple diagram: "Load balancer with two servers"
3. Check the terminal for error messages

---

### Step 5: Check Logs

Look for these messages in your terminal:

**Good signs:**
```
[API] Rate limiting disabled via ENABLE_RATE_LIMITING=false
[RateLimit] Check passed - count: 1, limit: 5, allowed: true
```

**Warning signs:**
```
[RateLimit] Redis error (graceful degradation): ...
[API] Rate limit check failed, allowing request
GROQ_API_KEY is not configured
```

---

## Common Issues

### Issue: "GROQ_API_KEY is not configured"

**Fix:**
```bash
# .env.local
GROQ_API_KEY=your_groq_api_key_here
```

### Issue: Redis connection timeout

**Symptoms:**
- Long delay before response
- "Redis operation timeout" in logs

**Fix:**
```bash
# .env.local
ENABLE_RATE_LIMITING=false
```

### Issue: Still getting stuck after fixes

**Debug steps:**

1. **Check browser console** (F12 → Console tab):
   - Look for failed network requests
   - Check the response of `/api/generate-diagram`

2. **Check network tab** (F12 → Network tab):
   - Is the request to `/api/generate-diagram` pending forever?
   - What's the status code?

3. **Try a simple curl request**:
```bash
curl -X POST http://localhost:3000/api/generate-diagram \
  -H "Content-Type: application/json" \
  -d '{"description":"simple load balancer"}' \
  -v
```

---

## Quick Recovery Steps

If nothing works, do a **full reset**:

```bash
# 1. Stop the dev server
# Ctrl+C

# 2. Edit .env.local
# Uncomment GROQ_API_KEY
# Add ENABLE_RATE_LIMITING=false

# 3. Clear Next.js cache
rm -rf .next

# 4. Reinstall dependencies (if needed)
npm install

# 5. Restart dev server
npm run dev

# 6. Try again in browser
```

---

## Verification Checklist

Before asking for help, verify:

- [ ] `GROQ_API_KEY` is set and not commented out
- [ ] `.env.local` file exists in project root
- [ ] Dev server restarted after changing `.env.local`
- [ ] No errors in terminal when starting dev server
- [ ] Browser can access http://localhost:3000
- [ ] No errors in browser console (F12)

---

## Still Stuck?

Provide this information:

1. **Terminal output** when running `npm run dev`
2. **Browser console errors** (F12 → Console)
3. **Network request details** (F12 → Network → click on generate-diagram request)
4. **Contents of `.env.local`** (hide sensitive values):
```bash
cat .env.local | sed 's/=.*/=***HIDDEN***/g'
```

5. **Test the API directly**:
```bash
curl -X POST http://localhost:3000/api/generate-diagram \
  -H "Content-Type: application/json" \
  -d '{"description":"test"}' \
  2>&1
```
