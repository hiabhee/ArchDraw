# Security Configuration Guide

This document outlines security best practices and configuration options for ArchDraw.

## Environment Variables

### Critical Security Variables

These variables must be properly configured for secure operation in production:

- `BETTER_AUTH_SECRET`: Secret key for authentication sessions. Must be a strong, random string in production.
- `BETTER_AUTH_URL`: The canonical URL of your application. Required in production for OAuth to work correctly.
- `DATABASE_URL`: PostgreSQL connection string. Use SSL connections in production.
- `ADMIN_PASSCODE` & `ADMIN_SESSION_SECRET`: Required for admin panel access. Use strong, unique values.

### Admin Security

The admin panel has enhanced security features:

1. **Rate Limiting**: 5 login attempts per IP per 15 minutes
2. **Session Binding**: Admin sessions are bound to user agent in production
3. **Secure Cookies**: HttpOnly, Secure (in production), and SameSite policies
4. **Timing-Safe Comparison**: Passcode comparison uses constant-time algorithm

Configure admin access with:
```env
ADMIN_PASSCODE=your_strong_passcode
ADMIN_SESSION_SECRET=your_strong_session_secret
ALLOWED_ADMIN_EMAIL=admin@yourdomain.com
NEXT_PUBLIC_ADMIN_EMAIL=admin@yourdomain.com
```

### Content Security Policy

The application uses a strict Content Security Policy (CSP) in `frontend/next.config.ts`:

- `script-src 'self' 'unsafe-inline' blob:` + `https://*.vercel-scripts.com` — `unsafe-eval` only in `development` for React devtools; never in production
- A nonce-based `'strict-dynamic'` policy was reverted (see `docs/csp-nonce-client-js-outage.md`) because Next.js only stamps nonces when the root layout opts into dynamic rendering via `headers()`, which broke static pages
- `/embed/:path*` carries its own `frame-ancestors` policy derived from `ALLOWED_EMBED_DOMAINS`

### Embed Security

To restrict which domains can embed your diagrams (`/embed/:path*`):

```env
ALLOWED_EMBED_DOMAINS=trusted-domain.com,another-trusted-domain.com
# ALLOWED_EMBED_DOMAINS=*  → explicitly allow embedding from anywhere
```

If not set, defaults to **same-origin only** (`frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`). For production, set an explicit allowlist or `*` if you need public embeds. Values are validated in `next.config.ts` to prevent CSP injection.

### API Key Security

- Groq API keys are no longer initialized with `dangerouslyAllowBrowser: true`
- Multiple API keys can be configured for load balancing and failover
- Keys are rotated automatically on rate limits or errors

## Production Deployment Checklist

Before deploying to production:

1. **Set all required environment variables**
   - `BETTER_AUTH_SECRET` (strong random string)
   - `BETTER_AUTH_URL` (your production URL)
   - `DATABASE_URL` (with SSL)
   - `GROQ_API_KEY`

2. **Configure admin access** (if using admin panel)
   - Set strong `ADMIN_PASSCODE` and `ADMIN_SESSION_SECRET`
   - Configure `ALLOWED_ADMIN_EMAIL`
   - Set `NEXT_PUBLIC_ADMIN_EMAIL`

3. **Restrict embed domains** (if using embed feature)
   - Set `ALLOWED_EMBED_DOMAINS` to specific domains

4. **Enable OAuth providers** (optional)
   - Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

5. **Enable Redis** (recommended for production)
   - Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

6. **Set NODE_ENV**
   - `NODE_ENV=production` (enables production security features)

## Security Features

### Authentication
- OAuth 2.0 via Google and GitHub
- Session-based authentication with secure cookies
- CSRF protection via SameSite cookie policies

### API Security
- Rate limiting on admin endpoints
- IP-based tracking for admin sessions
- User agent binding for admin sessions in production

### Data Protection
- All database connections should use SSL
- API keys are never exposed to client-side code
- Sensitive environment variables are server-side only

### Headers (`next.config.ts:6`)
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 0 (legacy auditor disabled per OWASP — rely on CSP)
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- Content-Security-Policy: strict static policy (see above); `frame-ancestors` enforced for embeds

## Monitoring and Logging

The application includes security-focused logging:

- Admin authentication attempts
- Session validation failures
- User agent mismatches
- Rate limit violations

Monitor these logs for suspicious activity in production.

## Development vs Production

In development mode:
- Security validations are warnings rather than errors
- Cookies may use `lax` SameSite policy for local testing
- Embed defaults to allow all domains

In production mode:
- Security validations are enforced (will throw errors)
- Cookies use `strict` SameSite policy
- Admin sessions require user agent binding
- CSP and other headers are strictly enforced

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not create public issues for security vulnerabilities
2. Send details to the project maintainers privately
3. Include steps to reproduce the vulnerability
4. Allow time for the issue to be addressed before disclosure

## Additional Resources

- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)