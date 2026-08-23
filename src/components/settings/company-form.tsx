'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Globe, Phone, CalendarDays, Wallet, FileText, Users, IdCard } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'

type TenantInfo = {
  company_name: string
  subdomain: string
  phone: string
  status: 'active' | 'blocked' | 'inactive'
  license_count: number
  license_months: number
  subscription_started_at: string | null
  subscription_ends_at: string | null
  price_paid: number | null
  details: string | null
}

const STATUS_TONE: Record<TenantInfo['status'], StatusTone> = {
  active: 'emerald',
  blocked: 'rose',
  inactive: 'slate',
}

function InfoField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <p className="font-medium text-slate-800 dark:text-slate-200 text-sm wrap-break-word">{value}</p>
    </div>
  )
}

/**
 * Read-only view of this tenant's own `tenants` row — every field here was
 * entered by the super-admin when provisioning/editing the account in the
 * admin panel (see `TenantForm`). Tenant users can read their own row via
 * the `tenant_read_own` RLS policy but can only ever UPDATE the
 * `costing_method` column (see `supabase/migration_multi_tenant.sql`), so
 * this card is intentionally display-only — editing happens in `InventoryCostingForm`.
 */
export function CompanyForm() {
  const t = useTranslations('settings')
  const tForm = useTranslations('admin.form')
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(async () => {
      const supabase = createClient() as any
      const { data } = await supabase
        .from('tenants')
        .select('company_name, subdomain, phone, status, license_count, license_months, subscription_started_at, subscription_ends_at, price_paid, details')
        .limit(1)
        .maybeSingle()
      setTenant(data ?? null)
      setIsLoading(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <Card className="max-w-2xl border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!tenant) {
    return (
      <Card className="max-w-2xl border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardContent className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          {t('company')}
        </CardContent>
      </Card>
    )
  }

  const statusLabel =
    tenant.status === 'active' ? tForm('statusActive') : tenant.status === 'blocked' ? tForm('statusBlocked') : tForm('statusInactive')

  return (
    <Card className="max-w-2xl border-slate-200/60 dark:border-slate-800 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">{t('company')}</CardTitle>
          <CardDescription>{t('companyInfoDesc')}</CardDescription>
        </div>
        <StatusBadge label={statusLabel} tone={STATUS_TONE[tenant.status]} />
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <InfoField icon={Building2} label={t('companyName')} value={tenant.company_name} />
        <InfoField icon={Globe} label={tForm('subdomain')} value={tenant.subdomain} />
        <InfoField icon={Phone} label={t('phone')} value={tenant.phone} />
        <InfoField icon={Users} label={tForm('licenseCount')} value={tenant.license_count} />
        <InfoField icon={IdCard} label={tForm('licenseMonths')} value={`${tenant.license_months} ${tForm('months')}`} />
        <InfoField
          icon={Wallet}
          label={tForm('pricePaid')}
          value={tenant.price_paid != null ? formatCurrency(tenant.price_paid) : '—'}
        />
        <InfoField
          icon={CalendarDays}
          label={tForm('subscriptionStart')}
          value={tenant.subscription_started_at ? formatDate(tenant.subscription_started_at) : '—'}
        />
        <InfoField
          icon={CalendarDays}
          label={tForm('subscriptionEnd')}
          value={tenant.subscription_ends_at ? formatDate(tenant.subscription_ends_at) : '—'}
        />
        {tenant.details && (
          <div className="sm:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <InfoField icon={FileText} label={tForm('details')} value={tenant.details} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
