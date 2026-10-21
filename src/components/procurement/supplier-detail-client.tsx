'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import { MobileCard, MobileCardList } from '@/components/shared/mobile-list'
import { purchaseStatusTone } from '@/lib/statuses'
import dynamic from 'next/dynamic'

// react-leaflet/leaflet touch `window` at module-evaluation time, not just
// render time — a static import here crashes this page's SSR entirely
// (ReferenceError: window is not defined). Matches the existing ssr:false
// pattern already used for MapPicker in supplier-form.tsx/sale-form.tsx.
const LocationMapDialog = dynamic(
  () => import('@/components/shared/location-map-dialog').then((mod) => mod.LocationMapDialog),
  { ssr: false }
)
const LocationPreviewMap = dynamic(
  () => import('@/components/shared/location-preview-map').then((mod) => mod.LocationPreviewMap),
  { ssr: false }
)
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { orderOwed, supplierBalance } from '@/lib/supplier-debt'
import {
  Download, Truck, Phone, Mail, Globe, MapPin, DollarSign, Landmark
} from 'lucide-react'
// `xlsx` is ~7MB and only needed when the user actually exports or imports.
// Loading it on demand keeps it out of this page's initial bundle.

interface SupplierDetailClientProps {
  lang: string
  supplier: any
  purchaseOrders: any[]
  transactions: any[]
}

export function SupplierDetailClient({ lang, supplier, purchaseOrders, transactions }: SupplierDetailClientProps) {
  const tc = useTranslations('common')
  const t = useTranslations('procurement')
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'purchases' | 'payments'>('purchases')
  const [isMapOpen, setIsMapOpen] = useState(false)


  // Only received goods are owed, and only expense rows are payments — see
  // src/lib/supplier-debt.ts (the dashboard and the cashbox use the same rule).
  //
  // The expense rows are picked out ONCE and used everywhere below. They used
  // to be filtered for the total but not for the count beside it, nor for the
  // payments tab — so a supplier with an income row tagged to them showed a
  // payment count that did not match the sum, and that row was listed as a
  // payment with a minus in front of it.
  const payments = transactions.filter((tx) => tx.type === 'expense')
  const totalPurchases = purchaseOrders.reduce((sum, po) => sum + orderOwed(po), 0)
  const totalPayments = payments.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  const balance = supplierBalance(purchaseOrders, transactions)
  // Positive: we owe them. Negative: we are in advance. Both were printed as
  // "balance owed", so an advance read as a negative debt.
  const isAdvance = balance < 0

  // Export to Excel function
  const handleExport = async () => {
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()

    // 1. Supplier Details Sheet
    const colParameter = t('detail.colParameter')
    const colValue = t('detail.colValue')
    const supplierData = [
      { [colParameter]: tc('name'), [colValue]: supplier.name },
      { [colParameter]: t('contactPerson'), [colValue]: supplier.contact_person ?? '—' },
      { [colParameter]: tc('email'), [colValue]: supplier.email ?? '—' },
      { [colParameter]: tc('phone'), [colValue]: supplier.phone ?? '—' },
      { [colParameter]: t('tin'), [colValue]: supplier.tin ?? '—' },
      { [colParameter]: tc('address'), [colValue]: supplier.address ?? '—' },
      { [colParameter]: tc('status'), [colValue]: supplier.is_active ? tc('active') : tc('inactive') }
    ]
    const supplierWS = XLSX.utils.json_to_sheet(supplierData)
    XLSX.utils.book_append_sheet(workbook, supplierWS, t('supplierProfile'))

    // 2. Purchase Orders Sheet
    const poData = purchaseOrders.map(po => ({
      [t('poNumber')]: po.po_number,
      [t('totalCost')]: po.total_amount,
      [tc('status')]: t(`status.${po.status}`),
      [tc('notes')]: po.notes || '—',
      [tc('date')]: formatDateTime(po.created_at)
    }))
    const poWS = XLSX.utils.json_to_sheet(poData)
    XLSX.utils.book_append_sheet(workbook, poWS, t('purchaseOrders'))

    // 3. Payments Sheet
    const paymentsData = transactions.map(tx => ({
      [tc('category')]: tx.category,
      [tc('amount')]: tx.amount,
      [tc('description')]: tx.description || '—',
      [tc('date')]: formatDateTime(tx.created_at)
    }))
    const paymentsWS = XLSX.utils.json_to_sheet(paymentsData)
    XLSX.utils.book_append_sheet(workbook, paymentsWS, t('paymentHistory'))

    XLSX.writeFile(workbook, `${supplier.name.replace(/\s+/g, '_')}_details.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl md:rounded-xl border shadow-sm">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="shrink-0 p-3 bg-violet-50 dark:bg-violet-950/50 rounded-xl text-violet-600 dark:text-violet-400">
            <Truck className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight break-words">{supplier.name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {supplier.contact_person ? `${t('contactPerson')}: ${supplier.contact_person}` : ''}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <StatusBadge tone={supplier.is_active ? 'emerald' : 'slate'} label={supplier.is_active ? tc('active') : tc('inactive')} />
          <Button onClick={handleExport} size="sm" className="gap-2 max-md:h-10 bg-violet-600 hover:bg-violet-700 text-white shadow-sm font-medium">
            <Download className="h-4 w-4" />
            {tc('export')}
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{t('totalPurchases')}</span>
            <h3 className="text-xl md:text-2xl font-extrabold break-words tabular-nums text-slate-900 dark:text-slate-100 tracking-tight mt-1">{formatCurrency(totalPurchases)}</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-2">{purchaseOrders.length} {t('purchaseOrders')}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{t('totalPaid')}</span>
            <h3 className="text-xl md:text-2xl font-extrabold break-words tabular-nums text-emerald-700 dark:text-emerald-400 tracking-tight mt-1">{formatCurrency(totalPayments)}</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-2">{t('paymentsCount', { count: payments.length })}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">
              {isAdvance ? t('advancePaid') : t('balanceOwed')}
            </span>
            <h3 className={`text-xl md:text-2xl font-extrabold break-words tabular-nums tracking-tight mt-1 ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {formatCurrency(Math.abs(balance))}
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              {balance === 0 ? t('settled') : isAdvance ? t('advancePaidHint') : t('balanceOwedHint')}
            </span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{tc('status')}</span>
            <h3 className="text-xl md:text-2xl font-extrabold break-words tabular-nums text-slate-900 dark:text-slate-100 tracking-tight mt-1">
              {supplier.is_active ? tc('active') : tc('inactive')}
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-2">{t('detail.contact')}: {supplier.phone || '—'}</span>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Profile Info & Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm self-start">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">{t('supplierProfile')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {supplier.phone && (
              <div className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">{tc('phone')}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{supplier.phone}</span>
                </div>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">{tc('email')}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 break-all">{supplier.email}</span>
                </div>
              </div>
            )}
            {supplier.tin && (
              <div className="flex items-start gap-2.5">
                <Landmark className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">{t('tin')}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{supplier.tin}</span>
                </div>
              </div>
            )}
            {(supplier.address || (typeof supplier.latitude === 'number' && typeof supplier.longitude === 'number')) && (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">{tc('address')}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{supplier.address || '—'}</span>
                  </div>
                  <LocationPreviewMap
                    address={supplier.address}
                    latitude={supplier.latitude}
                    longitude={supplier.longitude}
                    onClick={() => setIsMapOpen(true)}
                  />
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    className="block py-2 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 cursor-pointer"
                  >
                    {t('detail.viewLargerMap')}
                  </button>
                </div>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-start gap-2.5">
                <Globe className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">{t('detail.website')}</span>
                  <a href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 dark:text-violet-400 text-xs break-all">
                    {supplier.website}
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Activity / Documents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm">
            <div className="flex gap-1 overflow-x-auto border-b px-2 max-md:[scrollbar-width:none]">
              <button
                onClick={() => setActiveTab('purchases')}
                className={`flex shrink-0 items-center gap-2 px-4 md:px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'purchases' ? 'border-violet-600 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Truck className="h-4 w-4" />
                {t('purchaseOrders')}
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`flex shrink-0 items-center gap-2 px-4 md:px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'payments' ? 'border-violet-600 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <DollarSign className="h-4 w-4" />
                {t('paymentHistory')}
              </button>
            </div>

            <div className="p-0">
              {activeTab === 'purchases' && (
                <MobileCardList className="p-3" isEmpty={purchaseOrders.length === 0} empty={<p className="py-10 text-center text-sm text-muted-foreground">{tc('noData')}</p>}>
                  {purchaseOrders.map((po) => (
                    <MobileCard
                      key={po.id}
                      onClick={() => router.push(`/${lang}/procurement/purchase-orders/${po.id}`)}
                      eyebrow={<span>{formatDateTime(po.created_at)}</span>}
                      title={po.po_number}
                      status={<StatusBadge tone={purchaseStatusTone(po.status)} label={t(`status.${po.status}`)} />}
                      stats={[{ label: tc('amount'), value: formatCurrency(po.total_amount), tone: 'bad' }]}
                    />
                  ))}
                </MobileCardList>
              )}

              {activeTab === 'purchases' && (
                <Table containerClassName="max-md:hidden">
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>{t('poNumber')}</TableHead>
                      <TableHead className="text-right">{tc('amount')}</TableHead>
                      <TableHead>{tc('status')}</TableHead>
                      <TableHead>{tc('date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseOrders.map((po, idx) => (
                        <TableRow
                          key={po.id}
                          // The rows already looked clickable — they highlight
                          // on hover — but went nowhere.
                          className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                          onClick={() => router.push(`/${lang}/procurement/purchase-orders/${po.id}`)}
                        >
                          <TableCell className="text-center text-xs text-slate-500 dark:text-slate-400">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-900 dark:text-slate-100">{po.po_number}</TableCell>
                          <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400">{formatCurrency(po.total_amount)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={purchaseStatusTone(po.status)} label={t(`status.${po.status}`)} />
                          </TableCell>
                          <TableCell className="text-slate-500 dark:text-slate-400 text-xs">{formatDateTime(po.created_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'payments' && (
                <MobileCardList className="p-3" isEmpty={payments.length === 0} empty={<p className="py-10 text-center text-sm text-muted-foreground">{tc('noData')}</p>}>
                  {payments.map((tx) => (
                    <MobileCard
                      key={tx.id}
                      onClick={() => router.push(`/${lang}/finance/transactions/${tx.id}`)}
                      eyebrow={<span>{formatDateTime(tx.created_at)}</span>}
                      title={tx.category}
                      subtitle={tx.description || undefined}
                      stats={[{ label: tc('amount'), value: `-${formatCurrency(tx.amount)}`, tone: 'bad' }]}
                    />
                  ))}
                </MobileCardList>
              )}

              {activeTab === 'payments' && (
                <Table containerClassName="max-md:hidden">
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>{tc('category')}</TableHead>
                      <TableHead className="text-right">{tc('amount')}</TableHead>
                      <TableHead>{tc('notes')}</TableHead>
                      <TableHead>{tc('date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((tx, idx) => (
                        <TableRow
                          key={tx.id}
                          className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                          onClick={() => router.push(`/${lang}/finance/transactions/${tx.id}`)}
                        >
                          <TableCell className="text-center text-xs text-slate-500 dark:text-slate-400">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                            {tx.category}
                          </TableCell>
                          <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400">
                            -{formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300 text-sm">{tx.description || '—'}</TableCell>
                          <TableCell className="text-slate-500 dark:text-slate-400 text-xs">{formatDateTime(tx.created_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </div>

      <LocationMapDialog
        open={isMapOpen}
        onOpenChange={setIsMapOpen}
        address={supplier.address}
        latitude={supplier.latitude}
        longitude={supplier.longitude}
        title={supplier.name}
        lang={lang}
      />
    </div>
  )
}
