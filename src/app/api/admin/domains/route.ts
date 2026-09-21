import { NextResponse } from 'next/server'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import {
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
 * the repair: GET says which tenants the platform does not serve yet, POST
 * registers them.
 *
 * Super-admin only, like every other route under /api/admin.
 */

export const dynamic = 'force-dynamic'

async function tenantSubdomains(): Promise<string[]> {
  const supabase = getCacheClient() as any
  const { data } = await supabase.from('tenants').select('subdomain').order('created_at')
  return (data ?? []).map((row: any) => String(row.subdomain).toLowerCase()).filter(Boolean)
}

export async function GET() {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDomainAutomationConfigured()) {
    return NextResponse.json({ configured: false, rootDomain: ROOT_DOMAIN, tenants: [] })
  }

  const [subdomains, registered] = await Promise.all([tenantSubdomains(), listProjectDomains()])
  if (!registered) {
    return NextResponse.json({ error: 'Could not read the project domains' }, { status: 502 })
  }

  return NextResponse.json({
    configured: true,
    rootDomain: ROOT_DOMAIN,
    tenants: subdomains.map((subdomain) => ({
      subdomain,
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

  const [subdomains, registered] = await Promise.all([tenantSubdomains(), listProjectDomains()])
  if (!registered) {
    return NextResponse.json({ error: 'Could not read the project domains' }, { status: 502 })
  }

  // Only the ones actually missing. Re-adding an existing host is harmless
  // but costs a round trip each, and a platform with a hundred tenants would
  // spend a hundred of them on every click.
  const missing = subdomains.filter((subdomain) => !registered.has(tenantHost(subdomain)))

  const failed: { host: string; error: string }[] = []
  let added = 0
  for (const subdomain of missing) {
    const result = await registerTenantDomain(subdomain)
    if (result.ok) added++
    else failed.push({ host: result.host, error: result.error || 'unknown error' })
  }

  return NextResponse.json({
    configured: true,
    rootDomain: ROOT_DOMAIN,
    checked: subdomains.length,
    added,
    failed,
  })
}
