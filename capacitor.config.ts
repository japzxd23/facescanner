import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.facecheck.app',
  appName: 'FaceCheck',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    },
    Filesystem: {
      androidDisplayName: 'FaceCheck Storage',
      androidIsTerminating: false
    },
    Browser: {
      // Configure in-app browser for OAuth
      presentationStyle: 'popover',
      toolbarColor: '#2563eb'
    }
  }
};

export default config;