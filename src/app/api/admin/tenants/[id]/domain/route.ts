import { NextRequest, NextResponse } from 'next/server'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { getTenantDomainStatus, registerTenantDomain } from '@/lib/vercel-domains'

/**
 * One company's address, as the console shows it.
 *
 * The bulk endpoint (/api/admin/domains) answers "which hosts are missing"
 * across the whole platform; this one answers "is this company reachable",
 * which is the question actually asked while looking at a company — and the
 * one that needs the live check, not just the platform's record.
 *
 * Super-admin only, like every other route under /api/admin.
 */
export const dynamic = 'force-dynamic'

async function subdomainOf(id: string): Promise<string | null> {
  const supabase = getCacheClient() as any
  const { data } = await supabase.from('tenants').select('subdomain').eq('id', id).maybeSingle()
  const subdomain = String(data?.subdomain || '').toLowerCase()
  return subdomain || null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subdomain = await subdomainOf((await params).id)
  if (!subdomain) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  return NextResponse.json(await getTenantDomainStatus(subdomain))
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subdomain = await subdomainOf((await params).id)
  if (!subdomain) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const result = await registerTenantDomain(subdomain)
  if (!result.ok && !result.skipped) {
    return NextResponse.json({ error: result.error || 'Failed to register the domain' }, { status: 502 })
  }

  // The status AFTER registering, so the console shows the certificate still
  // coming rather than claiming the address already works.
  return NextResponse.json(await getTenantDomainStatus(subdomain))
}
