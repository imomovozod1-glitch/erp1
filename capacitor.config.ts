import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uzlider.erp',
  appName: 'UzLider',
  webDir: 'public',
  server: {
    // Points the native shell at the live Next.js deployment instead of a
    // bundled static build — required because this app relies on
    // server-rendered pages, middleware-based tenant/auth handling
    // (src/proxy.ts), and cached server queries that a static export can't
    // reproduce. Trade-off: the app needs network connectivity to load,
    // same as the web app today.
    url: 'https://erp1-livid.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
