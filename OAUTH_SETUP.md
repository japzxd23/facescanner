# Native Android OAuth Setup - Custom URL Scheme

## ✅ Implementation Complete

Your social login has been transformed to use the **Cordova Custom URL Scheme** approach for native Android deployment.

## 🔧 What Was Changed

### 1. **Dependencies Added**
- `@capacitor/browser` - Opens OAuth in system browser
- `cordova-plugin-customurlscheme` - Handles custom URL scheme deep linking

### 2. **Configuration Updates**

#### `capacitor.config.ts`
- Added Browser plugin configuration
- Added Cordova custom URL scheme preferences

#### `authService.ts`
- Uses `@capacitor/browser` to open OAuth URL in system browser
- Detects native platform automatically
- Uses custom URL scheme: `com.facecheck.app://auth/callback`

#### `App.tsx`
- Enhanced deep link listener to handle OAuth callbacks
- Automatically closes browser after successful callback
- Extracts OAuth tokens from deep link URL

#### `AuthPage.tsx`
- Simplified to use authService's `signInWithGoogle()`
- Handles both native and web OAuth flows

#### `AndroidManifest.xml`
- Updated custom URL scheme to lowercase for consistency: `com.facecheck.app`

## 📋 Supabase Configuration Required

### **IMPORTANT:** Configure Redirect URLs in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to: **Authentication** → **URL Configuration**
3. Add the following redirect URLs:

#### For Native Android:
```
com.facecheck.app://auth/callback
```

#### For Web/Browser (optional, for testing):
```
http://localhost:5173/auth/callback
https://yourdomain.com/auth/callback
```

4. **Site URL**: Set to your production domain or `http://localhost:5173` for development

### Google OAuth Provider Setup

1. In Supabase Dashboard: **Authentication** → **Providers** → **Google**
2. Enable Google provider
3. Add your Google OAuth credentials (Client ID and Client Secret)
4. In **Google Cloud Console**, add authorized redirect URIs:
   - `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`

## 🚀 How It Works

### Native Android Flow:

1. User clicks "Sign in with Google" button
2. App opens system browser with Google OAuth URL (via Browser plugin)
3. User authenticates with Google
4. Google redirects to: `com.facecheck.app://auth/callback#access_token=...`
5. Android OS launches your app via custom URL scheme
6. App listener catches the deep link
7. Browser closes automatically
8. App extracts OAuth tokens and completes authentication

### Web Browser Flow:

1. User clicks "Sign in with Google"
2. Supabase redirects to Google OAuth
3. User authenticates
4. Google redirects back to web URL: `http://localhost:5173/auth/callback`
5. Supabase handles token exchange automatically

## 🧪 Testing

### Build and Test on Android Device:

```bash
# Build the app
npm run build

# Sync with Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Build and run on device/emulator from Android Studio
```

### Test Flow:
1. Open app on Android device
2. Navigate to auth page
3. Click "Continue with Google"
4. System browser opens with Google login
5. Sign in with Google account
6. Browser redirects to app
7. App should show loading then redirect to organization setup or dashboard

## 🐛 Troubleshooting

### Issue: Browser doesn't close after callback
- Check Browser.close() is called in App.tsx deep link listener
- Verify deep link URL format matches: `com.facecheck.app://auth/callback`

### Issue: App doesn't open after Google login
- Verify AndroidManifest.xml has correct scheme: `com.facecheck.app`
- Check Supabase redirect URL matches exactly: `com.facecheck.app://auth/callback`
- Ensure intent-filter has BROWSABLE category

### Issue: "No session found" error
- Check console logs for OAuth tokens in URL hash
- Verify Supabase client is properly configured with correct URL and anon key
- Ensure Google OAuth provider is enabled in Supabase

### Issue: Redirect to wrong URL
- Check `redirectTo` in authService.ts matches Supabase configuration
- Verify platform detection is working (check console logs)

## 📱 Deep Link Verification

To verify deep links work on Android:

```bash
# Test deep link via ADB
adb shell am start -a android.intent.action.VIEW -d "com.facecheck.app://auth/callback#access_token=test"
```

App should open and navigate to auth page.

## 🔐 Security Notes

- Custom URL scheme: `com.facecheck.app`
- OAuth tokens passed in URL hash (not query params)
- Tokens handled by Supabase Auth library
- Session stored in localStorage with 1-hour timeout
- Browser closes automatically to prevent token exposure

## 📝 Next Steps

1. **Configure Supabase redirect URLs** (see above)
2. **Build APK** and test on real device
3. **Test OAuth flow** end-to-end
4. **Verify organization setup** works after successful login
5. **Test on both Android and web** to ensure both flows work

---

**Custom URL Scheme:** `com.facecheck.app://auth/callback`
**Platform:** Native Android + Web
**OAuth Provider:** Google (via Supabase)
