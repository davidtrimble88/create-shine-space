import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.b03b40e402014016b119ee4d336cfb7b',
  appName: 'LTR Employee',
  webDir: 'dist',
  server: {
    url: 'https://b03b40e4-0201-4016-b119-ee4d336cfb7b.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    // NSFaceIDUsageDescription gets added to Info.plist via the plugin docs;
    // ensure Xcode > Info.plist contains:
    // <key>NSFaceIDUsageDescription</key>
    // <string>Sign in to your LTR employee account with Face ID</string>
  },
};

export default config;
