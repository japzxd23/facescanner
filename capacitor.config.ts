import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.FaceCheck.app',
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
    }
  }
};

export default config;