import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aswadiq.noir',
  appName: 'نوار',
  webDir: 'dist',
  backgroundColor: '#17171a',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#17171a',
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: '#17171aff',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#17171a',
      overlaysWebView: false,
    },
  },
};

export default config;
