import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// 'unsafe-inline'/'unsafe-eval' are required for Next.js's own RSC hydration
// bootstrap scripts (App Router streams inline <script> tags) and Turbopack —
// a stricter nonce-based CSP is possible but needs per-request nonce wiring
// through the middleware into every layout, a bigger follow-up. Even with
// those allowances, object-src/base-uri/frame-ancestors/form-action still
// close off plugin-based injection, <base>-tag hijacking, clickjacking, and
// XSS-driven form exfiltration — and connect-src/img-src are pinned to the
// app's actual external dependencies (Supabase, OpenStreetMap tiles/geocoding)
// instead of left wide open.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: any = {
  outputFileTracingRoot: process.cwd(),
  // Baked into the client bundle at build time. Vercel sets
  // VERCEL_GIT_COMMIT_SHA per-deployment, so this changes on every deploy —
  // the Capacitor shell (src/components/providers/capacitor-provider.tsx)
  // compares it against src/app/api/build-id/route.ts on resume to detect a
  // stale WebView page and reload it.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', '@heroicons/react', 'date-fns'],
    // Next 15 changed the client Router Cache default for dynamic pages to 0
    // seconds, so every navigation — including going BACK to the list you were
    // just on — refetched the whole page from the server. Against a Supabase
    // project ~500 ms away that is half a second of blank waiting for a screen
    // the browser was already holding.
    //
    // Safe to re-enable here because every mutation in this app goes through a
    // Server Action in src/lib/data/revalidate.ts that calls `updateTag()`, and
    // `updateTag` clears the client Router Cache as well as the server-side one
    // — so a save is never followed by a stale list. The bounded risk is a
    // change made by ANOTHER user in the last 20 seconds; the write paths that
    // actually depend on fresh numbers (POS, sale form) re-read stock from the
    // database immediately before writing, so a stale figure on screen cannot
    // turn into an oversell.
    staleTimes: {
      dynamic: 20,
      static: 180,
    },
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
