import type { NextRequest, NextResponse } from 'next/server'
import { computeEffectiveStatus } from '@/lib/tenant-status'

export interface TenantGateInfo {
  id: string
  status: string
}

/**
 * A tenant's status only changes by a deliberate admin action, so the gate's lookup is
 * cached in a short cookie (and per process, below) instead of a REST round trip on every
 * navigation. Unsigned on purpose: forging it only skips the billing gate, never data
 * isolation, which the database enforces regardless; the short TTL bounds even that.
 */
const GATE_COOKIE = 'tg_cache'
const GATE_TTL_MS = 30_000

interface GateCookie {
  /** Subdomain this entry is valid for. */
  s: string
  id: string
  /** Status. */
  st: string
  /** Cached at, ms epoch. */
  t: number
}

export function readGateCookie(request: NextRequest, subdomain: string): TenantGateInfo | null {
  const raw = request.cookies.get(GATE_COOKIE)?.value
  if (!raw) return null
  try {
    const entry: GateCookie = JSON.parse(raw)
    if (entry.s !== subdomain || Date.now() - entry.t > GATE_TTL_MS) return null
    return { id: entry.id, status: entry.st }
  } catch {
    return null
  }
}

export function writeGateCookie(response: NextResponse, subdomain: string, tenant: TenantGateInfo) {
  const entry: GateCookie = { s: subdomain, id: tenant.id, st: tenant.status, t: Date.now() }
  response.cookies.set(GATE_COOKIE, JSON.stringify(entry), { httpOnly: true, sameSite: 'lax', maxAge: 60, path: '/' })
}

function serviceRest() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? { url: `${url}/rest/v1/tenants`, headers: { apikey: key, Authorization: `Bearer ${key}` } } : null
}

/** Fire-and-forget PATCH against the service-role REST API; never blocks the response. */
function patchTenant(tenantId: string, body: Record<string, unknown>) {
  const rest = serviceRest()
  if (!rest) return
  fetch(`${rest.url}?id=eq.${tenantId}`, {
    method: 'PATCH',
    headers: { ...rest.headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
    cache: 'no-store',
  }).catch(() => {})
}

/**
 * Not `getCachedTenant()`: `unstable_cache` is not guaranteed in the edge middleware.
 * The service role is needed because this runs before anyone is known to be signed in.
 * It is also where a lapsed, unpaid subscription flips to `blocked` — the one check every
 * request goes through.
 */
async function fetchTenant(subdomain: string): Promise<TenantGateInfo | null> {
  const rest = serviceRest()
  if (!rest) return null
  try {
    const res = await fetch(`${rest.url}?subdomain=eq.${encodeURIComponent(subdomain)}&select=id,status,subscription_ends_at`, { headers: rest.headers, cache: 'no-store' })
    if (!res.ok) return null
    const [tenant]: (TenantGateInfo & { subscription_ends_at: string | null })[] = await res.json()
    if (!tenant) return null
    const status = computeEffectiveStatus(tenant.status, tenant.subscription_ends_at)
    if (status !== tenant.status) patchTenant(tenant.id, { status })
    return { id: tenant.id, status }
  } catch {
    return null
  }
}

// The cookie only helps a browser that has been here before; this serves every visitor of a tenant within the window.
const memory = new Map<string, { tenant: TenantGateInfo; t: number }>()

export async function lookupTenant(subdomain: string): Promise<TenantGateInfo | null> {
  const hit = memory.get(subdomain)
  if (hit && Date.now() - hit.t < GATE_TTL_MS) return hit.tenant
  const tenant = await fetchTenant(subdomain)
  if (tenant) memory.set(subdomain, { tenant, t: Date.now() })
  else memory.delete(subdomain)
  return tenant
}

/** "Last active" is a coarse admin signal in minutes, so the write is throttled by a cookie. */
const ACTIVE_COOKIE = 'la_ping'
const ACTIVE_TTL_MS = 5 * 60 * 1000

export function touchLastActive(request: NextRequest, response: NextResponse, tenantId: string) {
  try {
    const last: { id: string; t: number } | null = JSON.parse(request.cookies.get(ACTIVE_COOKIE)?.value ?? 'null')
    if (last && last.id === tenantId && Date.now() - last.t <= ACTIVE_TTL_MS) return
  } catch {}
  patchTenant(tenantId, { last_active_at: new Date().toISOString() })
  response.cookies.set(ACTIVE_COOKIE, JSON.stringify({ id: tenantId, t: Date.now() }), { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' })
}
