/**
 * Which tenant a request's Host header points at.
 *
 * Lives in its own module because two very different places need the exact
 * same answer and must never disagree: `src/proxy.ts`, which gates and routes
 * every page request, and `src/app/api/auth/login/route.ts`, which has to
 * refuse a sign-in on a subdomain the account does not belong to. The
 * middleware does hand `/api/**` an `x-tenant-subdomain` header, but that
 * header is only overwritten when a subdomain is actually present — on a
 * hostname with none it passes whatever the client sent straight through, so
 * an auth decision reads the Host itself instead.
 *
 * `null` means "no tenant in this hostname", which is a normal, supported
 * state: the bare app host (the Capacitor shell opens there — see `server.url`
 * in capacitor.config.ts), a preview deployment, or plain `localhost`.
 */

const IPV4_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

export function getTenantSubdomain(host: string): string | null {
  const hostname = host.split(':')[0]

  // A raw IP address (e.g. the Android emulator's 10.0.2.2 loopback alias,
  // or anyone hitting the app directly by IP) has dot-separated segments
  // just like "tenant.example.com" does — without this check its first
  // octet gets misread as a tenant subdomain that doesn't exist.
  if (IPV4_PATTERN.test(hostname)) {
    return null
  }

  // If local development, check for subdomain before "localhost"
  // e.g. "tenant1.localhost" -> "tenant1"
  if (hostname.endsWith('.localhost')) {
    const parts = hostname.split('.')
    if (parts.length > 1) {
      const sub = parts[0]
      if (sub !== 'www') return sub
    }
    return null
  }

  // The app's own deployment domain (e.g. "erp1-livid.vercel.app") is not a
  // tenant subdomain, even though it has 3+ dot-separated parts just like a
  // real one ("acme.falco.business") would — without this, the platform's own
  // default/preview domain gets misread as an unknown tenant on every visit.
  // Real tenant subdomains only ever live on the app's own custom domain.
  if (hostname === 'vercel.app' || hostname.endsWith('.vercel.app')) {
    return null
  }

  // For production domains like "tenant1.falco.business"
  const parts = hostname.split('.')
  if (parts.length > 2) {
    const sub = parts[0]
    if (sub !== 'www') return sub
  }

  return null
}
