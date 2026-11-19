'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { DollarSign, Globe, Landmark, Mail, Phone, Truck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DetailBanner, DetailTabs, KpiGrid, KpiTile, downloadWorkbook } from '@/components/shared/detail-page'
import { LocationLine, ProfileCard, ProfileLine } from '@/components/shared/profile-lines'
import { ResponsiveTable } from '@/components/shared/responsive-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { purchaseStatusTone } from '@/lib/statuses'
import { orderOwed, supplierBalance } from '@/lib/supplier-debt'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const LocationMapDialog = dynamic(() => import('@/components/shared/location-map-dialog').then((m) => m.LocationMapDialog), { ssr: false })

interface SupplierDetailClientProps {
  lang: string
  supplier: any
  purchaseOrders: any[]
  transactions: any[]
}

type Translate = ReturnType<typeof useTranslations>

// Only received goods are owed and only expense rows are payments (src/lib/supplier-debt.ts).
function supplierFigures(purchaseOrders: any[], transactions: any[]) {
  const payments = transactions.filter((tx) => tx.type === 'expense')
  return {
    payments,
    purchased: purchaseOrders.reduce((sum, po) => sum + orderOwed(po), 0),
    paid: payments.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    balance: supplierBalance(purchaseOrders, transactions),
  }
}

function exportSupplier(supplier: any, purchaseOrders: any[], payments: any[], t: Translate) {
  const [param, value] = [t('procurement.detail.colParameter'), t('procurement.detail.colValue')]
  const profile: [string, unknown][] = [
    [t('common.name'), supplier.name],
    [t('procurement.contactPerson'), supplier.contact_person ?? '—'],
    [t('common.email'), supplier.email ?? '—'],
    [t('common.phone'), supplier.phone ?? '—'],
    [t('procurement.tin'), supplier.tin ?? '—'],
    [t('common.address'), supplier.address ?? '—'],
    [t('common.status'), t(supplier.is_active ? 'common.active' : 'common.inactive')],
  ]
  return downloadWorkbook(`${supplier.name.replace(/\s+/g, '_')}_details.xlsx`, [
    { name: t('procurement.supplierProfile'), rows: profile.map(([p, v]) => ({ [param]: p, [value]: v })) },
    {
      name: t('procurement.purchaseOrders'),
      rows: purchaseOrders.map((po) => ({
        [t('procurement.poNumber')]: po.po_number,
        [t('common.totalAmount')]: po.total_amount,
        [t('common.status')]: t(`procurement.status.${po.status}`),
        [t('common.date')]: formatDateTime(po.created_at),
      })),
    },
    {
      name: t('procurement.paymentHistory'),
      rows: payments.map((tx) => ({
        [t('common.category')]: tx.category,
        [t('common.amount')]: tx.amount,
        [t('common.description')]: tx.description || '—',
        [t('common.date')]: formatDateTime(tx.created_at),
      })),
    },
  ])
}

function SupplierKpis({ supplier, purchaseOrders, figures }: { supplier: any; purchaseOrders: any[]; figures: ReturnType<typeof supplierFigures> }) {
  const t = useTranslations()
  const { balance } = figures
  const advance = balance < 0
  return (
    <KpiGrid>
      <KpiTile label={t('procurement.totalPurchases')} value={formatCurrency(figures.purchased)}>
        {purchaseOrders.length} {t('procurement.purchaseOrders')}
      </KpiTile>
      <KpiTile label={t('procurement.totalPaid')} value={formatCurrency(figures.paid)} valueClassName="text-emerald-700 dark:text-emerald-400">
        {t('procurement.paymentsCount', { count: figures.payments.length })}
      </KpiTile>
      <KpiTile
        label={t(advance ? 'procurement.advancePaid' : 'procurement.balanceOwed')}
        value={formatCurrency(Math.abs(balance))}
        valueClassName={balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}
      >
        {t(balance === 0 ? 'procurement.settled' : advance ? 'procurement.advancePaidHint' : 'procurement.balanceOwedHint')}
      </KpiTile>
      <KpiTile label={t('common.status')} value={t(supplier.is_active ? 'common.active' : 'common.inactive')}>
        {t('procurement.detail.contact')}: {supplier.phone || '—'}
      </KpiTile>
    </KpiGrid>
  )
}

function SupplierProfile({ supplier, onOpenMap }: { supplier: any; onOpenMap: () => void }) {
  const t = useTranslations()
  const website = supplier.website?.startsWith('http') ? supplier.website : `https://${supplier.website}`
  return (
    <ProfileCard title={t('procurement.supplierProfile')}>
      {supplier.phone && <ProfileLine icon={Phone} label={t('common.phone')}>{supplier.phone}</ProfileLine>}
      {supplier.email && <ProfileLine icon={Mail} label={t('common.email')}><span className="break-all">{supplier.email}</span></ProfileLine>}
      {supplier.tin && <ProfileLine icon={Landmark} label={t('procurement.tin')}>{supplier.tin}</ProfileLine>}
      <LocationLine row={supplier} label={t('common.address')} openLabel={t('procurement.detail.viewLargerMap')} onOpen={onOpenMap} />
      {supplier.website && (
        <ProfileLine icon={Globe} label={t('procurement.detail.website')}>
          <a href={website} target="_blank" rel="noopener noreferrer" className="text-xs break-all text-violet-600 dark:text-violet-400">
            {supplier.website}
          </a>
        </ProfileLine>
      )}
    </ProfileCard>
  )
}

function SupplierActivity({ purchaseOrders, payments, lang }: { purchaseOrders: any[]; payments: any[]; lang: string }) {
  const t = useTranslations()
  const router = useRouter()
  const status = (po: any) => <StatusBadge tone={purchaseStatusTone(po.status)} label={t(`procurement.status.${po.status}`)} />
  const purchases = (
    <ResponsiveTable
      rows={purchaseOrders}
      rowKey={(po) => po.id}
      onRowClick={(po) => router.push(`/${lang}/procurement/purchase-orders/${po.id}`)}
      columns={[
        { key: 'po', header: t('procurement.poNumber'), className: 'font-semibold', cell: (po) => po.po_number },
        { key: 'amount', header: t('common.amount'), align: 'right', className: 'font-bold text-rose-600 dark:text-rose-400', cell: (po) => formatCurrency(po.total_amount) },
        { key: 'status', header: t('common.status'), cell: status },
        { key: 'date', header: t('common.date'), className: 'text-xs text-muted-foreground', cell: (po) => formatDateTime(po.created_at) },
      ]}
      card={(po) => ({ eyebrow: <span>{formatDateTime(po.created_at)}</span>, title: po.po_number, status: status(po), stats: [{ label: t('common.amount'), value: formatCurrency(po.total_amount), tone: 'bad' }] })}
    />
  )
  const paid = (
    <ResponsiveTable
      rows={payments}
      rowKey={(tx) => tx.id}
      onRowClick={(tx) => router.push(`/${lang}/finance/transactions/${tx.id}`)}
      columns={[
        { key: 'category', header: t('common.category'), className: 'font-semibold', cell: (tx) => tx.category },
        { key: 'amount', header: t('common.amount'), align: 'right', className: 'font-bold text-rose-600 dark:text-rose-400', cell: (tx) => `-${formatCurrency(tx.amount)}` },
        { key: 'notes', header: t('common.notes'), className: 'text-sm text-muted-foreground', cell: (tx) => tx.description || '—' },
        { key: 'date', header: t('common.date'), className: 'text-xs text-muted-foreground', cell: (tx) => formatDateTime(tx.created_at) },
      ]}
      card={(tx) => ({ eyebrow: <span>{formatDateTime(tx.created_at)}</span>, title: tx.category, subtitle: tx.description || undefined, stats: [{ label: t('common.amount'), value: `-${formatCurrency(tx.amount)}`, tone: 'bad' }] })}
    />
  )
  return (
    <DetailTabs
      tabs={[
        { key: 'purchases', icon: Truck, label: t('procurement.purchaseOrders'), content: purchases },
        { key: 'payments', icon: DollarSign, label: t('procurement.paymentHistory'), content: paid },
      ]}
    />
  )
}

export function SupplierDetailClient({ lang, supplier, purchaseOrders, transactions }: SupplierDetailClientProps) {
  const t = useTranslations()
  const [mapOpen, setMapOpen] = useState(false)
  const figures = supplierFigures(purchaseOrders, transactions)
  const icon = (
    <span className="shrink-0 rounded-xl bg-brand-subtle p-3 text-violet-600 dark:text-violet-400">
      <Truck className="size-7" />
    </span>
  )
  return (
    <div className="space-y-6">
      <DetailBanner
        leading={icon}
        title={supplier.name}
        subtitle={supplier.contact_person ? `${t('procurement.contactPerson')}: ${supplier.contact_person}` : undefined}
        active={supplier.is_active}
        onExport={() => exportSupplier(supplier, purchaseOrders, figures.payments, t)}
      />
      <SupplierKpis supplier={supplier} purchaseOrders={purchaseOrders} figures={figures} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SupplierProfile supplier={supplier} onOpenMap={() => setMapOpen(true)} />
        <div className="lg:col-span-2">
          <SupplierActivity purchaseOrders={purchaseOrders} payments={figures.payments} lang={lang} />
        </div>
      </div>
      <LocationMapDialog open={mapOpen} onOpenChange={setMapOpen} address={supplier.address} latitude={supplier.latitude} longitude={supplier.longitude} title={supplier.name} lang={lang} />
    </div>
  )
}
