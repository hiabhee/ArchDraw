# Security Pre-Commit Checklist 🔒

**CRITICAL**: Run this checklist before committing to GitHub or deploying to production!

---

## 1. Environment Variables ⚠️

### Verify No Secrets in Git
```bash
# Check if .env files are tracked
git ls-files | grep -E "\.env"

# Should return ONLY:
# .env.example ✅

# If you see .env or .env.local, STOP and run:
git rm --cached .env
git rm --cached .env.local
```

### Current Status
- ✅ `.env.example` is tracked (safe, no secrets)
- ⚠️ `.env` is NOT tracked (gitignored) ✅
- ⚠️ `.env.local` is NOT tracked (gitignored) ✅

### Verify .gitignore
```bash
# Check that .gitignore includes:
cat .gitignore | grep -E "^\.env"

# Should output:
# .env*
```

✅ **Verified**: Environment files are properly gitignored

---

## 2. Exposed Secrets Scan 🔍

### Search for Hardcoded Secrets
```bash
# Search for potential API keys in code
grep -r "gsk_" --exclude-dir=node_modules --exclude-dir=.next --exclude="*.md" .
grep -r "sk-or-v1" --exclude-dir=node_modules --exclude-dir=.next --exclude="*.md" .
grep -r "ghp_" --exclude-dir=node_modules --exclude-dir=.next --exclude="*.md" .
grep -r "GOCSPX" --exclude-dir=node_modules --exclude-dir=.next --exclude="*.md" .

# Should return NO results (or only in .env.example as placeholders)
```

### API Keys to Watch For
- ❌ GROQ API Keys: `gsk_...`
- ❌ OpenRouter Keys: `sk-or-v1-...`
- ❌ GitHub Tokens: `ghp_...`
- ❌ Google OAuth: `GOCSPX-...`
- ❌ Database Passwords
- ❌ Redis Tokens
- ❌ Better Auth Secrets

---

## 3. Database Credentials ⚠️

### Check for Exposed Connection Strings
```bash
# Search for database URLs (excluding env files and docs)
grep -r "postgresql://" --exclude-dir=node_modules --exclude-dir=.next --exclude="*.md" --exclude=".env*" .

# Should return ONLY:
# - .env.example (with placeholder)
# - Prisma schema (using env variables)
```

### Safe Patterns ✅
```typescript
// GOOD: Using environment variables
const db = process.env.DATABASE_URL

// GOOD: Prisma schema
url = env("DATABASE_URL")
```

### Unsafe Patterns ❌
```typescript
// BAD: Hardcoded credentials
const db = "postgresql://user:password@host/db"

// BAD: In configuration files
DATABASE_URL="postgresql://real-password"
```

---

## 4. OAuth Secrets 🔐

### Verify OAuth Configuration
```bash
# Check for exposed OAuth secrets
grep -r "GOOGLE_CLIENT_SECRET" --exclude-dir=node_modules --exclude="*.md" --exclude=".env*" .
grep -r "GITHUB_CLIENT_SECRET" --exclude-dir=node_modules --exclude="*.md" --exclude=".env*" .

# Should only appear in:
# - lib/auth.ts (reading from process.env)
# - .env.example (placeholder)
```

### OAuth Redirect URIs
**Production**: Ensure OAuth apps only allow:
- `https://your-domain.com/api/auth/callback/google`
- `https://your-domain.com/api/auth/callback/github`

**Do NOT allow**:
- `http://localhost` in production OAuth apps (create separate dev apps)

---

## 5. Admin Credentials 🚨

### Admin Passcode
```bash
# Check for hardcoded admin passcodes
grep -r "ADMIN_PASSCODE" --exclude-dir=node_modules --exclude="*.md" --exclude=".env*" .

# Should ONLY appear in:
# - Code reading from process.env.ADMIN_PASSCODE
# - .env.example (placeholder)
```

### Admin Session Secrets
```bash
# Check for exposed session secrets
grep -r "ADMIN_SESSION_SECRET" --exclude-dir=node_modules --exclude="*.md" --exclude=".env*" .
```

---

## 6. Production Environment Check 🌐

### Environment Variable Differences

| Variable | Development | Production |
|----------|-------------|------------|
| `BETTER_AUTH_URL` | `http://localhost:3001` | `https://your-domain.com` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3001` | `https://your-domain.com` |
| `BETTER_AUTH_SECRET` | Dev secret | **NEW** production secret |
| `ADMIN_SESSION_SECRET` | Dev secret | **NEW** production secret |
| `DATABASE_URL` | Dev database | Production database |
| OAuth Client IDs | Dev app | Production app |

⚠️ **CRITICAL**: NEVER use development secrets in production!

---

## 7. Code Review Checklist 📝

### Before Committing
- [ ] No API keys hardcoded in source files
- [ ] No database passwords in code
- [ ] No OAuth secrets exposed
- [ ] `.env` and `.env.local` are gitignored
- [ ] Only `.env.example` is tracked by git
- [ ] All secrets use `process.env.VARIABLE_NAME`
- [ ] No sensitive data in console.log statements
- [ ] No commented-out code with secrets

### Safe to Commit ✅
- Configuration files (without secrets)
- `.env.example` with placeholder values
- Code reading from `process.env`
- Public URLs and endpoints
- Client-side configuration
- Documentation files

### NEVER Commit ❌
- `.env` or `.env.local` files
- API keys or tokens
- Database passwords
- OAuth client secrets
- Private keys or certificates
- User data or PII

---

## 8. Git History Audit 🕵️

### Check Git History for Secrets
```bash
# Search git history for potential secrets
git log -p | grep -E "gsk_|sk-or-v1|ghp_|postgresql://.*:.*@" | head -20

# If found, you MUST clean git history:
# WARNING: This rewrites history and requires force push
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env .env.local" \
  --prune-empty --tag-name-filter cat -- --all
```

⚠️ **If secrets are found in git history**: Consider them compromised and rotate ALL secrets immediately!

---

## 9. Vercel/Production Platform Security 🚀

### Before Deploying to Vercel

1. **Environment Variables Set Correctly**
   - [ ] All production environment variables added to Vercel dashboard
   - [ ] Variables set for "Production" environment
   - [ ] Secrets are NOT in git, only in Vercel settings

2. **OAuth Configuration**
   - [ ] Production redirect URIs registered with Google
   - [ ] Production redirect URIs registered with GitHub
   - [ ] Dev and prod use separate OAuth apps

3. **Database Security**
   - [ ] Production database has strong password
   - [ ] SSL/TLS enabled (`sslmode=require`)
   - [ ] Connection pooling configured
   - [ ] Backups enabled

4. **Redis Security**
   - [ ] Upstash Redis uses separate database from dev
   - [ ] REST tokens are unique to production

---

## 10. Post-Deployment Security 🛡️

### After Going Live

1. **Monitor for Exposed Secrets**
   - Use tools like GitGuardian or TruffleHog
   - Set up GitHub secret scanning (free for public repos)
   - Monitor Vercel logs for errors exposing secrets

2. **Rotate Secrets Regularly**
   - Better Auth secrets: Every 90 days
   - API keys: When rate limits hit or suspected compromise
   - OAuth secrets: Only if compromised
   - Database passwords: Every 90 days

3. **Access Control**
   - Limit who has access to Vercel project settings
   - Limit who has access to database console
   - Use separate accounts for dev vs prod

---

## 11. Quick Security Commands 🚀

### Pre-Commit Security Scan
```bash
#!/bin/bash
# Save as: scripts/pre-commit-security-check.sh

echo "🔍 Running security checks..."

# Check for tracked env files
if git ls-files | grep -qE "^\.env$|^\.env\.local$"; then
  echo "❌ ERROR: .env files are tracked by git!"
  exit 1
fi

# Check for API keys in staged files
if git diff --cached | grep -qE "gsk_[a-zA-Z0-9]{32,}|sk-or-v1-[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}"; then
  echo "❌ ERROR: Potential API key found in staged changes!"
  exit 1
fi

# Check for database credentials
if git diff --cached | grep -qE "postgresql://[^:]+:[^@]+@"; then
  echo "❌ ERROR: Database credentials found in staged changes!"
  exit 1
fi

echo "✅ Security checks passed!"
exit 0
```

### Make Executable and Run
```bash
chmod +x scripts/pre-commit-security-check.sh
./scripts/pre-commit-security-check.sh
```

---

## 12. Emergency Response Plan 🚨

### If Secrets Are Exposed

1. **Immediate Actions** (within 5 minutes)
   - [ ] Rotate ALL exposed secrets immediately
   - [ ] Revoke compromised API keys
   - [ ] Change database passwords
   - [ ] Regenerate OAuth secrets
   - [ ] Force logout all users

2. **Investigation** (within 1 hour)
   - [ ] Check Vercel logs for unauthorized access
   - [ ] Review database audit logs
   - [ ] Check API usage for anomalies
   - [ ] Identify what was exposed and for how long

3. **Remediation** (within 24 hours)
   - [ ] Clean git history if secrets were committed
   - [ ] Force push cleaned history (coordinate with team)
   - [ ] Update all environments with new secrets
   - [ ] Notify affected users if data breach occurred

4. **Prevention** (within 1 week)
   - [ ] Implement pre-commit hooks
   - [ ] Set up secret scanning (GitGuardian, etc.)
   - [ ] Review access control policies
   - [ ] Train team on security best practices

---

## 13. Final Checklist Before Production 📋

### Critical Security Items
- [ ] No secrets in git history
- [ ] `.env` files are gitignored
- [ ] All production secrets are NEW (not reused from dev)
- [ ] OAuth uses separate apps for dev/prod
- [ ] Database has strong password and SSL
- [ ] Admin passcode is strong and unique
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] HTTPS is enforced (Vercel does this automatically)
- [ ] Error messages don't expose sensitive info

### Team Communication
- [ ] All team members know NOT to commit secrets
- [ ] Emergency contacts established
- [ ] Incident response plan documented
- [ ] Access to rotate secrets is available 24/7

---

## 14. Useful Security Tools 🛠️

### Recommended Tools
- **GitGuardian**: Scan for secrets in git history
- **TruffleHog**: Find secrets in git repos
- **git-secrets**: Prevent committing secrets (AWS tool)
- **GitHub Secret Scanning**: Built-in for GitHub repos
- **Vercel Security**: Built-in environment variable encryption

### Install git-secrets (Optional but Recommended)
```bash
# macOS
brew install git-secrets

# Configure for your repo
cd /path/to/your/repo
git secrets --install
git secrets --register-aws

# Add custom patterns
git secrets --add 'gsk_[a-zA-Z0-9]{32,}'
git secrets --add 'sk-or-v1-[a-zA-Z0-9]+'
```

---

## Summary ✅

**Your application's security status:**

✅ **Environment files properly gitignored**  
✅ **No secrets found in source code**  
✅ **OAuth configuration uses environment variables**  
✅ **Database credentials secured**  
⚠️ **Action required**: Generate NEW production secrets  
⚠️ **Action required**: Set up separate prod OAuth apps  

**You are ready to deploy securely!**

---

**Remember**: Security is an ongoing process, not a one-time checklist. Stay vigilant! 🛡️
