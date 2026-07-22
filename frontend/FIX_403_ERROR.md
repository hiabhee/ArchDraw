# 🔧 Fix 403 FORBIDDEN Error

## ✅ What I Fixed

### 1. Updated BETTER_AUTH_URL Port
Changed from `3000` → `3001` in `.env.local`:
```bash
BETTER_AUTH_URL="http://localhost:3001"
```

### 2. Added Trusted Origins
Added `trustedOrigins: ['http://localhost:3001']` to `lib/auth.ts` to fix CORS/CSRF issues.

### 3. Updated Auth Client Base URL
Fixed `lib/auth-client.ts` to use correct port.

---

## 🚀 What YOU Need to Do NOW

### Step 1: Update OAuth Callback URLs (CRITICAL)

Your OAuth apps are configured for port **3000**, but your app runs on port **3001**.

#### GitHub OAuth
1. Go to: https://github.com/settings/developers
2. Click your OAuth app
3. Change **"Authorization callback URL"** from:
   ```
   ❌ http://localhost:3000/api/auth/callback/github
   ```
   To:
   ```
   ✅ http://localhost:3001/api/auth/callback/github
   ```
4. Click **"Update application"**

#### Google OAuth
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Update **"Authorized redirect URIs"**:
   - Remove: `http://localhost:3000/api/auth/callback/google`
   - Add: `http://localhost:3001/api/auth/callback/google`
4. Click **"SAVE"**

---

### Step 2: Restart Dev Server
```bash
# Press Ctrl+C in terminal
# Then restart:
npm run dev
```

---

### Step 3: Test Sign-In

Open these URLs to test:

**Test Google:**
```
http://localhost:3001/api/auth/signin/google
```

**Test GitHub:**
```
http://localhost:3001/api/auth/signin/github
```

Both should redirect you to the OAuth provider login page.

---

### Step 4: Test in App

1. Open: `http://localhost:3001`
2. Open browser console (F12)
3. Click "Continue with Google" button
4. Should see: `🔵 Attempting Google sign-in...`
5. Should redirect to Google login

---

## 🐛 If Still Getting 403

Check your terminal logs where `npm run dev` is running. Look for:

```
[Auth] Google OAuth not configured - Google sign-in will be disabled
[Auth] GitHub OAuth not configured - GitHub sign-in will be disabled
```

If you see these warnings, the env vars aren't loading properly.

**Fix:**
1. Make sure `.env.local` exists in your project root
2. Make sure there are no syntax errors in `.env.local`
3. Restart the dev server
4. Check `/api/test-env` to verify vars are loaded

---

## 📋 Quick Checklist

- [ ] Updated GitHub callback URL to port 3001
- [ ] Updated Google callback URL to port 3001
- [ ] Restarted dev server
- [ ] Tested `/api/auth/signin/google` - redirects to Google
- [ ] Tested `/api/auth/signin/github` - redirects to GitHub
- [ ] Sign-in buttons work in the app

---

## ✅ Expected Behavior

When working correctly:
1. Click "Continue with Google"
2. Browser redirects to Google OAuth
3. Select your Google account
4. Google redirects to: `http://localhost:3001/api/auth/callback/google`
5. You're logged in and redirected home

---

## 🔐 Port Configuration Summary

| Setting | Old Value | New Value |
|---------|-----------|-----------|
| Dev Server | Port 3000 | Port 3001 |
| BETTER_AUTH_URL | :3000 | :3001 ✅ |
| GitHub Callback | :3000 | :3001 (UPDATE) |
| Google Callback | :3000 | :3001 (UPDATE) |

---

**The 403 error should be gone after updating OAuth callback URLs and restarting the server!**
