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

The application uses a strict Content Security Policy (CSP) to prevent XSS attacks:

- `unsafe-eval` has been removed from script sources
- `unsafe-inline` is retained only where necessary for inline scripts
- Frame sources are restricted to trusted domains

### Embed Security

To restrict which domains can embed your diagrams:

```env
ALLOWED_EMBED_DOMAINS=trusted-domain.com,another-trusted-domain.com
```

If not set, defaults to allowing all domains (`*`). For production, specify exact domains.

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

### Headers
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: restricts camera, microphone, geolocation
- Content-Security-Policy: strict CSP policy

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