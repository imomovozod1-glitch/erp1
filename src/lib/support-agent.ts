import 'server-only'
import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'

/**
 * The support agent a tenant is assigned to (`tenants.support_agent_id`).
 *
 * Read with the service-role client on purpose: `support_agents` grants no
 * `authenticated` RLS policy (supabase/migration_support_agents.sql), so a
 * tenant's browser cannot select from it at all. Only the fields a customer
 * legitimately needs to reach their manager are returned — never the row's
 * auth identifiers.
 */
export interface AssignedSupportAgent {
  id: string
  fullName: string
  phone: string
}

export const getAssignedSupportAgent = unstable_cache(
  async (tenantId: string): Promise<AssignedSupportAgent | null> => {
    const supabase = getCacheClient() as any
    const { data: tenant } = await supabase
      .from('tenants')
      .select('support_agent_id')
      .eq('id', tenantId)
      .maybeSingle()

    if (!tenant?.support_agent_id) return null

    const { data: agent } = await supabase
      .from('support_agents')
      .select('id, full_name, phone')
      .eq('id', tenant.support_agent_id)
      .maybeSingle()

    if (!agent) return null
    return { id: agent.id, fullName: agent.full_name, phone: agent.phone }
  },
  ['assigned-support-agent'],
  // Short window rather than a tag the super-admin console would have to
  // remember to bust: reassignment is rare, and being five minutes stale about
  // who your manager is has no consequence.
  { revalidate: 300 }
)
