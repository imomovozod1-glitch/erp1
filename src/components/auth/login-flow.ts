import { lockMinutesFrom } from '@/lib/login-lock'

/**
 * Where to land after a successful sign-in. `src/proxy.ts` appends
 * `?redirectTo=<path>` when it bounces an unauthenticated user off a
 * protected page, so a deep link survives the login round-trip instead of
 * dumping everyone on the dashboard.
 *
 * Only same-origin absolute paths are honoured — anything else (a full URL,
 * or the protocol-relative `//evil.com`, which a browser resolves as an
 * external host) is discarded, so the parameter can't be used to bounce a
 * freshly-authenticated user off-site.
 */
export function safeRedirectTo(fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const target = new URLSearchParams(window.location.search).get('redirectTo')
  if (!target || !target.startsWith('/')) return fallback
  if (target.startsWith('//') || target.startsWith('/\\')) return fallback
  return target
}

/** What the card shows when a sign-in is refused, and where to go instead. */
export interface LoginFailure {
  message: string
  hint?: string
  link?: { href: string; label: string }
}

/**
 * Turns a refused sign-in into something the person can act on.
 *
 * Most refusals are deliberately indistinguishable from a wrong password —
 * an account that belongs to another company included, so that a working
 * phone/password pair cannot be confirmed from a login page that is not the
 * right one. What is named is what the person can act on: a disabled account,
 * a company whose subscription has ended, and a staff account, which belongs
 * at its own portal and is the vendor's own people rather than a stranger.
 */
export async function describeFailure(
  res: Response,
  t: (key: string, values?: Record<string, string | number | Date>) => string
): Promise<LoginFailure> {
  const lockMinutes = await lockMinutesFrom(res)
  if (lockMinutes !== null) return { message: t('tooManyAttempts', { minutes: lockMinutes }) }

  const body = await res.json().catch(() => null)
  switch (body?.error) {
    case 'account_disabled':
      return { message: t('accountDisabled') }
    case 'tenant_blocked':
      return { message: t('tenantBlocked') }
    case 'staff_account':
      return {
        message: body.portal === 'admin' ? t('staffAccountAdmin') : t('staffAccountSupport'),
        ...(body.host
          ? {
              hint: t('staffAccountGoTo'),
              // `/login` on those hosts, not `/admin/login`: src/proxy.ts
              // rewrites the console's own address to its path tree.
              link: { href: `${window.location.protocol}//${body.host}/login`, label: body.host },
            }
          : {}),
      }
    default:
      return { message: t('invalidCredentials') }
  }
}

/**
 * The company host this device last signed in to.
 *
 * The Capacitor shell always opens the bare app host (`server.url` in
 * capacitor.config.ts) and the session does not live there — it lives on the
 * company's own host, where the handoff put it (src/lib/tenant-handoff.ts).
 * Without this the app would ask for a password on every single launch, so
 * the address is remembered and the bare host simply steps aside.
 *
 * Per-device and per-browser; it holds an address, nothing else. `?switch=1`
 * turns it off for one visit, which is how a second company gets signed in
 * on a shared device.
 */
const LAST_HOST_KEY = 'erp_last_tenant_host'

export function rememberTenantHost(host: string) {
  try {
    localStorage.setItem(LAST_HOST_KEY, host)
  } catch {
    // Private mode, or storage blocked. Costs one extra sign-in, nothing more.
  }
}

export function rememberedTenantHost(): string | null {
  try {
    const host = localStorage.getItem(LAST_HOST_KEY)
    // Only ever a host, never a URL — a stored value with a scheme or a path
    // in it would be someone else's redirect.
    return host && /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? host : null
  } catch {
    return null
  }
}
