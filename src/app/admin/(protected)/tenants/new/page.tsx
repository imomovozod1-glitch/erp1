import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Building2 } from 'lucide-react'
import Link from 'next/link'
import { TenantForm } from '@/components/admin/tenant-form'

export const metadata: Metadata = { title: 'New tenant' }

export default async function NewTenantPage() {
  const [t, tTenants] = await Promise.all([
    getTranslations('admin.tenants.new'),
    getTranslations('admin.tenants'),
  ])

  return (
    <div className="space-y-6">
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> {tTenants('detail.back')}
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <TenantForm mode="create" />
    </div>
  )
}
