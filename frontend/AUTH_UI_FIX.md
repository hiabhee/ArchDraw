# Authentication UI Display Fix

## Issues Found & Fixed

### 1. **Duplicate Auth Route Directory** ✅ FIXED
**Problem:** There were two auth directories:
- `app/api/auth/"[...all]"` (with literal quotes - INVALID)
- `app/api/auth/[...all]` (correct catch-all route)

**Solution:** Removed the invalid directory with quotes
```bash
rm -rf 'app/api/auth/"[...all]"'
```

### 2. **Missing NEXT_PUBLIC_APP_URL** ✅ FIXED
**Problem:** The auth client was trying to use `NEXT_PUBLIC_APP_URL` which wasn't set, causing it to fall back to window.location.origin, which might not work correctly on the server side.

**Solution:** Added to `.env.local`:
```env
NEXT_PUBLIC_APP_URL="http://localhost:3001"
```

### 3. **Added Debug Logging** ✅ ADDED
Added console logs to help diagnose auth flow:
- `store/authStore.ts` - logs when session is checked and user data is retrieved
- `components/AuthProvider.tsx` - logs when user profile is set

## How Authentication UI Works

### User Display Flow:
1. **AuthProvider** initializes on app load
2. **authStore.initialize()** checks for active session via Better Auth
3. If session exists → sets `user` in authStore
4. **AuthProvider** watches for user changes and calls `setUserProfile()` in diagramStore
5. **UserAvatar** component reads from:
   - `userProfile` (from diagramStore) - PREFERRED
   - `user` (from authStore) - FALLBACK

### Components Involved:
- **UserAvatar.tsx** - Displays user avatar/initials in header
- **SettingsPanel** - Shows full profile in settings modal
- **SignInButtons** - OAuth buttons for Google/GitHub
- **AuthProvider** - Syncs auth state between stores
- **authStore** - Manages authentication session
- **diagramStore** - Stores user profile data

## Next Steps

### 1. **Restart Your Dev Server** 🔄
The auth routes and environment variables won't take effect until restart:
```bash
# Stop the current server (Ctrl+C)
npm run dev
```

### 2. **Test Authentication Flow** 🧪
After restart:
1. Open browser console (F12)
2. Look for these log messages:
   - `[Auth] Session check result:` - Should show if session found
   - `[Auth] User data:` - Should show your user info if logged in
   - `[AuthProvider] Setting authenticated user profile:` - Should set your profile

### 3. **Check What You Should See** 👀

**If NOT authenticated (Guest):**
- Avatar with "G" initial in header
- "Guest User" in dropdown
- "Sign in" buttons in dashboard

**If authenticated (after Google/GitHub OAuth):**
- Avatar with your first initial in header
- Your name and email in dropdown menu
- Settings panel accessible
- Your actual profile data displayed

### 4. **Try Signing In** 🔐
1. Go to dashboard
2. Click "Continue with Google" or "Continue with GitHub"
3. Complete OAuth flow
4. Should redirect back and show your profile
5. Check browser console for auth logs

### 5. **Verify UI Changes** ✨
After signing in successfully, you should see:
- Your name/email in the avatar dropdown (click avatar in top-right)
- Your initials in the avatar circle
- "Sign out" button in dropdown
- Your profile info in Settings panel

## Troubleshooting

### If you still don't see your profile:
1. **Check Browser Console** - Look for any errors or auth logs
2. **Check Network Tab** - Look for:
   - `GET /api/auth/session` - Should return 200 with your user data
   - `GET /api/user/quota` - Should return your quota info
3. **Check Cookies** - Should have `better-auth.session_token` cookie
4. **Clear Browser Storage** - Try clearing localStorage and cookies
5. **Check Database** - Verify user was created in your Postgres database

### Common Issues:

**404 on /api/auth/*** → Server not restarted (do step 1)
**Session returns null** → OAuth callback might have failed
**Avatar shows "G"** → User profile not synced (check console logs)
**No user data in console** → Session cookie might be missing

## Verification Checklist

- [ ] Invalid auth directory removed
- [ ] NEXT_PUBLIC_APP_URL added to .env.local
- [ ] Dev server restarted
- [ ] Can access /api/auth/session without 404
- [ ] Sign in flow completes successfully
- [ ] Avatar shows correct initial after sign in
- [ ] Name and email visible in dropdown
- [ ] Settings panel shows profile data
- [ ] Console logs show user data

## Files Modified

1. `.env.local` - Added NEXT_PUBLIC_APP_URL
2. `store/authStore.ts` - Added debug logging
3. `components/AuthProvider.tsx` - Added debug logging
4. `app/api/auth/"[...all]"` - Removed (invalid directory)

## Architecture Notes

### Why Two Stores?
- **authStore** - Handles authentication session (Better Auth)
- **diagramStore** - Handles application state (user profile, canvases)
- AuthProvider bridges them by watching authStore and updating diagramStore

### Why userProfile preferred over user?
- `userProfile` in diagramStore includes avatar_url and other app-specific fields
- `user` in authStore is the raw Better Auth session data
- Fallback to `user` ensures something displays even if profile sync fails
