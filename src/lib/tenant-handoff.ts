/**
 * Signing a session over from one host to another.
 *
 * Every company is served on its own host, and a cookie set on one host does
 * not exist on the next. That is the point — it is what keeps one company's
 * session out of another company's address — but it leaves three doors with
 * no key: the Capacitor shell, which always opens the bare app host
 * (`server.url` in capacitor.config.ts) and has no address bar to type a
 * company into; the Telegram Mini App, which is opened by Telegram on that
 * same bare host; and anyone who simply goes to the apex.
 *
 * Before this, all three signed in on the bare host and stayed there — which
 * is why the subscription gate in src/proxy.ts, keyed on the subdomain, never
 * ran for them. The fix is not a wider cookie: a cookie scoped to
 * `.falco.business` would be presented to every tenant host, which is exactly
 * the isolation the per-company hosts are for (and Vercel's own multi-tenant
 * guidance warns against it while the apex is not on the Public Suffix List).
 *
 * Instead the password is proved once on the bare host, and what travels to
 * the tenant host is a single-use, short-lived token — Supabase's own
 * magic-link hash, minted with the service role and never emailed. The tenant
 * host exchanges it for its own session (/api/auth/callback) and the bare-host
 * session is dropped. Standard cross-origin sign-in handoff; the token is
 * spent by the first request that redeems it.
 */

import { getCacheClient } from '@/lib/supabase/cache-client'
import { computeEffectiveStatus } from '@/lib/tenant-status'
import { tenantHostFor } from '@/lib/tenant-host'

/**
 * Set when a handoff could not be minted, so that (dashboard)/layout.tsx stops
 * sending the session back to a route that cannot move it — the two would
 * otherwise redirect to each other indefinitely.
 */
export const HANDOFF_SKIP_COOKIE = 'hof_skip'

export interface HandoffTarget {
  subdomain: string
  /** `aisha.falco.business` — the company's own host. */
  host: string
  /** Absolute URL that signs the user in there and lands them in the app. */
  url: string
}

export type HandoffResult =
  | { ok: true; target: HandoffTarget }
  /** No company on the profile — nothing to hand off to. */
  | { ok: false; reason: 'no_tenant' }
  /** The company is blocked or inactive; `status` is the effective one. */
  | { ok: false; reason: 'tenant_blocked'; status: string }
  /** This deployment has no tenant hosts, or the token could not be minted. */
  | { ok: false; reason: 'unavailable' }

export interface HandoffRequest {
  userId: string
  /** The synthetic login email the token is minted for. */
  email: string
  /** Host header of the request being answered. */
  requestHost: string
  /** `https:` or `http:` — the scheme the caller is already being served on. */
  protocol: string
  /** Where to land on the tenant host. Must be an absolute path. */
  next: string
}

/**
 * Resolves the user's company and mints the one-time sign-in URL for it.
 *
 * Reads with the service role on purpose: this runs on the bare host, where
 * the session may be about to be dropped, and the answer must not depend on
 * whatever RLS context happens to be in play.
 */
export async function createTenantHandoff(request: HandoffRequest): Promise<HandoffResult> {
  const service = getCacheClient() as any

  const { data: profile } = await service
    .from('profiles')
    .select('tenant_id')
    .eq('id', request.userId)
    .maybeSingle()

  if (!profile?.tenant_id) return { ok: false, reason: 'no_tenant' }

  const { data: tenant } = await service
    .from('tenants')
    .select('subdomain, status, subscription_ends_at')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  const subdomain = String(tenant?.subdomain || '').toLowerCase()
  if (!subdomain) return { ok: false, reason: 'no_tenant' }

  // The subscription gate, enforced before the handoff rather than after it:
  // the whole reason the bare host could be used to sidestep billing was that
  // nothing on it ever asked this question (src/proxy.ts only asks on a
  // tenant host).
  const status = computeEffectiveStatus(String(tenant?.status || ''), tenant?.subscription_ends_at ?? null)
  if (status !== 'active') return { ok: false, reason: 'tenant_blocked', status }

  const host = tenantHostFor(subdomain, request.requestHost)
  if (!host) return { ok: false, reason: 'unavailable' }

  // Generated, never sent: generateLink only mints the token and hands it
  // back. Supabase's own single-use, expiring token, so nothing here has to
  // invent a token table or its expiry rules.
  const { data: link, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: request.email,
  })
  const tokenHash = link?.properties?.hashed_token
  if (error || !tokenHash) return { ok: false, reason: 'unavailable' }

  const url = new URL(`${request.protocol}//${host}/api/auth/callback`)
  url.searchParams.set('token', tokenHash)
  url.searchParams.set('next', request.next)

  return { ok: true, target: { subdomain, host, url: url.toString() } }
}

/**
 * The scheme and host of the request being answered, for building the
 * handoff URL. Behind Vercel the original scheme only survives in
 * `x-forwarded-proto`, so a naive `https:` would break local development and
 * a naive `http:` would break production.
 */
export function requestOrigin(headers: Headers): { host: string; protocol: string } {
  const host = headers.get('host') || ''
  const forwarded = headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const protocol = forwarded ? `${forwarded}:` : host.startsWith('localhost') || host.includes('.localhost') ? 'http:' : 'https:'
  return { host, protocol }
}

/**
 * A path on the tenant host that the caller is allowed to be sent to.
 *
 * Only same-origin absolute paths survive, for the same reason the login
 * form's `redirectTo` is filtered (src/components/auth/login-form.tsx): a full
 * URL or the protocol-relative `//evil.com` would turn the handoff into an
 * open redirect that arrives already signed in.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  return raw
}
