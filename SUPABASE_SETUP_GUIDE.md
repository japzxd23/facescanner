# Supabase Setup Guide for FaceCheck APK

## Overview
This guide will help you configure Supabase for Google OAuth authentication in your FaceCheck Android APK.

---

## 📋 Prerequisites
- Google Cloud Console account
- Supabase project created
- Android APK package name: `com.FaceCheck.app`

---

## 🔧 Step 1: Configure Google Cloud Console

### 1.1 Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**

### 1.2 Configure OAuth Consent Screen

1. Click **Configure Consent Screen**
2. Choose **External** (for public app) or **Internal** (for organization only)
3. Fill in required information:
   - **App name**: FaceCheck
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click **Save and Continue**
5. Add scopes (optional): `email`, `profile`, `openid`
6. Click **Save and Continue**

### 1.3 Create OAuth Client IDs

You need **TWO** OAuth clients:

#### A. Web Application (for Supabase)
1. Click **Create Credentials** → **OAuth client ID**
2. **Application type**: Web application
3. **Name**: FaceCheck Web
4. **Authorized JavaScript origins**: Leave empty
5. **Authorized redirect URIs**: Add:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
   Replace `YOUR_PROJECT_ID` with your actual Supabase project ID
6. Click **Create**
7. **Save the Client ID and Client Secret** ✅

#### B. Android Application (for APK)
1. Click **Create Credentials** → **OAuth client ID**
2. **Application type**: Android
3. **Name**: FaceCheck Android
4. **Package name**: `com.FaceCheck.app`
5. **SHA-1 certificate fingerprint**: Get it by running:
   ```bash
   # For debug build
   keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android

   # For release build (use your keystore path)
   keytool -list -v -keystore /path/to/your-release-key.keystore -alias your-alias
   ```
6. Click **Create**

---

## 🗄️ Step 2: Configure Supabase

### 2.1 Enable Google OAuth Provider

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and toggle it **ON**
5. Enter the credentials from Step 1.3.A:
   - **Client ID**: Paste the Web Application Client ID
   - **Client Secret**: Paste the Web Application Client Secret
6. **Authorized Client IDs**: Add the Android Client ID from Step 1.3.B
7. Click **Save**

### 2.2 Add Redirect URLs

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   ```
   com.facecheck.app://auth/callback
   http://localhost:5173/auth/callback
   ```
   - First URL: For Android APK
   - Second URL: For local web development

3. Click **Save**

### 2.3 Run Database Migration

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **New Query**
3. Copy and paste the contents of `supabase-migration.sql`
4. Click **Run** or press `Ctrl+Enter`
5. Verify you see "Migration completed successfully!"

---

## 🔐 Step 3: Update Your .env File

Create or update your `.env` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your-web-client-id-here.apps.googleusercontent.com

# App Configuration
VITE_APP_URL=http://localhost:5173
```

**How to get these values:**
- `VITE_SUPABASE_URL`: Supabase Dashboard → Settings → API → Project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase Dashboard → Settings → API → Project API keys → `anon public`
- `VITE_GOOGLE_CLIENT_ID`: From Step 1.3.A (Web Application Client ID)

---

## 📱 Step 4: Build and Test APK

### 4.1 Sync Capacitor
```bash
npm run build
npx cap sync android
```

### 4.2 Open in Android Studio
```bash
npx cap open android
```

### 4.3 Build APK

In Android Studio:
1. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for build to complete
3. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### 4.4 Test OAuth Flow

1. Install APK on device/emulator:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

2. Open app and tap "Sign in with Google"

3. Complete Google authentication

4. App should redirect back to `com.facecheck.app://auth/callback`

5. Verify you're redirected to `/camera` route

---

## 🔍 Troubleshooting

### Issue: "Error 400: redirect_uri_mismatch"
**Solution**:
- Verify redirect URL in Google Console matches: `com.facecheck.app://auth/callback`
- Check Android Client ID is added to Supabase "Authorized Client IDs"

### Issue: "OAuth popup doesn't redirect back to app"
**Solution**:
- Verify `AndroidManifest.xml` has the deep link intent filter (already configured)
- Verify package name is exactly `com.FaceCheck.app`

### Issue: "Invalid SHA-1 certificate"
**Solution**:
- Use debug keystore for testing: `android/app/debug.keystore`
- For production, use your release keystore SHA-1

### Issue: "Database permissions error"
**Solution**:
- Run the `supabase-migration.sql` script
- Verify RLS policies are enabled
- Check organization_users table has `google_id` column

---

## 📊 What Gets Configured

### Database Schema Changes
✅ `organization_users.google_id` - Links Supabase auth to org users
✅ `security_events` table - Audit logging for security
✅ Row Level Security (RLS) policies - Secure data access
✅ Indexes for performance

### Android Configuration
✅ Deep link scheme: `com.facecheck.app://`
✅ Intent filter in AndroidManifest.xml
✅ OAuth callback handling

### Security Features
✅ Rate limiting (10/min, 100/hr)
✅ Anomaly detection (failed scans, banned members)
✅ Session management (30min idle, 8hr max)
✅ RBAC with 4 roles (Owner, Admin, Operator, Viewer)

---

## 🎯 Testing Checklist

- [ ] Google sign-in opens browser correctly
- [ ] After authentication, redirects back to app
- [ ] New user can create organization
- [ ] Existing user can login
- [ ] Scanner page accessible after login
- [ ] Admin dashboard shows security stats
- [ ] Logout works correctly
- [ ] Session expires after 30 minutes idle
- [ ] Rate limiting triggers after 10 scans/minute

---

## 🔗 Redirect URL Summary

| Environment | Redirect URL |
|------------|--------------|
| **Android APK** | `com.facecheck.app://auth/callback` |
| **Web (Dev)** | `http://localhost:5173/auth/callback` |
| **Web (Prod)** | `https://yourdomain.com/auth/callback` |

**Important**: Add ALL redirect URLs to:
1. Google Cloud Console → OAuth client → Authorized redirect URIs (Web client only)
2. Supabase Dashboard → Authentication → URL Configuration

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs: Dashboard → Logs → Auth Logs
3. Verify all environment variables are set
4. Ensure migration script ran successfully

---

## 🚀 Next Steps

After successful setup:
1. Test authentication flow thoroughly
2. Create test users with different roles
3. Test scanner security features
4. Configure production Google OAuth credentials
5. Set up proper release signing for APK
6. Deploy to Google Play Store (optional)

---

**Setup Complete!** 🎉

Your FaceCheck app now has:
- ✅ Google OAuth authentication
- ✅ Mobile deep link support
- ✅ Enterprise security features
- ✅ Role-based access control
- ✅ Comprehensive audit logging