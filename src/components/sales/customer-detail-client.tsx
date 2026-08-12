'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { LocationMapDialog } from '@/components/shared/location-map-dialog'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Download, ShoppingCart, Phone, Mail, MapPin, Landmark, FileText, Wallet, History
} from 'lucide-react'
import * as XLSX from 'xlsx'

const ORDER_STATUS_TONES: Record<string, StatusTone> = {
  draft: 'blue',
  pending: 'blue',
  confirmed: 'blue',
  shipped: 'blue',
  delivered: 'emerald',
  cancelled: 'rose',
}

const INVOICE_STATUS_TONES: Record<string, StatusTone> = {
  draft: 'slate',
  sent: 'blue',
  paid: 'emerald',
  overdue: 'rose',
  cancelled: 'slate',
}

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
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'orders' | 'invoices' | 'transactions'>('orders')
  const [isMapOpen, setIsMapOpen] = useState(false)

  // Force a fresh server fetch on every visit — the browser's client-side
  // router cache can otherwise show a stale balance right after a payment
  // was made on a different page (Next.js reuses cached RSC payloads on
  // back/forward navigation regardless of server-side cache invalidation).
  useEffect(() => {
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate Metrics
  const totalPurchases = salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0)
  const outstandingDebt = invoices
    .filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + ((inv.total_amount || 0) - (inv.paid_amount || 0)), 0)
  const creditBalance = Number(customer.credit_balance) || 0

  // Export to Excel function
  const handleExport = () => {
    const workbook = XLSX.utils.book_new()

    // 1. Customer Details Sheet
    const customerData = [
      { [tc('name')]: customer.name, Value: customer.name },
      { [tc('email')]: customer.email ?? '—', Value: customer.email ?? '—' },
      { [tc('phone')]: customer.phone ?? '—', Value: customer.phone ?? '—' },
      { [tSales('tin')]: customer.tin ?? '—', Value: customer.tin ?? '—' },
      { [tc('address')]: customer.address ?? '—', Value: customer.address ?? '—' },
      { [tc('status')]: customer.is_active ? tc('active') : tc('inactive'), Value: customer.is_active ? tc('active') : tc('inactive') }
    ]
    const customerWS = XLSX.utils.json_to_sheet(customerData)
    XLSX.utils.book_append_sheet(workbook, customerWS, "Customer Profile")

    // 2. Orders Sheet
    const ordersData = salesOrders.map(o => ({
      OrderNumber: o.order_number,
      TotalAmount: o.total_amount,
      Status: o.status,
      Notes: o.notes || '—',
      Date: formatDate(o.order_date)
    }))
    const ordersWS = XLSX.utils.json_to_sheet(ordersData)
    XLSX.utils.book_append_sheet(workbook, ordersWS, "Sales Orders")

    // 3. Invoices Sheet
    const invoicesData = invoices.map(inv => ({
      InvoiceNumber: inv.invoice_number,
      TotalAmount: inv.total_amount,
      PaidAmount: inv.paid_amount,
      Status: inv.status,
      DueDate: formatDate(inv.due_at),
      IssuedDate: formatDate(inv.issued_at)
    }))
    const invoicesWS = XLSX.utils.json_to_sheet(invoicesData)
    XLSX.utils.book_append_sheet(workbook, invoicesWS, "Invoices")

    // 4. Transactions (Payment History) Sheet
    const transactionsData = transactions.map(tx => ({
      Type: tx.type,
      Category: tx.category,
      Amount: tx.amount,
      Date: formatDate(tx.transaction_date),
      Note: tx.description || '—'
    }))
    const transactionsWS = XLSX.utils.json_to_sheet(transactionsData)
    XLSX.utils.book_append_sheet(workbook, transactionsWS, "Payment History")

    XLSX.writeFile(workbook, `${customer.name.replace(/\s+/g, '_')}_details.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3.5">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-lg font-bold">
              {getInitials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{customer.name}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {customer.phone || customer.email || ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge tone={customer.is_active ? 'emerald' : 'slate'} label={customer.is_active ? tc('active') : tc('inactive')} />
          <Button onClick={handleExport} size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-medium">
            <Download className="h-4 w-4" />
            {tc('export') || 'Eksport'}
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Jami xaridlar' : lang === 'ru' ? 'Всего покупок' : 'Total purchases'}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatCurrency(totalPurchases)}</h3>
            <span className="text-xs text-slate-400 mt-2">{salesOrders.length} {lang === 'uz' ? 'ta buyurtma' : lang === 'ru' ? 'заказов' : 'orders'}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Jami to\'langan' : lang === 'ru' ? 'Всего оплачено' : 'Total paid'}</span>
            <h3 className="text-2xl font-extrabold text-emerald-700 tracking-tight mt-1">{formatCurrency(totalPaid)}</h3>
            <span className="text-xs text-slate-400 mt-2">{invoices.length} {lang === 'uz' ? 'ta hisob-faktura' : lang === 'ru' ? 'счетов' : 'invoices'}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Balans (Uning qarzi)' : lang === 'ru' ? 'Баланс (Долг клиента)' : 'Balance (Owed to us)'}</span>
            <h3 className={`text-2xl font-extrabold tracking-tight mt-1 ${outstandingDebt > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {formatCurrency(outstandingDebt)}
            </h3>
            <span className="text-xs text-slate-400 mt-2">{tSales('tin')}: {customer.tin || '—'}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Haqdorlik' : lang === 'ru' ? 'Депозит клиента' : 'Customer credit'}</span>
            <h3 className={`text-2xl font-extrabold tracking-tight mt-1 ${creditBalance > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
              {formatCurrency(creditBalance)}
            </h3>
            <span className="text-xs text-slate-400 mt-2">{lang === 'uz' ? 'Ortiqcha to\'lovdan' : lang === 'ru' ? 'От переплаты' : 'From overpayment'}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{tc('status')}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {customer.is_active ? (lang === 'uz' ? 'Faol' : lang === 'ru' ? 'Активен' : 'Active') : (lang === 'uz' ? 'Nofaol' : lang === 'ru' ? 'Неактивен' : 'Inactive')}
            </h3>
            <span className="text-xs text-slate-400 mt-2">{lang === 'uz' ? 'Kontakt' : lang === 'ru' ? 'Контакты' : 'Contact'}: {customer.phone || '—'}</span>
          </CardContent>
        </Card>
      </div>

      {/* Customer Profile Info & Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm self-start">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">{lang === 'uz' ? "Mijoz ma'lumotlari" : lang === 'ru' ? 'Профиль клиента' : 'Customer profile'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {customer.phone && (
              <div className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 block">{tc('phone')}</span>
                  <span className="font-medium text-slate-800">{customer.phone}</span>
                </div>
              </div>
            )}
            {customer.email && (
              <div className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 block">{tc('email')}</span>
                  <span className="font-medium text-slate-800">{customer.email}</span>
                </div>
              </div>
            )}
            {customer.tin && (
              <div className="flex items-start gap-2.5">
                <Landmark className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 block">{tSales('tin')}</span>
                  <span className="font-medium text-slate-800">{customer.tin}</span>
                </div>
              </div>
            )}
            {customer.address && (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <span className="text-xs text-slate-400 block">{tc('address')}</span>
                  <span className="font-medium text-slate-800">{customer.address}</span>
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    className="block mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                  >
                    {lang === 'uz' ? "Xaritada ko'rish" : lang === 'ru' ? 'Показать на карте' : 'View on map'}
                  </button>
                </div>
              </div>
            )}
            {customer.notes && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400 block mb-1">{tc('description')}</span>
                <p className="text-slate-600 leading-relaxed text-xs">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Activity / Documents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="flex border-b overflow-x-auto">
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'orders' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <ShoppingCart className="h-4 w-4" />
                {lang === 'uz' ? 'Buyurtmalar' : lang === 'ru' ? 'Заказы' : 'Orders'}
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'invoices' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileText className="h-4 w-4" />
                {lang === 'uz' ? 'Hisob-fakturalar' : lang === 'ru' ? 'Счета' : 'Invoices'}
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'transactions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <History className="h-4 w-4" />
                {lang === 'uz' ? "To'lov tarixi" : lang === 'ru' ? 'История платежей' : 'Payment history'}
              </button>
            </div>

            <div className="p-0">
              {activeTab === 'orders' && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>{lang === 'uz' ? 'Sotuv kodi' : lang === 'ru' ? 'Код продажи' : 'Order #'}</TableHead>
                      <TableHead className="text-right">{tc('amount')}</TableHead>
                      <TableHead>{tc('status')}</TableHead>
                      <TableHead>{tc('date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      salesOrders.map((o, idx) => (
                        <TableRow key={o.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-900">{o.order_number}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(o.total_amount)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={ORDER_STATUS_TONES[o.status] ?? 'slate'} label={tSales(`status.${o.status}`)} />
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">{formatDate(o.order_date)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'invoices' && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>{lang === 'uz' ? 'Hisob-faktura' : lang === 'ru' ? 'Счёт' : 'Invoice #'}</TableHead>
                      <TableHead className="text-right">{tc('amount')}</TableHead>
                      <TableHead className="text-right">{lang === 'uz' ? "To'langan" : lang === 'ru' ? 'Оплачено' : 'Paid'}</TableHead>
                      <TableHead>{tc('status')}</TableHead>
                      <TableHead>{lang === 'uz' ? 'Muddat' : lang === 'ru' ? 'Срок' : 'Due'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoices.map((inv, idx) => (
                        <TableRow key={inv.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-900">{inv.invoice_number}</TableCell>
                          <TableCell className="text-right font-bold text-slate-800">{formatCurrency(inv.total_amount)}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">{formatCurrency(inv.paid_amount)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={INVOICE_STATUS_TONES[inv.status] ?? 'slate'} label={tSales(`status.${inv.status}`)} />
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">{formatDate(inv.due_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'transactions' && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>{lang === 'uz' ? 'Turi' : lang === 'ru' ? 'Тип' : 'Type'}</TableHead>
                      <TableHead>{lang === 'uz' ? 'Kategoriya' : lang === 'ru' ? 'Категория' : 'Category'}</TableHead>
                      <TableHead className="text-right">{tc('amount')}</TableHead>
                      <TableHead>{tc('date')}</TableHead>
                      <TableHead>{lang === 'uz' ? 'Izoh' : lang === 'ru' ? 'Примечание' : 'Note'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((tx, idx) => {
                        const isIncome = tx.type === 'income'
                        return (
                          <TableRow key={tx.id} className="hover:bg-slate-50/50">
                            <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                            <TableCell>
                              <StatusBadge
                                tone={isIncome ? 'emerald' : 'rose'}
                                label={isIncome ? (lang === 'uz' ? 'Kirim' : lang === 'ru' ? 'Приход' : 'Income') : (lang === 'uz' ? 'Chiqim' : lang === 'ru' ? 'Расход' : 'Expense')}
                              />
                            </TableCell>
                            <TableCell className="text-slate-700 text-xs">{tx.category}</TableCell>
                            <TableCell className={`text-right font-bold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                            </TableCell>
                            <TableCell className="text-slate-500 text-xs">{formatDate(tx.transaction_date)}</TableCell>
                            <TableCell className="text-slate-500 text-xs max-w-50 truncate">{tx.description || '—'}</TableCell>
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
