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
    // Shown when the WebView cannot reach the URL above. Without it the app
    // falls back to Android's raw net::ERR_INTERNET_DISCONNECTED page, which
    // looks like a crash. public/offline.html is bundled into the APK from
    // `webDir`, so it loads with no network at all; it polls for connectivity
    // and navigates back to the app on its own once the connection returns.
    // NOTE: it hard-codes the URL above — change one, change the other.
    errorPath: 'offline.html',
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
