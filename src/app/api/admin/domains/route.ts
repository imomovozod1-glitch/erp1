import { NextResponse } from 'next/server'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import {
  CONSOLE_SUBDOMAINS,
  ROOT_DOMAIN,
  isDomainAutomationConfigured,
  listProjectDomains,
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
    return NextResponse.json({ configured: false, rootDomain: ROOT_DOMAIN, hosts: [] })
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
    })),
  })
}

export async function POST() {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDomainAutomationConfigured()) {
    return NextResponse.json({ configured: false, added: 0, failed: [] })
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
  let added = 0
  for (const { subdomain } of missing) {
    const result = await registerTenantDomain(subdomain)
    if (result.ok) added++
    else failed.push({ host: result.host, error: result.error || 'unknown error' })
  }

  return NextResponse.json({
    configured: true,
    rootDomain: ROOT_DOMAIN,
    checked: required.length,
    added,
    failed,
  })
}
