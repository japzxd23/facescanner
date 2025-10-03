# Android OAuth Debugging Guide

## ✅ Fixes Applied

### 1. **Added Comprehensive Logging**
- Added detailed console logs throughout the OAuth flow
- Track every step from deep link to authentication completion

### 2. **Fixed Hash Parameter Handling**
- Changed from `history.push` to `history.replace` + `window.location.hash`
- Ensures OAuth tokens are preserved when navigating from deep link

### 3. **Added Timeout Protection**
- Master timeout (20 seconds) prevents infinite loading
- Individual timeouts for each async operation
- Loading state always cleared on success or error

### 4. **Enhanced Error Handling**
- Try-catch blocks with detailed error logging
- Finally blocks to ensure cleanup
- Graceful fallbacks for all failure scenarios

## 🔍 How to Debug

### Step 1: Enable Remote Debugging

1. Connect Android device via USB
2. Enable USB Debugging on device
3. Run in Android Studio or use Chrome DevTools:

```bash
# Open in Android Studio
npx cap open android

# OR use Chrome remote debugging
# 1. Open Chrome: chrome://inspect
# 2. Run app on device
# 3. Click "inspect" on your app
```

### Step 2: Monitor Console Logs

Watch for these key log messages in order:

#### 1. When "Sign in with Google" is clicked:
```
🔍 OAuth Debug: { isNativePlatform: true, platform: "android", redirectUrl: "com.facecheck.app://auth/callback" }
🌐 Opening OAuth URL in native browser: https://...
✅ OAuth initiated successfully
```

#### 2. After Google login (deep link received):
```
🔗 Deep link received: com.facecheck.app://auth/callback#access_token=...
✅ Browser closed after OAuth callback
📋 URL Details: { ... }
✅ OAuth callback detected
📦 Hash extracted: #access_token=...&...
🔄 Setting window.location.hash and navigating to /auth
```

#### 3. On Auth Page (processing callback):
```
🚀 handleOAuthCallback triggered
📍 Current URL: http://localhost/auth
📍 Current hash: #access_token=...
🔍 Access token found: YES
🔑 OAuth tokens found in URL, processing...
⏰ Setting loading to TRUE
```

#### 4. Session establishment (one of these):
```
✅ Session established for: user@example.com
OR
✅ Session manually established for: user@example.com
OR
🚀 Bypassing Supabase session, using token data directly
```

#### 5. Final step:
```
🔐 handleSuccessfulAuth called for: user@example.com
✅ Existing user found, redirecting to dashboard
OR
🆕 New user, showing organization setup
```

### Step 3: Check for Issues

#### ❌ Issue: "Access token found: NO"
**Cause:** Hash parameters not being passed

**Solution:**
1. Check deep link URL format
2. Verify Supabase redirect URL matches exactly: `com.facecheck.app://auth/callback`
3. Check if Google OAuth is appending hash params

#### ❌ Issue: Timeout errors
**Cause:** Supabase session calls hanging

**Logs to watch for:**
```
⏱️ TIMEOUT or SET_SESSION_TIMEOUT
⏱️ MASTER TIMEOUT: OAuth processing took too long
```

**Solution:**
- This is handled automatically by fallback to token decoding
- Check internet connection
- Verify Supabase project is active

#### ❌ Issue: Browser doesn't close
**Cause:** Browser.close() failing

**Logs:**
```
⚠️ Browser already closed or error closing: ...
```

**Solution:**
- This is non-fatal, manually close browser
- App should still process OAuth callback

### Step 4: Verify Deep Link Configuration

```bash
# Test deep link manually via ADB
adb shell am start -a android.intent.action.VIEW -d "com.facecheck.app://test"

# Should open your app
```

If app doesn't open:
1. Check AndroidManifest.xml has correct scheme
2. Rebuild APK
3. Reinstall app

## 📊 Expected Flow Timeline

1. **T+0s**: User taps "Sign in with Google"
2. **T+1s**: System browser opens with Google login
3. **T+5-30s**: User completes Google authentication
4. **T+30s**: Redirect to `com.facecheck.app://auth/callback#...`
5. **T+31s**: App receives deep link, browser closes
6. **T+32s**: Navigate to /auth, hash params set
7. **T+33s**: AuthPage processes OAuth tokens
8. **T+35s**: Session established
9. **T+36s**: Either redirect to dashboard OR show org setup

**Total time: 30-40 seconds (mostly user interaction)**

## 🐛 Common Issues & Solutions

### 1. Stuck on Loading (20+ seconds)

**Check logs for:**
- Any timeout messages
- Master timeout trigger

**If master timeout triggered:**
- Try again - might be network issue
- Check Supabase project status
- Verify API keys in .env

### 2. "No session found" Error

**This means:**
- Supabase couldn't establish session
- Falling back to token decode

**Expected behavior:**
- App should still work
- User proceeds to org setup
- Session created in database

### 3. Loading Clears but Nothing Happens

**Check logs for:**
- handleSuccessfulAuth errors
- Database query errors

**Possible causes:**
- Supabase RLS policies blocking queries
- Database connection issues
- Missing organization_users table

## 🔧 Quick Fixes

### Force Clear Loading State

If stuck, the master timeout (20s) will automatically clear it.

### Manual Token Check

In Chrome DevTools console:
```javascript
// Check if hash has tokens
console.log(window.location.hash);

// Should see: #access_token=...&refresh_token=...
```

### Reset OAuth Flow

1. Clear app data in Android settings
2. Uninstall and reinstall app
3. Try OAuth again

## 📱 Testing Checklist

- [ ] Deep link opens app (test with ADB)
- [ ] "Sign in with Google" opens browser
- [ ] Google login completes successfully
- [ ] Browser redirects to deep link
- [ ] App comes to foreground
- [ ] Browser closes automatically
- [ ] Loading dialog shows
- [ ] Console logs show token processing
- [ ] Either redirects to dashboard OR shows org setup
- [ ] No infinite loading (max 20s)

## 🆘 Still Having Issues?

### Collect Debug Info:

1. **Full console log** from clicking "Sign in" to completion
2. **Deep link URL** that was received (sanitize tokens)
3. **Supabase redirect URL** configuration
4. **AndroidManifest.xml** intent-filter

### Check Configuration:

```bash
# Verify packages installed
npm list @capacitor/browser cordova-plugin-customurlscheme

# Should show:
# @capacitor/browser@7.0.2
# cordova-plugin-customurlscheme@5.0.2
```

### Supabase Dashboard Check:

1. **Authentication > URL Configuration**
   - Redirect URLs: `com.facecheck.app://auth/callback`

2. **Authentication > Providers > Google**
   - Enabled: ✅
   - Client ID: Set
   - Client Secret: Set

3. **Google Cloud Console**
   - Authorized redirect URIs includes Supabase callback

---

## 📝 Log Export

To export logs for analysis:
```bash
# Run app and perform OAuth
# Then export logs
adb logcat -d > oauth-debug.log
```

Send oauth-debug.log for detailed analysis.
