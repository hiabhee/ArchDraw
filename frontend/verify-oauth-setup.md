# OAuth Setup Verification

## Your Current OAuth Credentials

### GitHub OAuth
- **Client ID**: `Ov23liq9oIEbcghZbfmB`
- **Client Secret**: Set ✅
- **Required Callback URL**: `http://localhost:3000/api/auth/callback/github`

### Google OAuth  
- **Client ID**: `452507420254-vr2irchhse34t0jhipos3d67573oeeg0.apps.googleusercontent.com`
- **Client Secret**: Set ✅
- **Required Callback URL**: `http://localhost:3000/api/auth/callback/google`

---

## Verify Callback URLs Now

### 1. GitHub (5 minutes)

Go to: **https://github.com/settings/developers**

1. Click on your OAuth App (Client ID: `Ov23liq9oIEbcghZbfmB`)
2. Check **"Authorization callback URL"** field
3. It MUST be exactly:
   ```
   http://localhost:3000/api/auth/callback/github
   ```
4. If different, click "Update application"

**Common mistakes:**
- ❌ `http://localhost:3000/auth/callback/github` (missing `/api`)
- ❌ `http://localhost:3000/api/auth/github` (missing `/callback`)
- ❌ Using `https://` for localhost
- ❌ Trailing slash: `...github/`

### 2. Google (5 minutes)

Go to: **https://console.cloud.google.com/apis/credentials**

1. Find OAuth 2.0 Client ID: `452507420254-vr2irchhse34t0jhipos3d67573oeeg0.apps.googleusercontent.com`
2. Click the client ID to edit
3. Scroll to **"Authorized redirect URIs"**
4. Add this URI if not present:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
5. Click "SAVE"

**Common mistakes:**
- ❌ `http://localhost:3000/auth/callback/google` (missing `/api`)
- ❌ `http://localhost:3000/api/auth/google` (missing `/callback`)
- ❌ Using `https://` for localhost
- ❌ Trailing slash: `...google/`

---

## Quick Test (After Setting Callbacks)

Restart your dev server, then open these URLs:

**Test Google OAuth:**
```
http://localhost:3000/api/auth/signin/google
```
↓ Should redirect to Google login

**Test GitHub OAuth:**
```
http://localhost:3000/api/auth/signin/github
```
↓ Should redirect to GitHub authorization

If you get a redirect_uri_mismatch error, the callback URL is still wrong.

---

## Production Setup (Later)

When deploying to production, add these additional callback URLs:

**GitHub:**
```
https://yourdomain.com/api/auth/callback/github
```

**Google:**
```
https://yourdomain.com/api/auth/callback/google
```

And update `.env` or your hosting platform's environment variables:
```
BETTER_AUTH_URL=https://yourdomain.com
```
