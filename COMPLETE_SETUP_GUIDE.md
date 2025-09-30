# 🚀 Complete Step-by-Step Setup Guide for FaceCheck APK
## From Zero to Working Google OAuth Authentication

---

## 📑 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Part 1: Google Cloud Console Setup](#part-1-google-cloud-console-setup)
3. [Part 2: Supabase Configuration](#part-2-supabase-configuration)
4. [Part 3: Get Android SHA-1 Certificate](#part-3-get-android-sha-1-certificate)
5. [Part 4: Configure Environment Variables](#part-4-configure-environment-variables)
6. [Part 5: Build and Test APK](#part-5-build-and-test-apk)
7. [Part 6: Troubleshooting](#part-6-troubleshooting)

---

## Prerequisites

Before starting, make sure you have:
- ✅ Google account
- ✅ Supabase account ([Sign up free](https://supabase.com))
- ✅ Node.js installed
- ✅ Android Studio installed
- ✅ Your project code

---

# Part 1: Google Cloud Console Setup

## Step 1.1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top (next to "Google Cloud")
3. Click **"New Project"**
4. Enter project details:
   - **Project name**: `FaceCheck`
   - **Organization**: Leave as default or select your org
5. Click **"Create"**
6. Wait for project creation (takes ~30 seconds)
7. Select your new project from the dropdown

---

## Step 1.2: Enable Required APIs

1. In the Google Cloud Console, open the menu (☰) on the left
2. Go to **"APIs & Services"** → **"Library"**
3. Search for **"Google+ API"**
4. Click on it and press **"Enable"**
5. Search for **"Google Identity Toolkit API"**
6. Click on it and press **"Enable"**

---

## Step 1.3: Configure OAuth Consent Screen

1. In the menu (☰), go to **"APIs & Services"** → **"OAuth consent screen"**

2. Choose **"External"** (unless you have Google Workspace, then choose Internal)
   - Click **"Create"**

3. **Fill in App Information**:
   ```
   App name: FaceCheck
   User support email: your-email@gmail.com
   App logo: (Optional - skip for now)
   ```

4. **App domain** (Optional - can skip):
   ```
   Application home page: (leave empty)
   Application privacy policy link: (leave empty)
   Application terms of service link: (leave empty)
   ```

5. **Developer contact information**:
   ```
   Email addresses: your-email@gmail.com
   ```

6. Click **"Save and Continue"**

7. **Scopes** page:
   - Click **"Add or Remove Scopes"**
   - Search and select these scopes:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Click **"Update"**
   - Click **"Save and Continue"**

8. **Test users** page (for development):
   - Click **"Add Users"**
   - Add your test email addresses (one per line):
     ```
     your-email@gmail.com
     tester@gmail.com
     ```
   - Click **"Add"**
   - Click **"Save and Continue"**

9. **Summary** page:
   - Review everything
   - Click **"Back to Dashboard"**

---

## Step 1.4: Create OAuth Client ID for WEB (Supabase)

1. Go to **"APIs & Services"** → **"Credentials"**

2. Click **"Create Credentials"** → **"OAuth client ID"**

3. **Application type**: Select **"Web application"**

4. **Name**: `FaceCheck Web Client`

5. **Authorized JavaScript origins**: Leave empty for now

6. **Authorized redirect URIs**:
   - Click **"+ Add URI"**
   - We'll add this in Step 2 after getting Supabase URL
   - Leave empty for now

7. Click **"Create"**

8. **IMPORTANT**: A dialog appears with your credentials:
   ```
   Client ID: 123456789-abcdef.apps.googleusercontent.com
   Client secret: GOCSPX-xxxxxxxxxxxxxxxx
   ```

9. **COPY AND SAVE THESE SOMEWHERE SAFE!** ✅
   - Open Notepad or text editor
   - Paste both values
   - Label them clearly:
     ```
     WEB CLIENT ID: 123456789-abcdef.apps.googleusercontent.com
     WEB CLIENT SECRET: GOCSPX-xxxxxxxxxxxxxxxx
     ```

10. Click **"OK"**

---

## Step 1.5: Create OAuth Client ID for ANDROID (APK)

**Note**: We'll complete this after getting the SHA-1 certificate in Part 3.

For now, just note that you'll need to come back here.

---

# Part 2: Supabase Configuration

## Step 2.1: Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click **"New Project"**
3. Fill in details:
   ```
   Name: facecheck
   Database Password: (create a strong password - SAVE THIS!)
   Region: Choose closest to you
   ```
4. Click **"Create new project"**
5. Wait 2-3 minutes for project setup

---

## Step 2.2: Get Supabase Credentials

1. Once project is ready, go to **"Settings"** (⚙️ icon on left sidebar)

2. Click **"API"** in the Settings menu

3. **Copy these values and save them**:

   **Project URL**:
   ```
   https://abcdefghijklmnop.supabase.co
   ```

   **Project API Keys** → `anon` `public`:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMDAwMDAwMCwiZXhwIjoxOTM1NTc2MDAwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. Open Notepad and save:
   ```
   SUPABASE URL: https://abcdefghijklmnop.supabase.co
   SUPABASE ANON KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## Step 2.3: Update Web Client Redirect URI in Google Console

**NOW** we can add the redirect URI to Google Console:

1. Go back to [Google Cloud Console](https://console.cloud.google.com/)
2. Go to **"APIs & Services"** → **"Credentials"**
3. Click on **"FaceCheck Web Client"** (the one you created)
4. Under **"Authorized redirect URIs"**, click **"+ Add URI"**
5. Add this URL (replace with YOUR Supabase project URL):
   ```
   https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback
   ```
   Example:
   ```
   https://abcdefghijklmnop.supabase.co/auth/v1/callback
   ```
6. Click **"Save"** at the bottom

---

## Step 2.4: Enable Google Auth Provider in Supabase

1. In Supabase Dashboard, go to **"Authentication"** (👤 icon on left)

2. Click **"Providers"** tab

3. Find **"Google"** in the list

4. Toggle it **ON** (switch turns blue)

5. Fill in the credentials from Step 1.4:
   ```
   Client ID (for OAuth): [Paste your WEB CLIENT ID]
   Client Secret (for OAuth): [Paste your WEB CLIENT SECRET]
   ```

6. **Authorized Client IDs** section: Leave empty for now (we'll add Android client ID later)

7. Click **"Save"**

---

## Step 2.5: Configure Redirect URLs in Supabase

1. Still in **"Authentication"**, click **"URL Configuration"** tab

2. Under **"Redirect URLs"**, you'll see a list

3. Click **"Add URL"** button

4. Add these URLs one by one:
   ```
   com.facecheck.app://auth/callback
   A
   ```

5. Click **"Save"**

**What these URLs do**:
- `com.facecheck.app://` - Deep link for Android APK
- `http://localhost:5173/` - For testing in browser

---

## Step 2.6: Run Database Migration Script

1. In Supabase Dashboard, go to **"SQL Editor"** (📝 icon on left)

2. Click **"New Query"**

3. Open the file `supabase-migration.sql` from your project folder

4. Copy **ALL** the contents (Ctrl+A, Ctrl+C)

5. Paste into the Supabase SQL Editor

6. Click **"Run"** button (or press Ctrl+Enter)

7. Wait for execution (should take 5-10 seconds)

8. Check the **"Results"** panel at the bottom - you should see:
   ```
   Migration completed successfully!
   ```

9. If you see errors, check the troubleshooting section

---

# Part 3: Get Android SHA-1 Certificate

## Step 3.1: Locate Your Debug Keystore

The debug keystore is automatically created by Android Studio.

**Location**:
- **Windows**: `C:\Users\YourUsername\.android\debug.keystore`
- **Mac/Linux**: `~/.android/debug.keystore`

Or use the one in your project:
```
android/app/debug.keystore
```

---

## Step 3.2: Get SHA-1 Fingerprint

Open Command Prompt (Windows) or Terminal (Mac/Linux):

**For debug keystore** (development):
```bash
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```
48:2B:55:AE:D5:8C:03:00:4B:4E:CB:6F:56:50:E8:52:F1:10:16:01
**Mac/Linux**:
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**For project debug keystore**:
```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

You'll see output like this:
```
Certificate fingerprints:
  SHA1: A1:B2:C3:D4:E5:F6:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB
  SHA256: AB:CD:EF:12:34:56:...
```

**COPY the SHA-1 value** (the one with colons):
```
A1:B2:C3:D4:E5:F6:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB
```

Save it in your notepad!

---

## Step 3.3: Create Android OAuth Client ID

1. Go back to [Google Cloud Console](https://console.cloud.google.com/)

2. Go to **"APIs & Services"** → **"Credentials"**

3. Click **"Create Credentials"** → **"OAuth client ID"**

4. **Application type**: Select **"Android"**

5. **Name**: `FaceCheck Android`

6. **Package name**:
   ```
   com.FaceCheck.app
   ```
   ⚠️ **Must be EXACTLY this** (case-sensitive)

7. **SHA-1 certificate fingerprint**: Paste the SHA-1 from Step 3.2
   ```
   A1:B2:C3:D4:E5:F6:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB
   ```

8. Click **"Create"**

9. You'll see a dialog with your **Android Client ID**:
   ```
   123456789-abcdef.apps.googleusercontent.com
   ```

10. **COPY AND SAVE THIS!** ✅
    ```
    ANDROID CLIENT ID: 123456789-abcdef.apps.googleusercontent.com
    ```

11. Click **"OK"**

---

## Step 3.4: Add Android Client ID to Supabase

1. Go back to [Supabase Dashboard](https://app.supabase.com/)

2. Go to **"Authentication"** → **"Providers"**

3. Find **"Google"** and click to expand it

4. In the **"Authorized Client IDs"** field, paste your Android Client ID:
   ```
   123456789-abcdef.apps.googleusercontent.com
   ```

5. Click **"Save"**

---

# Part 4: Configure Environment Variables

## Step 4.1: Update .env File

1. Open your project in VS Code or your editor

2. Look for the `.env` file in the root directory

3. If it doesn't exist, create it: Right-click → New File → `.env`

4. Add these lines (replace with YOUR actual values):

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google OAuth Configuration (use WEB CLIENT ID, not Android)
VITE_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com

# App Configuration
VITE_APP_URL=http://localhost:5173
```

5. **Save the file** (Ctrl+S)

---

## Step 4.2: Verify .env is in .gitignore

1. Open `.gitignore` file

2. Make sure it has this line:
   ```
   .env
   ```

3. If not, add it and save

4. This prevents your secrets from being committed to Git

---

# Part 5: Build and Test APK

## Step 5.1: Install Dependencies

Open terminal in your project folder:

```bash
npm install
```

Wait for installation to complete.

---

## Step 5.2: Build Web Assets

```bash
npm run build
```

This creates the `dist` folder with your compiled app.

---

## Step 5.3: Sync with Capacitor

```bash
npx cap sync android
```

This copies your web assets to the Android project and updates plugins.

---

## Step 5.4: Open in Android Studio

```bash
npx cap open android
```

This opens Android Studio with your project.

---

## Step 5.5: Build APK in Android Studio

1. Wait for Gradle sync to complete (bottom right corner)

2. Click **"Build"** menu → **"Build Bundle(s) / APK(s)"** → **"Build APK(s)"**

3. Wait for build (can take 2-5 minutes first time)

4. When done, you'll see: **"Build Successful"** with a notification

5. Click **"locate"** in the notification, or find APK at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## Step 5.6: Install APK on Device

**Option A: Using Android Studio**

1. Connect your Android phone via USB
2. Enable USB debugging on phone:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings → Developer Options
   - Enable "USB Debugging"
3. In Android Studio, click the **"Run"** button (▶️)
4. Select your device from the list

**Option B: Using Command Line**

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Option C: Manual Install**

1. Copy `app-debug.apk` to your phone
2. Open file on phone
3. Allow "Install from Unknown Sources" if prompted
4. Tap "Install"

---

## Step 5.7: Test OAuth Flow

1. **Open the app** on your phone

2. You should see the **FaceCheck login page** with "Sign in with Google" button

3. **Tap "Sign in with Google"**

4. Browser/Chrome Custom Tab should open

5. **Select your Google account**

6. Review permissions and click **"Continue"**

7. **You should be redirected back to the app!**

8. If it's your first time:
   - You'll see **"Organization Setup"** screen
   - Enter organization name: `Test Organization`
   - Click **"Create Organization"**

9. **Success!** You should be on the **Camera Scanner page**

---

# Part 6: Troubleshooting

## Issue: "Error 400: redirect_uri_mismatch"

**Cause**: Redirect URL not configured properly

**Solution**:
1. Check Google Cloud Console → Credentials → Web Client
2. Verify redirect URI is: `https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback`
3. Check Supabase → Authentication → URL Configuration
4. Verify `com.facecheck.app://auth/callback` is added

---

## Issue: "Error 401: invalid_client"

**Cause**: Wrong Client ID or Secret

**Solution**:
1. Verify you're using **WEB CLIENT ID** in `.env` (not Android)
2. Check Web Client Secret is correct in Supabase
3. Make sure there are no extra spaces

---

## Issue: "The app doesn't open after Google login"

**Cause**: Deep link not configured

**Solution**:
1. Verify `AndroidManifest.xml` has intent filter (already done)
2. Rebuild APK: `npm run build && npx cap sync android`
3. Reinstall APK
4. Check package name is exactly: `com.FaceCheck.app`

---

## Issue: "OAuth consent screen error"

**Cause**: App not verified or test user not added

**Solution**:
1. For development: Add your Gmail to test users in OAuth Consent Screen
2. For production: Submit app for verification (takes days)

---

## Issue: "Invalid SHA-1 certificate"

**Cause**: Wrong SHA-1 or wrong keystore

**Solution**:
1. Make sure you used **debug.keystore** SHA-1 for development
2. Verify SHA-1 format has colons: `A1:B2:C3:...`
3. If you have multiple keystores, make sure you used the right one

---

## Issue: "Database error" or "Permission denied"

**Cause**: Migration not run or RLS issues

**Solution**:
1. Go to Supabase SQL Editor
2. Re-run `supabase-migration.sql`
3. Check for errors in results panel
4. Verify `organization_users` has `google_id` column

---

## Issue: "Network error" in app

**Cause**: Wrong Supabase URL or key

**Solution**:
1. Double-check `.env` values
2. Rebuild: `npm run build && npx cap sync android`
3. Verify you're using `anon` key, not `service_role`

---

# 📋 Final Checklist

Before deploying, verify:

## Google Cloud Console
- [ ] OAuth Consent Screen configured
- [ ] Web Client created with redirect URI
- [ ] Android Client created with correct SHA-1
- [ ] Test users added (for development)

## Supabase
- [ ] Google provider enabled with Web credentials
- [ ] Android Client ID added to Authorized Client IDs
- [ ] Redirect URLs configured (deep link + localhost)
- [ ] Migration script executed successfully

## Project Configuration
- [ ] `.env` file created with all variables
- [ ] `.env` added to `.gitignore`
- [ ] Dependencies installed (`npm install`)
- [ ] Web assets built (`npm run build`)
- [ ] Capacitor synced (`npx cap sync`)

## APK Testing
- [ ] APK builds without errors
- [ ] App installs on device
- [ ] Google OAuth flow works
- [ ] Redirects back to app after login
- [ ] Organization setup works for new users
- [ ] Existing users can login
- [ ] Camera scanner accessible after login

---

# 🎉 Success!

If all steps are complete, you now have:

✅ **Working Google OAuth** in your Android APK
✅ **Secure authentication** with Supabase
✅ **Deep link callbacks** for mobile
✅ **Role-based access control** (Owner, Admin, Operator, Viewer)
✅ **Security features**: Rate limiting, anomaly detection, session management
✅ **Audit logging** for all security events

---

# 📞 Need Help?

If you're still stuck:

1. **Check browser console** (Chrome DevTools) for errors
2. **Check Supabase logs**: Dashboard → Logs → Auth Logs
3. **Check Android logcat**: Android Studio → Logcat → Search "FaceCheck"
4. **Verify all credentials** match exactly (no extra spaces)
5. **Try deleting and recreating** OAuth clients if nothing works

---

# 🔐 Security Reminder

**Never commit these to Git**:
- `.env` file
- Google Client Secret
- Supabase service_role key (not used, but if you have it)
- SHA-1 certificates for production keystores

**Always keep private**:
- Database password
- API keys
- OAuth credentials

---

## 📱 Production Deployment

When ready for production:

1. **Create release keystore**:
   ```bash
   keytool -genkey -v -keystore release-key.keystore -alias facecheck -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Get SHA-1 from release keystore**
3. **Create new Android OAuth client** with release SHA-1
4. **Update Supabase** with production redirect URL
5. **Build signed APK/AAB** in Android Studio
6. **Test thoroughly** before releasing
7. **Submit to Google Play Store**

---

**You're all set!** 🚀