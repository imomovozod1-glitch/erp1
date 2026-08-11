import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { SuppliersTable } from '@/components/procurement/suppliers-table'
import { SupplierImportExport } from '@/components/procurement/supplier-import-export'

export const metadata: Metadata = { title: 'Suppliers' }

export default async function SuppliersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations('procurement')
  const supabase = await createClient()

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader
        title={t('suppliers')}
        subtitle={t('title')}
        action={{ label: t('addSupplier'), href: `/${lang}/procurement/suppliers/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('suppliers') },
        ]}
      >
        <SupplierImportExport suppliers={suppliers ?? []} lang={lang} />
      </PageHeader>
      <SuppliersTable suppliers={suppliers ?? []} lang={lang} />
    </div>
  )
}
