# 🔧 OAuth redirect_uri_mismatch Fix Checklist

## Your Configuration

**Supabase URL**: `https://cezkpqnmhoqncqissgkq.supabase.co`

**Required Redirect URIs**:
1. `https://cezkpqnmhoqncqissgkq.supabase.co/auth/v1/callback` (for web/Supabase)
2. `com.facecheck.app://auth/callback` (for Android APK deep link)

---

## ✅ Step-by-Step Fix

### 1. Google Cloud Console - Web Client

1. Go to: https://console.cloud.google.com/
2. Select your project: **FaceCheck**
3. Navigate: **APIs & Services** → **Credentials**
4. Click: **FaceCheck Web Client** (or your web OAuth client name)
5. Find: **"Authorized redirect URIs"** section
6. Click: **"+ ADD URI"**
7. Add this URI:
   ```
   https://cezkpqnmhoqncqissgkq.supabase.co/auth/v1/callback
   ```
8. Click: **"SAVE"**

**Important Notes**:
- ⚠️ Make sure there are NO extra spaces
- ⚠️ URL must be HTTPS (not http)
- ⚠️ Must end with `/auth/v1/callback`
- ⚠️ Changes take ~5 minutes to propagate

---

### 2. Verify Supabase Configuration

1. Go to: https://app.supabase.com/
2. Select your project
3. Navigate: **Authentication** → **Providers**
4. Click on: **Google** provider
5. Verify these fields are filled:

   **Client ID (for OAuth)**:
   - Should be your Web Client ID from Google Console
   - Format: `123456789-abcdefghijk.apps.googleusercontent.com`

   **Client Secret (for OAuth)**:
   - Should be your Web Client Secret
   - Format: `GOCSPX-xxxxxxxxxxxxxxxx`

   **Authorized Client IDs**:
   - Should contain your Android Client ID
   - Format: `123456789-abcdefghijk.apps.googleusercontent.com`
   - This is DIFFERENT from the Web Client ID above

6. Click: **"Save"**

---

### 3. Verify Supabase Redirect URLs

1. Still in **Authentication**, click: **URL Configuration** tab
2. Under **"Redirect URLs"**, verify these are added:
   ```
   com.facecheck.app://auth/callback
   http://localhost:5173/auth/callback
   ```
3. If missing, click **"Add URL"** and add them
4. Click: **"Save"**

---

## 🧪 Test the Fix

### For Web Browser Testing:
1. Open: http://localhost:5173
2. Click: "Sign in with Google"
3. Should redirect to Google login
4. After login, should redirect back to your app

### For Android APK Testing:
1. Install APK on device
2. Open app
3. Tap: "Sign in with Google"
4. Browser opens for Google login
5. After login, should return to app via deep link

---

## 🔍 Common Issues

### Issue: Still getting redirect_uri_mismatch

**Solution**: Wait 5-10 minutes after saving changes in Google Console. Google needs time to propagate changes.

**Also check**:
- Clear browser cache and cookies
- Try incognito/private browser window
- Verify you're using the correct Google account
- Check for typos in the redirect URI

---

### Issue: "Error 400: invalid_request"

**Cause**: Wrong Client ID or Secret in Supabase

**Solution**:
1. Go to Google Console → Credentials
2. Click on your **Web Client**
3. Copy the Client ID and Secret again
4. Paste into Supabase → Authentication → Providers → Google
5. Make sure you're using **Web Client** credentials (not Android)

---

### Issue: App doesn't open after Google login (APK)

**Cause**: Deep link not configured or Android Client ID missing

**Solution**:
1. Verify AndroidManifest.xml has deep link intent filter (already configured)
2. Go to Supabase → Authentication → Providers → Google
3. In **"Authorized Client IDs"** field, add your Android Client ID:
   - Get it from Google Console → Credentials → Android Client
   - Should be different from Web Client ID
4. Rebuild APK: `npm run build && npx cap sync android`

---

## 📋 Final Verification Checklist

Before testing, verify:

**Google Cloud Console**:
- [ ] Web Client has redirect URI: `https://cezkpqnmhoqncqissgkq.supabase.co/auth/v1/callback`
- [ ] Android Client created with SHA-1: `48:2B:55:AE:D5:8C:03:00:4B:4E:CB:6F:56:50:E8:52:F1:10:16:01`
- [ ] Both clients are in the same project

**Supabase Dashboard**:
- [ ] Google provider enabled
- [ ] Web Client ID and Secret added
- [ ] Android Client ID added to "Authorized Client IDs"
- [ ] Redirect URLs include both `com.facecheck.app://` and `localhost`

**Project Files**:
- [ ] `.env` has correct VITE_SUPABASE_URL
- [ ] `.env` has correct VITE_GOOGLE_CLIENT_ID (Web Client ID)
- [ ] Project built: `npm run build`
- [ ] Capacitor synced: `npx cap sync android`

---

## 🎯 Quick Test Commands

```bash
# Rebuild everything
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Or install directly (if APK exists)
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📞 Still Not Working?

If you've followed all steps and still getting errors:

1. **Check the exact error message** in browser console (F12)
2. **Check Supabase logs**: Dashboard → Logs → Auth Logs
3. **Wait 10 minutes** after making changes in Google Console
4. **Try a different Google account** (add as test user first)
5. **Clear all browser data** and try again

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ Google login page opens without errors
- ✅ After entering credentials, it redirects back
- ✅ No error messages appear
- ✅ You see the organization setup screen (first time)
- ✅ OR you're redirected to /camera page (returning user)

---

**Last Updated**: After detecting your Supabase URL
**Your Supabase Project**: cezkpqnmhoqncqissgkq