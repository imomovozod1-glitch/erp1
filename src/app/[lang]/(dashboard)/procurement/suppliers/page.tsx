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

  const [{ data: suppliers }, { data: purchaseOrders }, { data: supplierPayments }] = await Promise.all([
    supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
    supabase.from('purchase_orders').select('supplier_id, total_amount').neq('status', 'cancelled'),
    supabase.from('transactions').select('supplier_id, amount').eq('type', 'expense').not('supplier_id', 'is', null),
  ])

  const purchasesBySupplier = new Map<string, number>()
  for (const po of purchaseOrders ?? []) {
    if (!po.supplier_id) continue
    purchasesBySupplier.set(po.supplier_id, (purchasesBySupplier.get(po.supplier_id) || 0) + (Number(po.total_amount) || 0))
  }
  const paymentsBySupplier = new Map<string, number>()
  for (const tx of supplierPayments ?? []) {
    if (!tx.supplier_id) continue
    paymentsBySupplier.set(tx.supplier_id, (paymentsBySupplier.get(tx.supplier_id) || 0) + (Number(tx.amount) || 0))
  }
  const suppliersWithDebt = (suppliers ?? []).map((s) => ({
    ...s,
    total_debt: (purchasesBySupplier.get(s.id) || 0) - (paymentsBySupplier.get(s.id) || 0),
  }))

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
      <SuppliersTable suppliers={suppliersWithDebt} lang={lang} />
    </div>
  )
}
