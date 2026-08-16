import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zhajiaji.app',
  appName: 'OutGO',
  webDir: 'www',
  server: {
    // 开发时可用，打包 APK 时注释掉
    // url: 'http://192.168.x.x:3000',
    // cleartext: true
  }
};

export default config;
