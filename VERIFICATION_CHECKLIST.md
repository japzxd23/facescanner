# ✅ OAuth Setup Verification Checklist

## Your Configuration Details

**Supabase Project URL**: `https://cezkpqnmhoqncqissgkq.supabase.co`
**Package Name**: `com.FaceCheck.app` (capital F and C)
**SHA-1**: `48:2B:55:AE:D5:8C:03:00:4B:4E:CB:6F:56:50:E8:52:F1:10:16:01`

---

## 📱 1. Google Cloud Console - Web Client

Go to: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **Your Web Client**

### Authorized redirect URIs must include:
```
https://cezkpqnmhoqncqissgkq.supabase.co/auth/v1/callback
```

**Verification**:
- [ ] URL is added
- [ ] No typos (check carefully!)
- [ ] URL is HTTPS (not http)
- [ ] URL ends with `/auth/v1/callback`
- [ ] No extra spaces before or after
- [ ] Clicked "SAVE" at bottom

**⚠️ Common Mistake**: Adding the deep link `com.FaceCheck.app://` here. DON'T! Only add the Supabase HTTPS URL.

---

## 📱 2. Google Cloud Console - Android Client

Go to: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **Your Android Client**

### Required fields:
- **Package name**: `com.FaceCheck.app` (exactly as shown, with capitals)
- **SHA-1 certificate**: `48:2B:55:AE:D5:8C:03:00:4B:4E:CB:6F:56:50:E8:52:F1:10:16:01`

**Verification**:
- [ ] Package name matches exactly (case-sensitive!)
- [ ] SHA-1 is correct
- [ ] Client ID is saved somewhere safe

---

## 🗄️ 3. Supabase - Google Provider Settings

Go to: [Supabase Dashboard](https://app.supabase.com/) → Authentication → Providers → **Google**

### Required fields:

**Client ID (for OAuth)**:
- [ ] Paste your **Web Client ID** from Google Console
- [ ] Format: `123456789-abcdef.apps.googleusercontent.com`

**Client Secret (for OAuth)**:
- [ ] Paste your **Web Client Secret** from Google Console
- [ ] Format: `GOCSPX-xxxxxxxxxxxxxxxx`

**Authorized Client IDs** (separate field below):
- [ ] Paste your **Android Client ID** from Google Console
- [ ] This is DIFFERENT from the Web Client ID
- [ ] Format: `123456789-abcdef.apps.googleusercontent.com`

**Verification**:
- [ ] All three fields filled
- [ ] Web credentials in top section
- [ ] Android Client ID in "Authorized Client IDs" section
- [ ] Clicked "SAVE"

---

## 🗄️ 4. Supabase - URL Configuration

Go to: [Supabase Dashboard](https://app.supabase.com/) → Authentication → **URL Configuration** tab

### Redirect URLs must include:
```
com.FaceCheck.app://auth/callback
http://localhost:5173/auth/callback
```

**Verification**:
- [ ] Both URLs added
- [ ] Deep link uses `com.FaceCheck.app://` (with capitals)
- [ ] Localhost URL for testing in browser
- [ ] Clicked "SAVE"

---

## 💻 5. Project Files

### capacitor.config.ts
```typescript
appId: 'com.FaceCheck.app',  // ✅ Correct
```

### .env file
```env
VITE_SUPABASE_URL=https://cezkpqnmhoqncqissgkq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... (your key)
VITE_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com  ← Web Client ID
```

**Verification**:
- [ ] SUPABASE_URL matches your project
- [ ] ANON_KEY is the `anon public` key (not service_role)
- [ ] GOOGLE_CLIENT_ID is the **Web Client ID** (not Android)

---

## 🔨 6. Build Process

Run these commands in order:

```bash
# 1. Build web assets
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Open Android Studio
npx cap open android

# 4. In Android Studio: Build → Build APK

# 5. Install on device
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Verification**:
- [ ] All commands ran without errors
- [ ] APK built successfully
- [ ] APK installed on phone

---

## 🧪 Testing Checklist

### When you tap "Sign in with Google" in the app:

**Expected behavior**:
1. ✅ Browser/Chrome Custom Tab opens
2. ✅ Shows Google sign-in page
3. ✅ You select your Google account
4. ✅ Shows permission consent screen
5. ✅ After accepting, browser closes
6. ✅ **App opens automatically** (via deep link)
7. ✅ Shows organization setup (first time) OR redirects to /camera

**If it fails**:
- ❌ Browser stays open with error
- ❌ Shows "redirect_uri_mismatch"
- ❌ App doesn't open after login

---

## 🔍 Debugging Steps

### Step 1: Check the exact error in browser

When you see the error page, look for:
```
redirect_uri_mismatch
Request details: flowName=GeneralOAuthFlow
redirect_uri=https://cezkpqnmhoqncqissgkq.supabase.co/auth/v1/callback
```

This tells you which URL Google received. **This EXACT URL must be in Google Console Web Client**.

### Step 2: Verify Google Console redirect URI

1. Open Google Console → Credentials → Web Client
2. Scroll to "Authorized redirect URIs"
3. Check if this EXACT URL is there:
   ```
   https://cezkpqnmhoqncqissgkq.supabase.co/auth/v1/callback
   ```
4. If missing or different, add it and SAVE
5. **Wait 5-10 minutes** for changes to propagate

### Step 3: Check Chrome console (if testing in browser)

Press F12 → Console tab → Look for errors with "OAuth" or "redirect"

### Step 4: Check Supabase Auth Logs

Go to Supabase Dashboard → Logs → Auth Logs → Look for recent failures

### Step 5: Test with different account

Sometimes cached credentials cause issues. Try:
- Different Google account
- Incognito/private browser mode
- Clear app data on phone

---

## 📊 Quick Reference Table

| Item | Google Console | Supabase | Code Files |
|------|---------------|----------|------------|
| **Supabase Callback** | ✅ `https://cezkpqnmhoqncqissgkq.supabase.co/auth/v1/callback` | N/A | N/A |
| **Deep Link** | ❌ NO | ✅ `com.FaceCheck.app://auth/callback` | ✅ `com.FaceCheck.app://auth/callback` |
| **Package Name** | ✅ `com.FaceCheck.app` | N/A | ✅ `com.FaceCheck.app` |
| **Web Client ID** | ✅ Created | ✅ In "Client ID" field | ✅ In `.env` |
| **Web Client Secret** | ✅ Created | ✅ In "Client Secret" field | ❌ NO |
| **Android Client ID** | ✅ Created with SHA-1 | ✅ In "Authorized Client IDs" | ❌ NO |

---

## ⚠️ Common Mistakes

1. **Adding deep link to Google Console**: Google doesn't understand `com.FaceCheck.app://`. Only add HTTPS URLs.

2. **Using Android Client ID in .env**: Should use Web Client ID, not Android.

3. **Case sensitivity**: `com.facecheck.app` ≠ `com.FaceCheck.app`

4. **Forgetting to add Android Client ID to Supabase**: Web credentials go in top section, Android Client ID goes in separate "Authorized Client IDs" field.

5. **Not waiting**: Google needs 5-10 minutes to propagate changes.

6. **Wrong redirect URI format**: Must be exactly `https://YOUR-PROJECT.supabase.co/auth/v1/callback`

---

## ✅ Final Test

If everything is correct:

1. Open app on phone
2. Tap "Sign in with Google"
3. Select account
4. Accept permissions
5. **App should open automatically** ← This means it worked!

If app doesn't open but you see "Redirecting..." in browser, check:
- AndroidManifest.xml has the deep link intent filter (already done)
- Deep link scheme matches: `com.FaceCheck.app`
- APK was rebuilt after changes

---

## 🆘 Still Not Working?

After verifying ALL items above:

1. **Delete OAuth clients** and create new ones from scratch
2. **Clear Google Chrome app data** on phone
3. **Uninstall and reinstall APK**
4. **Wait 30 minutes** after making any Google Console changes
5. **Try on a different phone** to rule out device-specific issues

---

**Last Updated**: After fixing case sensitivity issue
**Your Setup**: APK on Android phone with `com.FaceCheck.app` package name