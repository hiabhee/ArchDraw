# Rate Limiting Configuration Guide

## Overview

The ArchDraw application implements Redis-based rate limiting with **dual resilience strategies**:

1. **Option A: Graceful Degradation** - Automatic fallback when Redis fails
2. **Option B: Environment Toggle** - Ability to disable rate limiting entirely

---

## Features

### ✅ Graceful Degradation (Option A)

The rate limiting system automatically handles Redis failures:

- **3-second timeout** on Redis operations
- **Automatic fallback** - allows requests if Redis is unavailable
- **Detailed logging** of all failures
- **No-op client** when Redis is not configured

```typescript
// If Redis fails, the request is allowed through with a warning log
catch (error) {
  logger.warn('[RateLimit] Redis error (graceful degradation): ...');
  return { allowed: true, remaining: limit, resetAt: now + windowSeconds };
}
```

### ✅ Environment Toggle (Option B)

Complete control via environment variable:

```bash
# Disable rate limiting (development)
ENABLE_RATE_LIMITING=false

# Enable rate limiting (production) - default
ENABLE_RATE_LIMITING=true
# or simply omit the variable (enabled by default)
```

---

## Configuration

### 1. Redis Setup (Recommended for Production)

```bash
# .env.local
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
ENABLE_RATE_LIMITING=true  # optional, true by default
```

### 2. Development Without Redis

```bash
# .env.local
ENABLE_RATE_LIMITING=false
```

### 3. Production Without Redis (Emergency Mode)

If Redis is down in production:

```bash
# Set via environment variable or deployment config
ENABLE_RATE_LIMITING=false
```

Or rely on graceful degradation (requests will go through with warnings in logs).

---

## Rate Limits

### Diagram Generation
- **Limit:** 5 requests per 60 seconds
- **Identifier:** User IP address
- **Endpoint:** `/api/generate-diagram`

### Tutorial Chat
- **Limit:** 15 requests per 60 seconds  
- **Identifier:** User IP address (prefixed with `chat:`)
- **Endpoint:** `/api/tutorial-chat`

---

## Monitoring

### Log Messages

**Rate limiting active:**
```
[RateLimit] Check passed - count: 2, limit: 5, allowed: true
```

**Rate limit exceeded:**
```
[API] Rate limit exceeded for 192.168.1.1
```

**Redis failure (graceful degradation):**
```
[RateLimit] Redis error (graceful degradation): Redis operation timeout
[API] Rate limit check failed, allowing request (graceful degradation)
```

**Rate limiting disabled:**
```
[API] Rate limiting disabled via ENABLE_RATE_LIMITING=false
```

---

## Troubleshooting

### Issue: Requests getting stuck

**Symptom:** Diagram generation hangs indefinitely

**Diagnosis:**
1. Check if Redis is responding: `curl $UPSTASH_REDIS_REST_URL`
2. Check application logs for timeout errors
3. Verify `GROQ_API_KEY` is set (not commented out)

**Solution:**
```bash
# Quick fix - disable rate limiting
ENABLE_RATE_LIMITING=false

# Or fix Redis connection
UPSTASH_REDIS_REST_URL="correct-url"
UPSTASH_REDIS_REST_TOKEN="correct-token"
```

### Issue: Rate limit not working

**Symptom:** Users can make unlimited requests

**Check:**
1. `ENABLE_RATE_LIMITING` is not set to `false`
2. Redis is properly configured
3. Check logs for Redis errors

### Issue: False rate limit triggers

**Symptom:** Users get rate limited incorrectly

**Possible causes:**
1. Shared IP addresses (users behind same proxy/NAT)
2. Redis key not expiring properly

**Solution:**
- Adjust rate limits in code
- Implement user-based rate limiting (requires authentication)

---

## Testing

### Test rate limiting is working:

```bash
# Send 6 requests rapidly (should get rate limited on 6th)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/generate-diagram \
    -H "Content-Type: application/json" \
    -d '{"description":"test"}' \
    -w "\n%{http_code}\n"
  sleep 1
done
```

Expected: First 5 return 200, 6th returns 429

### Test graceful degradation:

```bash
# Set invalid Redis credentials
UPSTASH_REDIS_REST_TOKEN="invalid"

# Restart app and try generating
# Should work with warning logs about Redis failure
```

### Test environment toggle:

```bash
# Disable rate limiting
ENABLE_RATE_LIMITING=false

# All requests should go through regardless of count
```

---

## Best Practices

### Development
- Use `ENABLE_RATE_LIMITING=false` for local development
- Uncomment `GROQ_API_KEY` in `.env.local`

### Staging
- Enable rate limiting: `ENABLE_RATE_LIMITING=true`
- Configure Redis with test credentials
- Test graceful degradation by intentionally breaking Redis

### Production
- **Always** enable rate limiting (default behavior)
- Configure proper Redis with backup/monitoring
- Monitor logs for graceful degradation warnings
- Set up alerts for frequent Redis failures
- Consider CloudFlare or API Gateway rate limiting as additional layer

---

## Architecture

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Check ENABLE_RATE_LIMITING env var  │
└──────┬──────────────────────────────┘
       │
       ├─(false)──► Skip rate limiting
       │
       └─(true)───► ┌──────────────────────┐
                    │  checkRateLimit()    │
                    │  (3s timeout)        │
                    └──────┬───────────────┘
                           │
                    ┌──────┴───────┐
                    │              │
               (success)      (error/timeout)
                    │              │
                    ▼              ▼
            ┌───────────┐  ┌────────────────┐
            │ Check     │  │ Log warning +  │
            │ count     │  │ allow request  │
            └─────┬─────┘  │ (graceful      │
                  │        │  degradation)  │
           ┌──────┴──────┐ └────────────────┘
           │             │
      (allowed)     (rate limited)
           │             │
           ▼             ▼
    ┌──────────┐  ┌──────────┐
    │ Process  │  │ Return   │
    │ Request  │  │ 429      │
    └──────────┘  └──────────┘
```

---

## Summary

Both resilience options are now implemented:

- ✅ **Option A**: Automatic graceful degradation with timeout and detailed logging
- ✅ **Option B**: Environment variable toggle (`ENABLE_RATE_LIMITING`)

The system will **never block legitimate requests** due to Redis issues:
1. If Redis times out → request allowed
2. If Redis is misconfigured → request allowed  
3. If `ENABLE_RATE_LIMITING=false` → rate limiting skipped entirely

This ensures high availability while maintaining security in normal operations.
