# Building Debug APK for Testing

## Quick Start - Run on Emulator with Logs

### Method 1: Android Studio (Recommended)

```bash
# 1. Open Android Studio
npx cap open android

# 2. In Android Studio:
#    - Wait for Gradle sync
#    - Select emulator from device dropdown
#    - Click Run button (▶️)
#    - Logcat opens automatically at bottom
```

### Method 2: Command Line Build

```bash
# Build debug APK (no keystore needed)
cd android
./gradlew assembleDebug

# APK location:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Method 3: Direct Install to Emulator

```bash
# Start emulator first (or use Android Studio's emulator)

# Build and install
cd android
./gradlew installDebug

# Or on Windows:
gradlew.bat installDebug
```

---

## 📱 View Logs in Real-Time

### Option 1: Chrome Remote Debugging (Best for Web Debugging)

1. **Run app on emulator**
2. **Open Chrome** and go to: `chrome://inspect`
3. **Click "inspect"** on your app
4. **Console tab** shows all your `console.log()` statements

### Option 2: Android Studio Logcat

1. **Run app from Android Studio**
2. **Logcat panel** opens at bottom automatically
3. **Filter by "FaceCheck"** or "chromium" to see app logs
4. **Search for your debug logs**: 🔗, 📦, 🔍, etc.

### Option 3: ADB Command Line

```bash
# View all logs
adb logcat

# Filter for your app
adb logcat | grep -i "facecheck"

# Filter for chromium (JavaScript console logs)
adb logcat | grep -i "chromium"

# Clear logs and start fresh
adb logcat -c
adb logcat
```

---

## 🔍 Testing OAuth Flow on Emulator

### Important: Emulator with Google Play Services

For Google OAuth to work, you need an emulator with **Google Play Services**:

1. **Android Studio** → **Device Manager** → **Create Device**
2. **Choose a device** with the "Play Store" icon (e.g., Pixel 5)
3. **Download system image** with Play Store
4. **Sign in to Google** on the emulator

### Testing Steps:

1. **Launch app on emulator**
2. **Open Chrome DevTools** (`chrome://inspect`)
3. **Click "Continue with Google"**
4. **Watch logs in real-time**:
   ```
   🔍 OAuth Debug: { isNativePlatform: true, ... }
   🌐 Opening OAuth URL in native browser
   🔗 Deep link received: com.facecheck.app://auth/callback#...
   📦 Hash extracted: #access_token=...
   🔍 Access token found: YES
   ✅ Session established
   ```
5. **Complete Google login in emulator browser**
6. **App should return and process callback**

---

## 🐛 If Keystore Error Appears

You're likely trying to build **Release** instead of **Debug**.

### Fix 1: Use Debug Build Type

In Android Studio:
- **Build** → **Select Build Variant**
- Change from "release" to **"debug"**

### Fix 2: Command Line

```bash
# Wrong (needs keystore):
./gradlew assembleRelease

# Correct (no keystore):
./gradlew assembleDebug
```

---

## 📊 Debug APK vs Release APK

| Feature | Debug APK | Release APK |
|---------|-----------|-------------|
| **Keystore** | ❌ Not required | ✅ Required |
| **Purpose** | Testing/Development | Production |
| **Signing** | Auto-signed debug key | Custom keystore |
| **Debugging** | ✅ Enabled | ❌ Disabled |
| **Performance** | Slower (not optimized) | Faster (optimized) |

For **debugging OAuth**, you want **Debug APK**!

---

## 🚀 Quick Commands Reference

```bash
# Build debug APK
cd android && ./gradlew assembleDebug

# Install on running emulator
cd android && ./gradlew installDebug

# View logs
adb logcat | grep -i chromium

# List connected devices
adb devices

# Start app on emulator
adb shell am start -n com.facecheck.app/.MainActivity
```

---

## ✅ Recommended Workflow

1. ✅ **Build web app**: `npm run build`
2. ✅ **Sync Capacitor**: `npx cap sync android`
3. ✅ **Open Android Studio**: `npx cap open android`
4. ✅ **Select emulator** with Google Play
5. ✅ **Click Run** (builds debug APK automatically)
6. ✅ **Open Chrome DevTools**: `chrome://inspect`
7. ✅ **Test OAuth flow** and watch logs

---

## 🔐 If You Need Release APK (Later)

For production release (Google Play), you'll need to create a keystore:

```bash
# Generate keystore (one-time)
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000

# Add to android/gradle.properties:
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=your_password
MYAPP_RELEASE_KEY_PASSWORD=your_password
```

**But for now, stick with debug builds!**
