@echo off
echo Building FaceCheck APK...

echo Step 1: Building web app...
call npm run build

echo Step 2: Syncing to Android...
call npx cap sync android

echo Step 3: Building APK...
cd android
call gradlew.bat assembleDebug

echo Done! APK location:
echo %CD%\app\build\outputs\apk\debug\app-debug.apk

pause