import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Building2 } from 'lucide-react'
import { getSupportAgentSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Assigned tenants' }
export const dynamic = 'force-dynamic'

export default async function SupportHomePage() {
  const session = await getSupportAgentSession()
  const t = await getTranslations('supportPortal')

  // Support agents have no RLS policy of their own — this read has to go
  // through the service-role client, same as every other /support and
  // /admin server-side query in this codebase.
  const supabase = getCacheClient() as any
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, company_name, subdomain, phone, status')
    .eq('support_agent_id', session!.userId)
    .order('company_name')

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('assignedTenantsHeading')}</h1>

      {!tenants || tenants.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
            <Building2 className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t('noAssignedTenants')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tenants.map((tenant: { id: string; company_name: string; subdomain: string; phone: string; status: string }) => (
            <Card key={tenant.id} className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-4 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{tenant.company_name}</p>
                <p className="text-xs text-muted-foreground">{tenant.subdomain}</p>
                <p className="text-xs text-muted-foreground">{tenant.phone}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
