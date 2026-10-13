'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import { effectiveInvoiceStatus, invoiceStatusTone, orderStatusTone } from '@/lib/statuses'
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
import { formatCurrency, formatDate, formatDateTime, getInitials } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Download, ShoppingCart, Phone, Mail, MapPin, Landmark, FileText, History, Tags
} from 'lucide-react'
// `xlsx` is ~7MB and only needed when the user actually exports or imports.
// Loading it on demand keeps it out of this page's initial bundle.

interface CustomerDetailClientProps {
  lang: string
  customer: any
  salesOrders: any[]
  invoices: any[]
  transactions: any[]
}

export function CustomerDetailClient({ lang, customer, salesOrders, invoices, transactions }: CustomerDetailClientProps) {
  const tSales = useTranslations('sales')
  const tc = useTranslations('common')
  const tcd = useTranslations('sales.customerDetail')
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'orders' | 'invoices' | 'transactions'>('orders')
  const [isMapOpen, setIsMapOpen] = useState(false)


  // Calculate Metrics
  const totalPurchases = salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0)
  const outstandingDebt = invoices
    .filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + ((inv.total_amount || 0) - (inv.paid_amount || 0)), 0)
  const creditBalance = Number(customer.credit_balance) || 0
  // Net balance: credit (haqdorlik) minus debt (qarz) — positive means the customer
  // holds credit with us, negative means they owe us.
  const balance = creditBalance - outstandingDebt

  // Export to Excel function
  const handleExport = async () => {
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()

    // 1. Customer Details Sheet
    const customerData = [
      { [tc('name')]: customer.name, [tcd('value')]: customer.name },
      { [tc('email')]: customer.email ?? '—', [tcd('value')]: customer.email ?? '—' },
      { [tc('phone')]: customer.phone ?? '—', [tcd('value')]: customer.phone ?? '—' },
      { [tSales('tin')]: customer.tin ?? '—', [tcd('value')]: customer.tin ?? '—' },
      { [tc('address')]: customer.address ?? '—', [tcd('value')]: customer.address ?? '—' },
      { [tc('status')]: customer.is_active ? tc('active') : tc('inactive'), [tcd('value')]: customer.is_active ? tc('active') : tc('inactive') }
    ]
    const customerWS = XLSX.utils.json_to_sheet(customerData)
    XLSX.utils.book_append_sheet(workbook, customerWS, tcd('sheetProfile'))

    // 2. Orders Sheet
    const ordersData = salesOrders.map(o => ({
      [tSales('orderNumber')]: o.order_number,
      [tc('totalAmount')]: o.total_amount,
      [tc('status')]: tSales(`status.${o.status}`),
      [tc('notes')]: o.notes || '—',
      [tc('date')]: formatDateTime(o.created_at)
    }))
    const ordersWS = XLSX.utils.json_to_sheet(ordersData)
    XLSX.utils.book_append_sheet(workbook, ordersWS, tcd('sheetOrders'))

    // 3. Invoices Sheet
    const invoicesData = invoices.map(inv => ({
      [tSales('invoiceNumber')]: inv.invoice_number,
      [tc('totalAmount')]: inv.total_amount,
      [tSales('paidAmount')]: inv.paid_amount,
      [tc('status')]: tSales(`status.${inv.status}`),
      [tSales('dueDate')]: formatDate(inv.due_at),
      [tcd('issuedDate')]: formatDateTime(inv.created_at)
    }))
    const invoicesWS = XLSX.utils.json_to_sheet(invoicesData)
    XLSX.utils.book_append_sheet(workbook, invoicesWS, tcd('sheetInvoices'))

    // 4. Transactions (Payment History) Sheet
    const transactionsData = transactions.map(tx => ({
      [tc('type')]: tx.type === 'income' ? tcd('income') : tcd('expense'),
      [tc('category')]: tx.category,
      [tc('amount')]: tx.amount,
      [tc('date')]: formatDateTime(tx.created_at),
      [tcd('note')]: tx.description || '—'
    }))
    const transactionsWS = XLSX.utils.json_to_sheet(transactionsData)
    XLSX.utils.book_append_sheet(workbook, transactionsWS, tcd('sheetPayments'))

    XLSX.writeFile(workbook, `${customer.name.replace(/\s+/g, '_')}_details.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3.5">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 text-lg font-bold">
              {getInitials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{customer.name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {customer.phone || customer.email || ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge tone={customer.is_active ? 'emerald' : 'slate'} label={customer.is_active ? tc('active') : tc('inactive')} />
          <Button onClick={handleExport} size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-sm font-medium">
            <Download className="h-4 w-4" />
            {tc('export')}
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{tcd('totalPurchases')}</span>
            <h3 className="mt-1 text-xl font-bold tracking-tight break-words tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(totalPurchases)}</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-2">{tcd('salesCount', { count: salesOrders.length })}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{tcd('totalPaid')}</span>
            <h3 className="mt-1 text-xl font-bold tracking-tight break-words tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(totalPaid)}</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-2">{tcd('invoicesCount', { count: invoices.length })}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{tSales('balanceRemaining')}</span>
            {/* Musbat — haqdorlik, manfiy — qarz. Qorong'i rejimda musbati
                `dark:text-white` edi: rang jufti buzilib, faqat manfiysi
                rangli qolardi. */}
            <h3
              className={`mt-1 text-xl font-bold tracking-tight break-words tabular-nums ${
                balance > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : balance < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {balance > 0 ? '+' : balance < 0 ? '-' : ''}{formatCurrency(Math.abs(balance))}
            </h3>
            <span className="mt-2 text-xs tabular-nums text-slate-400 dark:text-slate-500">
              {tSales('debt')}: {formatCurrency(outstandingDebt)} · {tSales('credit')}: {formatCurrency(creditBalance)}
            </span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{tc('status')}</span>
            <h3 className="mt-1 text-xl font-bold tracking-tight break-words tabular-nums text-slate-900 dark:text-slate-100">
              {customer.is_active ? tc('active') : tc('inactive')}
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-2">{tcd('contact')}: {customer.phone || '—'}</span>
          </CardContent>
        </Card>
      </div>

      {/* Customer Profile Info & Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm self-start">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">{tcd('profile')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {customer.customer_categories?.name && (
              <div className="flex items-start gap-2.5">
                <Tags className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">{tSales('category')}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{customer.customer_categories.name}</span>
                </div>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">{tc('phone')}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{customer.phone}</span>
                </div>
              </div>
            )}
            {customer.email && (
              <div className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">{tc('email')}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{customer.email}</span>
                </div>
              </div>
            )}
            {customer.tin && (
              <div className="flex items-start gap-2.5">
                <Landmark className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">{tSales('tin')}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{customer.tin}</span>
                </div>
              </div>
            )}
            {(customer.address || (typeof customer.latitude === 'number' && typeof customer.longitude === 'number')) && (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">{tc('address')}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{customer.address || '—'}</span>
                  </div>
                  <LocationPreviewMap
                    address={customer.address}
                    latitude={customer.latitude}
                    longitude={customer.longitude}
                    onClick={() => setIsMapOpen(true)}
                  />
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    className="block text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 cursor-pointer"
                  >
                    {tcd('viewLargerMap')}
                  </button>
                </div>
              </div>
            )}
            {customer.notes && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-400 dark:text-slate-500 block mb-1">{tc('description')}</span>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Activity / Documents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm">
            <div className="flex border-b overflow-x-auto">
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'orders' ? 'border-violet-600 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <ShoppingCart className="h-4 w-4" />
                {tcd('tabSales')}
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'invoices' ? 'border-violet-600 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <FileText className="h-4 w-4" />
                {tcd('tabInvoices')}
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'transactions' ? 'border-violet-600 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <History className="h-4 w-4" />
                {tcd('tabPayments')}
              </button>
            </div>

            <div className="p-0">
              {activeTab === 'orders' && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>{tcd('orderCode')}</TableHead>
                      <TableHead className="text-right">{tc('amount')}</TableHead>
                      <TableHead>{tc('status')}</TableHead>
                      <TableHead>{tc('date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      salesOrders.map((o, idx) => (
                        <TableRow
                          key={o.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
                          onClick={() => router.push(`/${lang}/sales/orders/${o.id}`)}
                        >
                          <TableCell className="text-center text-xs text-slate-500 dark:text-slate-400">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-900 dark:text-slate-100">{o.order_number}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(o.total_amount)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={orderStatusTone(o.status)} label={tSales(`status.${o.status}`)} />
                          </TableCell>
                          <TableCell className="text-slate-500 dark:text-slate-400 text-xs">{formatDateTime(o.created_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'invoices' && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>{tcd('invoiceCode')}</TableHead>
                      <TableHead className="text-right">{tc('amount')}</TableHead>
                      <TableHead className="text-right">{tcd('paid')}</TableHead>
                      <TableHead>{tc('status')}</TableHead>
                      <TableHead>{tcd('due')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoices.map((inv, idx) => (
                        <TableRow
                          key={inv.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
                          onClick={() => router.push(`/${lang}/sales/invoices/${inv.id}`)}
                        >
                          <TableCell className="text-center text-xs text-slate-500 dark:text-slate-400">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-900 dark:text-slate-100">{inv.invoice_number}</TableCell>
                          <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200">{formatCurrency(inv.total_amount)}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(inv.paid_amount)}</TableCell>
                          <TableCell>
                            <StatusBadge
                              tone={invoiceStatusTone(effectiveInvoiceStatus(inv))}
                              label={tSales(`status.${effectiveInvoiceStatus(inv)}`)}
                            />
                          </TableCell>
                          <TableCell className="text-slate-500 dark:text-slate-400 text-xs">{formatDate(inv.due_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'transactions' && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>{tc('type')}</TableHead>
                      <TableHead>{tc('category')}</TableHead>
                      <TableHead className="text-right">{tc('amount')}</TableHead>
                      <TableHead>{tc('date')}</TableHead>
                      <TableHead>{tcd('note')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((tx, idx) => {
                        const isIncome = tx.type === 'income'
                        return (
                          <TableRow key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <TableCell className="text-center text-xs text-slate-500 dark:text-slate-400">{idx + 1}</TableCell>
                            <TableCell>
                              <StatusBadge
                                tone={isIncome ? 'emerald' : 'rose'}
                                label={isIncome ? tcd('income') : tcd('expense')}
                              />
                            </TableCell>
                            <TableCell className="text-slate-700 dark:text-slate-300 text-xs">{tx.category}</TableCell>
                            <TableCell className={`text-right font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                            </TableCell>
                            <TableCell className="text-slate-500 dark:text-slate-400 text-xs">{formatDateTime(tx.created_at)}</TableCell>
                            <TableCell className="text-slate-500 dark:text-slate-400 text-xs max-w-50 truncate">{tx.description || '—'}</TableCell>
                          </TableRow>
                        )
                      })
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
        address={customer.address}
        latitude={customer.latitude}
        longitude={customer.longitude}
        title={customer.name}
        lang={lang}
      />
    </div>
  )
}
