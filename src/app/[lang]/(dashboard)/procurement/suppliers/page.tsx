import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { getSuppliersPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { SuppliersTable } from '@/components/procurement/suppliers-table'
import { SupplierImportExport } from '@/components/procurement/supplier-import-export'
import { canEditModule } from '@/lib/permissions-server'

export const metadata: Metadata = { title: 'Suppliers' }

export default async function SuppliersPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  const { page, pageSize, search } = readPageParams(sp)
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('procurement')
  const t = await getTranslations('procurement')
  const tInfo = await getTranslations('pageInfo')
  const tenantId = (await getCurrentTenantId()) as string
  const supabase = await createClient()

  // Suppliers are paginated server-side; the debt aggregates below are only
  // computed for the page being shown.
  const suppliersPage = await getSuppliersPage(tenantId, { page, pageSize, search })
  const supplierIds = suppliersPage.rows.map((row: { id: string }) => row.id)

  const [{ data: purchaseOrders }, { data: supplierPayments }] = await Promise.all([
    supplierIds.length
      ? supabase.from('purchase_orders').select('supplier_id, total_amount').in('supplier_id', supplierIds).neq('status', 'cancelled')
      : Promise.resolve({ data: [] as { supplier_id: string; total_amount: number }[] }),
    supplierIds.length
      ? supabase.from('transactions').select('supplier_id, amount').eq('type', 'expense').in('supplier_id', supplierIds)
      : Promise.resolve({ data: [] as { supplier_id: string; amount: number }[] }),
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
  const suppliersWithDebt = suppliersPage.rows.map((s: any) => ({
    ...s,
    total_debt: (purchasesBySupplier.get(s.id) || 0) - (paymentsBySupplier.get(s.id) || 0),
  }))

  return (
    <div>
      <PageHeader
        title={t('suppliers')}
        subtitle={t('title')}
        info={tInfo('suppliers')}
        action={canEdit ? { label: t('addSupplier'), href: `/${lang}/procurement/suppliers/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('suppliers') },
        ]}
      >
        <SupplierImportExport suppliers={suppliersPage.rows} lang={lang} />
      </PageHeader>
      <SuppliersTable
        suppliers={suppliersWithDebt}
        lang={lang}
        page={suppliersPage.page}
        pageSize={suppliersPage.pageSize}
        total={suppliersPage.total}
        totalPages={suppliersPage.totalPages}
      />
    </div>
  )
}
