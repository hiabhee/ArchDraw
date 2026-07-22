# Vercel Deployment Guide 🚀

Quick step-by-step guide to deploy ArchDraw to production on Vercel.

---

## Prerequisites ✅

- GitHub repository with your code
- Vercel account (free tier works)
- Production database (Neon PostgreSQL recommended)
- Upstash Redis account (free tier works)
- Google OAuth credentials
- GROQ API key

---

## Step 1: Prepare Production Secrets 🔐

Generate new secrets for production (never reuse dev secrets):

```bash
# Generate Better Auth Secret
openssl rand -hex 32

# Generate Admin Session Secret
openssl rand -hex 32
```

**Save these somewhere secure!**

---

## Step 2: Set Up OAuth Providers

### Google OAuth
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI:
   ```
   https://your-domain.com/api/auth/callback/google
   ```
4. Save `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### GitHub OAuth
1. Go to https://github.com/settings/developers
2. Create new OAuth App
3. Set Authorization callback URL:
   ```
   https://your-domain.com/api/auth/callback/github
   ```
4. Save `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

---

## Step 3: Set Up Database (Neon)

1. Go to https://neon.tech and create new project
2. Copy the connection strings:
   - **Pooled connection** → `DATABASE_URL`
   - **Direct connection** → `DIRECT_URL`
3. Both should have `sslmode=require`

Example:
```bash
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/archdraw?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/archdraw?sslmode=require"
```

---

## Step 4: Set Up Redis (Upstash)

1. Go to https://upstash.com and create new Redis database
2. Navigate to "REST API" tab
3. Copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

---

## Step 5: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. **Connect Repository**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select the `frontend` folder as root directory (if monorepo)

2. **Configure Build Settings**
   ```
   Framework Preset: Next.js
   Root Directory: ./frontend (or leave blank if not monorepo)
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   Node Version: 20.x
   ```

3. **Add Environment Variables** (click "Environment Variables" tab)
   
   Copy these into Vercel's environment variables panel:

   ```bash
   # ── Database ──────────────────────────────────────────────
   DATABASE_URL=postgresql://...
   DIRECT_URL=postgresql://...

   # ── Better Auth ───────────────────────────────────────────
   BETTER_AUTH_SECRET=<your-64-char-hex>
   BETTER_AUTH_URL=https://your-domain.vercel.app
   NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
   NEXT_PUBLIC_AUTH_ENABLED=true

   # ── OAuth Providers ───────────────────────────────────────
   GOOGLE_CLIENT_ID=<your-google-client-id>
   GOOGLE_CLIENT_SECRET=<your-google-secret>
   GITHUB_CLIENT_ID=<your-github-client-id>
   GITHUB_CLIENT_SECRET=<your-github-secret>

   # ── AI & APIs ─────────────────────────────────────────────
   GROQ_API_KEY=gsk_...
   OPENROUTER_API_KEY=sk-or-v1-...
   GITHUB_TOKEN=ghp_...

   # ── Rate Limiting (Redis) ─────────────────────────────────
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ENABLE_RATE_LIMITING=true

   # ── Admin Access ──────────────────────────────────────────
   ADMIN_PASSCODE=<your-secure-passcode>
   ADMIN_SESSION_SECRET=<your-64-char-hex>
   ADMIN_USER_ID=<your-uuid-after-first-login>

   # ── Analytics ─────────────────────────────────────────────
   NEXT_PUBLIC_ANALYTICS_ENABLED=true

   # ── Optional: Backup GROQ Keys ────────────────────────────
   GROQ_API_KEY_FOR_DESC_1=gsk_...
   GROQ_API_KEY_FOR_DESC_2=gsk_...
   # ... add more if you have rotation setup
   ```

   **Important**: Set these for **Production**, **Preview**, and **Development** environments

4. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - Note your deployment URL

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from frontend directory)
cd frontend
vercel --prod

# Follow prompts to configure project
```

---

## Step 6: Run Database Migrations

After deployment, run migrations:

```bash
# Option 1: Via Vercel CLI
vercel env pull .env.production
npx prisma migrate deploy

# Option 2: In Vercel Dashboard
# Go to your project → Settings → Functions
# Add a one-time serverless function or use Vercel's CLI
```

---

## Step 7: Configure Custom Domain (Optional)

1. Go to project settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. **Update environment variables** after domain is active:
   ```bash
   BETTER_AUTH_URL=https://your-custom-domain.com
   NEXT_PUBLIC_APP_URL=https://your-custom-domain.com
   ```
5. **Update OAuth redirect URIs** in Google and GitHub to use new domain

---

## Step 8: Post-Deployment Verification

### Test Checklist
1. **Homepage loads**: Visit `https://your-domain.vercel.app`
2. **Sign in works**: Test Google OAuth login
3. **AI generation**: Create a test diagram as guest
4. **Authenticated generation**: Create diagram as logged-in user
5. **Canvas export**: Export to PNG/PDF/SVG
6. **Settings modal**: Open and test all 7 tabs
7. **Admin dashboard**: Access `/admin` with passcode
8. **Mobile responsive**: Test on mobile device

### Check Logs
- Go to Vercel Dashboard → Deployments → [Latest] → View Logs
- Look for errors in Functions tab
- Monitor Real-time logs

### Get Admin User ID
1. Sign in to your app with Google
2. Go to Vercel Dashboard → Your Project → Storage → Neon
3. Or run SQL query:
   ```sql
   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;
   ```
4. Copy your user ID and add it to environment variables:
   ```bash
   ADMIN_USER_ID=<your-uuid>
   ```
5. Redeploy to apply changes

---

## Step 9: Enable Analytics

### Vercel Analytics (Recommended)
1. Go to project settings → Analytics
2. Enable Analytics (free tier: 100k events/month)
3. Enable Speed Insights

### Admin Dashboard
- Access at `https://your-domain.com/admin`
- View live users, sessions, funnels, prompts

---

## Step 10: Monitor & Maintain

### Health Checks
- `/` - Landing page
- `/api/test-env` - Environment config check
- `/api/auth/session` - Auth status
- `/editor` - Canvas editor

### Monitoring
- **Vercel Dashboard**: Real-time logs, analytics
- **Database**: Monitor Neon dashboard for connection pool
- **Redis**: Monitor Upstash dashboard for rate limits
- **Errors**: Check Vercel Functions logs

### Scaling
- Vercel automatically scales serverless functions
- Neon auto-scales database (up to plan limits)
- Upstash Redis has generous free tier

---

## Troubleshooting 🔧

### Build Fails
- Check Node version (should be 20.x)
- Verify all dependencies are in `package.json`
- Check build logs for specific errors
- Ensure `npm run build` works locally

### Environment Variables Not Working
- Double-check variable names (case-sensitive)
- Ensure set for correct environment (Production/Preview/Development)
- Redeploy after changing environment variables
- Use `/api/test-env` to verify

### OAuth Login Fails
- Verify redirect URIs match exactly (including https://)
- Check client ID and secret are correct
- Ensure `BETTER_AUTH_URL` matches your domain
- Clear browser cookies and try again

### Database Connection Errors
- Verify `DATABASE_URL` includes `?sslmode=require&pgbouncer=true`
- Check Neon dashboard for database status
- Ensure IP allowlist includes Vercel IPs (or set to allow all)
- Run migrations: `npx prisma migrate deploy`

### Redis Rate Limiting Issues
- Check Upstash dashboard for connection status
- Verify `UPSTASH_REDIS_REST_URL` and token
- Temporarily disable: `ENABLE_RATE_LIMITING=false`
- Free tier: 10,000 commands/day

### AI Generation Not Working
- Verify `GROQ_API_KEY` is set
- Check GROQ dashboard for rate limits
- Try backup keys: `GROQ_API_KEY_FOR_DESC_1`, etc.
- Ensure `OPENROUTER_API_KEY` is set as fallback

---

## Rollback Plan 🔄

### Quick Rollback
1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

### Database Rollback
1. Restore from Neon backup (configure in Neon dashboard)
2. Or revert migrations:
   ```bash
   npx prisma migrate reset
   npx prisma migrate deploy
   ```

---

## Cost Estimate 💰

### Free Tier Usage
- **Vercel**: Free (100GB bandwidth, 100k edge requests)
- **Neon**: Free (1 project, 3GB storage, 1 compute)
- **Upstash Redis**: Free (10k commands/day)
- **GROQ API**: Free tier available
- **OAuth**: Free (Google & GitHub)

### Estimated Monthly Cost (Small Scale)
- Vercel Pro: $20/month (if needed)
- Neon Pro: $19/month (if needed)
- Upstash: Free tier sufficient for most use cases
- **Total**: $0-$40/month depending on scale

---

## Security Checklist 🔒

Before going live:
- [ ] All production secrets are NEW (not reused from dev)
- [ ] `.env.local` is NOT committed to git
- [ ] OAuth redirect URIs only allow your production domain
- [ ] Database has strong password
- [ ] Admin passcode is strong and unique
- [ ] `ADMIN_USER_ID` is set to YOUR user ID only
- [ ] CORS is not overly permissive
- [ ] Rate limiting is enabled
- [ ] HTTPS is enforced (automatic on Vercel)

---

## Support & Help

### If You Get Stuck
1. Check Vercel build logs
2. Review this guide's troubleshooting section
3. Check environment variables in Vercel dashboard
4. Test locally with production-like environment
5. Contact: jamdadeabhishek039@gmail.com

### Useful Links
- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Neon Docs: https://neon.tech/docs
- Better Auth Docs: https://www.better-auth.com/docs

---

## Post-Launch Checklist ✅

After successful deployment:
- [ ] Test all features end-to-end
- [ ] Monitor logs for 24 hours
- [ ] Set up uptime monitoring (optional)
- [ ] Share with test users
- [ ] Collect feedback
- [ ] Plan next features based on usage

---

**Congratulations on your deployment!** 🎉

Your ArchDraw app is now live at `https://your-domain.vercel.app`
