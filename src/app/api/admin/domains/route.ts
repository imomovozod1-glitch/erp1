import { NextResponse } from 'next/server'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import {
  CONSOLE_SUBDOMAINS,
  ROOT_DOMAIN,
  isDomainAutomationConfigured,
  isHostServing,
  listProjectDomains,
  missingDomainConfig,
  registerTenantDomain,
  tenantHost,
} from '@/lib/vercel-domains'

/**
 * Tenant hosts, reconciled against the hosting platform.
 *
 * Provisioning registers a tenant's host as it creates the account
 * (src/lib/vercel-domains.ts), but that call can fail — the API was down, the
 * token had expired, or the tenant predates this mechanism entirely. This is
 * the repair: GET says which hosts the platform does not serve yet — the two
 * consoles included — and POST registers them.
 *
 * Super-admin only, like every other route under /api/admin.
 */

export const dynamic = 'force-dynamic'

/**
 * Every host this deployment needs the platform to serve: the two consoles
 * first — they are the ones an operator locks themselves out of — then one per
 * tenant.
 */
async function requiredSubdomains(): Promise<{ subdomain: string; kind: 'console' | 'tenant' }[]> {
  const supabase = getCacheClient() as any
  const { data } = await supabase.from('tenants').select('subdomain').order('created_at')
  return [
    ...CONSOLE_SUBDOMAINS.map((subdomain) => ({ subdomain, kind: 'console' as const })),
    ...(data ?? [])
      .map((row: any) => String(row.subdomain || '').toLowerCase())
      .filter(Boolean)
      .map((subdomain: string) => ({ subdomain, kind: 'tenant' as const })),
  ]
}

export async function GET() {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDomainAutomationConfigured()) {
    return NextResponse.json({ configured: false, missing: missingDomainConfig(), rootDomain: ROOT_DOMAIN, hosts: [] })
  }

  const [required, registered] = await Promise.all([requiredSubdomains(), listProjectDomains()])
  if (!registered) {
    return NextResponse.json({ error: 'Could not read the project domains' }, { status: 502 })
  }

  return NextResponse.json({
    configured: true,
    rootDomain: ROOT_DOMAIN,
    hosts: required.map(({ subdomain, kind }) => ({
      subdomain,
      kind,
      host: tenantHost(subdomain),
      registered: registered.has(tenantHost(subdomain)),
      // Registered but unverified means the host is on the project and still
      // cannot be opened — see listProjectDomains in src/lib/vercel-domains.ts.
      verified: registered.get(tenantHost(subdomain)) ?? false,
    })),
  })
}

export async function POST() {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDomainAutomationConfigured()) {
    return NextResponse.json({ configured: false, missing: missingDomainConfig(), added: 0, failed: [] })
  }

  const [required, registered] = await Promise.all([requiredSubdomains(), listProjectDomains()])
  if (!registered) {
    return NextResponse.json({ error: 'Could not read the project domains' }, { status: 502 })
  }

  // Only the ones actually missing. Re-adding an existing host is harmless
  // but costs a round trip each, and a platform with a hundred tenants would
  // spend a hundred of them on every click.
  const missing = required.filter(({ subdomain }) => !registered.has(tenantHost(subdomain)))

  const failed: { host: string; error: string }[] = []
  const added: string[] = []
  for (const { subdomain } of missing) {
    const result = await registerTenantDomain(subdomain)
    if (result.ok) added.push(result.host)
    else failed.push({ host: result.host, error: result.error || 'unknown error' })
  }

  // Adding a host to the project and the host opening in a browser are minutes
  // apart: the TLS certificate is issued afterwards, and until it exists the
  // address fails the handshake outright. Reporting "done" at this point sent
  // the operator straight to an address that would not load for another minute
  // or two, which looked like the sync had silently failed. So the hosts that
  // might not be serving yet — the ones just added, plus any the platform
  // already had but has not verified — are asked directly.
  const suspect = [
    ...added,
    ...required
      .map(({ subdomain }) => tenantHost(subdomain))
      .filter((host) => registered.get(host) === false),
  ]
  const probes = Array.from(new Set(suspect)).slice(0, 12)
  const pending = (
    await Promise.all(probes.map(async (host) => ((await isHostServing(host)) ? null : host)))
  ).filter((host): host is string => host !== null)

  return NextResponse.json({
    configured: true,
    rootDomain: ROOT_DOMAIN,
    checked: required.length,
    added: added.length,
    addedHosts: added,
    /** Registered, but not answering on HTTPS yet — the certificate is still coming. */
    pending,
    failed,
  })
}
