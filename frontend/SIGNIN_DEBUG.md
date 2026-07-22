# Sign-In Button Debug Guide

## Issue
Google and GitHub sign-in buttons are not clickable / nothing happens when clicked.

## Checklist

### 1. Check Browser Console
Open your browser's Developer Tools (F12) and check the Console tab for errors:

```bash
# Open browser dev tools
Right-click → Inspect → Console tab
```

**Common errors to look for:**
- `Failed to fetch` - Network/CORS issue
- `Invalid client_id` - OAuth credentials incorrect
- `redirect_uri_mismatch` - Callback URL not configured
- `BETTER_AUTH_SECRET` error - Secret not set properly

### 2. Verify BETTER_AUTH_SECRET

Your `.env.local` has a placeholder:
```
BETTER_AUTH_SECRET="replace-with-a-random-64-char-hex-string"
```

**Generate a proper secret:**
```bash
# In terminal, run:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use:
openssl rand -hex 32
```

**Then update `.env.local`:**
```bash
BETTER_AUTH_SECRET="<your-generated-64-char-hex-string>"
```

### 3. Verify OAuth Callback URLs

#### GitHub OAuth App Settings
1. Go to: https://github.com/settings/developers
2. Click your OAuth app
3. **Authorization callback URL** must be:
   ```
   http://localhost:3000/api/auth/callback/github
   ```
4. For production:
   ```
   https://yourdomain.com/api/auth/callback/github
   ```

#### Google OAuth App Settings
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. **Authorized redirect URIs** must include:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
4. For production:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```

### 4. Test Auth Endpoints

Open these URLs in your browser to verify endpoints are working:

```bash
# Check if Better Auth is responding
http://localhost:3000/api/auth/session

# Should return: {"user":null,"session":null} or actual session data
```

### 5. Check Network Tab

1. Open DevTools → Network tab
2. Click a sign-in button
3. Look for requests to `/api/auth/signin/google` or `/api/auth/signin/github`
4. Check the response:
   - **200 OK** → Good, check if redirect happens
   - **404 Not Found** → Auth routes not working
   - **500 Error** → Server error, check server logs
   - **CORS error** → Check BETTER_AUTH_URL in .env

### 6. Verify Environment Variables Loaded

Create a test file to verify env vars are loaded:

**File: `app/api/test-env/route.ts`**
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasGithubClientId: !!process.env.GITHUB_CLIENT_ID,
    hasGithubSecret: !!process.env.GITHUB_CLIENT_SECRET,
    hasBetterAuthSecret: !!process.env.BETTER_AUTH_SECRET,
    betterAuthUrl: process.env.BETTER_AUTH_URL,
  });
}
```

Then visit: `http://localhost:3000/api/test-env`

**Expected response:**
```json
{
  "hasGoogleClientId": true,
  "hasGoogleSecret": true,
  "hasGithubClientId": true,
  "hasGithubSecret": true,
  "hasBetterAuthSecret": true,
  "betterAuthUrl": "http://localhost:3000"
}
```

### 7. Check SignInButtons Component

Add console.log to verify click handlers are firing:

**File: `components/SignInButtons.tsx`**
```typescript
const handleGoogle = () => {
  console.log('🔵 Google button clicked');
  console.log('signIn function:', signIn);
  signIn.social({ provider: 'google' });
};

const handleGitHub = () => {
  console.log('🟣 GitHub button clicked');
  console.log('signIn function:', signIn);
  signIn.social({ provider: 'github' });
};
```

Click the buttons and check console for:
- Click logs appearing
- `signIn` function defined
- Any errors thrown

### 8. Restart Dev Server

After making env changes:
```bash
# Kill existing dev server (Ctrl+C)
# Then restart:
npm run dev
```

**Wait for:**
```
✓ Ready in Xms
○ Local: http://localhost:3000
```

### 9. Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Buttons do nothing | Check browser console for errors |
| `signIn is undefined` | Auth client not initialized properly |
| `redirect_uri_mismatch` | Update OAuth app callback URLs |
| `Invalid client_id` | Verify OAuth credentials in .env.local |
| `CORS error` | Check BETTER_AUTH_URL matches your domain |
| Buttons disabled | Check if they have `disabled` prop |

### 10. Quick Test Script

Create this test file to verify auth flow:

**File: `test-auth.html`**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Auth Test</title>
</head>
<body>
  <h1>Auth Test</h1>
  <button onclick="testGoogle()">Test Google</button>
  <button onclick="testGitHub()">Test GitHub</button>
  
  <script>
    function testGoogle() {
      console.log('Testing Google OAuth...');
      window.location.href = 'http://localhost:3000/api/auth/signin/google';
    }
    
    function testGitHub() {
      console.log('Testing GitHub OAuth...');
      window.location.href = 'http://localhost:3000/api/auth/signin/github';
    }
  </script>
</body>
</html>
```

Open in browser and click buttons. You should be redirected to OAuth provider.

## Next Steps

1. **First**: Generate and set BETTER_AUTH_SECRET
2. **Second**: Verify OAuth callback URLs in GitHub and Google
3. **Third**: Check browser console for errors
4. **Fourth**: Test auth endpoints directly
5. **Fifth**: Restart dev server

## If Still Not Working

Run these diagnostic commands:

```bash
# Check if Better Auth package is installed
npm list better-auth

# Check Node version (should be 18+)
node --version

# Check if port 3000 is actually serving your app
curl http://localhost:3000/api/auth/session

# Check server logs for errors
npm run dev | grep -i error
```

## Contact Points

If issue persists after all checks:
1. Share browser console errors
2. Share server terminal logs
3. Share network tab requests/responses
4. Confirm which step failed from this checklist
