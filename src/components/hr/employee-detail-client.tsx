'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { CustomDateRangePicker } from '@/components/shared/custom-date-range-picker'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import {
  Download, DollarSign, ShoppingCart, X
} from 'lucide-react'
import * as XLSX from 'xlsx'

type Period = 'all' | 'today' | 'week' | 'month' | 'custom'

const ORDER_STATUS_TONES: Record<string, StatusTone> = {
  draft: 'blue',
  pending: 'blue',
  confirmed: 'blue',
  shipped: 'blue',
  delivered: 'emerald',
  cancelled: 'rose',
}

interface EmployeeDetailClientProps {
  lang: string
  employee: any
  transactions: any[]
  salesOrders: any[]
}

export function EmployeeDetailClient({ lang, employee, transactions, salesOrders }: EmployeeDetailClientProps) {
  const t = useTranslations('hr')
  const tc = useTranslations('common')
  const tSales = useTranslations('sales')
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'payouts' | 'sales'>('payouts')
  const [period, setPeriod] = useState<Period>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Force a fresh server fetch on every visit — the browser's client-side
  // router cache can otherwise show a stale payout total right after a
  // salary was paid on the Cashbox page (Next.js reuses cached RSC payloads
  // on back/forward navigation regardless of server-side cache invalidation).
  useEffect(() => {
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApplyCustomRange = (start: string, end: string) => {
    setCustomStart(start)
    setCustomEnd(end)
    setPeriod('custom')
  }

  const periodLabels: Record<Exclude<Period, 'custom'>, string> = {
    all: lang === 'uz' ? 'Barchasi' : lang === 'ru' ? 'Все время' : 'All time',
    today: lang === 'uz' ? 'Bugun' : lang === 'ru' ? 'Сегодня' : 'Today',
    week: lang === 'uz' ? 'Bu hafta' : lang === 'ru' ? 'Эта неделя' : 'This week',
    month: lang === 'uz' ? 'Bu oy' : lang === 'ru' ? 'Этот месяц' : 'This month',
  }

  const [now] = useState(() => new Date())
  const todayStr = now.toISOString().split('T')[0]
  const oneDayMs = 24 * 60 * 60 * 1000
  const weekAgo = new Date(now.getTime() - 7 * oneDayMs)
  const monthAgo = new Date(now.getTime() - 30 * oneDayMs)
  const customStartDate = customStart ? new Date(customStart) : null
  const customEndDate = customEnd ? new Date(customEnd) : null

  const isWithinPeriod = (dateStr?: string | null) => {
    if (!dateStr) return false
    if (period === 'all') return true
    if (period === 'today') return dateStr.split('T')[0] === todayStr
    const d = new Date(dateStr)
    if (period === 'week') return d >= weekAgo
    if (period === 'month') return d >= monthAgo
    if (period === 'custom') {
      return (!customStartDate || d >= customStartDate) && (!customEndDate || d <= customEndDate)
    }
    return true
  }

  const filteredTransactions = transactions.filter((tx) => isWithinPeriod(tx.transaction_date))
  const filteredSalesOrders = salesOrders.filter((o) => isWithinPeriod(o.order_date))

  // Calculate Tenure
  const hiredDate = new Date(employee.hired_at)
  const endDate = employee.is_active ? new Date() : new Date(employee.terminated_at || new Date())
  const diffTime = Math.abs(endDate.getTime() - hiredDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const tenureMonths = Math.floor(diffDays / 30)

  const totalSalesAmount = filteredSalesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const totalPaidAmount = filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const activePeriodLabel = period === 'custom'
    ? (lang === 'uz' ? 'Tanlangan davr' : lang === 'ru' ? 'Выбранный период' : 'Selected period')
    : periodLabels[period]
  const periodSuffix = period !== 'all' ? ` · ${activePeriodLabel}` : ''

  // Export to Excel function
  const handleExport = () => {
    const workbook = XLSX.utils.book_new()

    // 1. Profile Info Sheet
    const profileData = [
      { Parameter: tc('name'), Value: employee.profiles?.full_name ?? '—' },
      { Parameter: tc('email'), Value: employee.profiles?.email ?? '—' },
      { Parameter: t('employeeCode'), Value: employee.employee_code },
      { Parameter: t('position'), Value: employee.position },
      { Parameter: t('department'), Value: employee.profiles?.departments?.name ?? '—' },
      { Parameter: t('salary'), Value: formatCurrency(employee.salary) },
      { Parameter: t('hiredAt'), Value: formatDate(employee.hired_at) },
      { Parameter: tc('status'), Value: employee.is_active ? (lang === 'uz' ? 'Ishlamoqda' : 'Работает') : (lang === 'uz' ? 'Bo\'shatilgan' : 'Уволен') }
    ]
    if (!employee.is_active && employee.terminated_at) {
      profileData.push({ Parameter: t('terminatedAt') || 'Bo\'shatilgan sana', Value: formatDate(employee.terminated_at) })
    }
    const profileWS = XLSX.utils.json_to_sheet(profileData)
    XLSX.utils.book_append_sheet(workbook, profileWS, "Profile Info")

    // 2. Payouts Sheet
    const payoutsData = transactions.map(tx => ({
      Category: tx.category,
      Amount: tx.amount,
      Description: tx.description || '—',
      Date: formatDate(tx.transaction_date)
    }))
    const payoutsWS = XLSX.utils.json_to_sheet(payoutsData)
    XLSX.utils.book_append_sheet(workbook, payoutsWS, "Payout History")

    // 3. Sales Sheet
    const salesData = salesOrders.map(o => ({
      OrderNumber: o.order_number,
      Customer: o.customers?.name ?? '—',
      TotalAmount: o.total_amount,
      Status: o.status,
      Date: formatDate(o.order_date)
    }))
    const salesWS = XLSX.utils.json_to_sheet(salesData)
    XLSX.utils.book_append_sheet(workbook, salesWS, "Processed Sales")

    XLSX.writeFile(workbook, `${(employee.profiles?.full_name ?? 'employee').replace(/\s+/g, '_')}_details.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-lg font-bold">
              {employee.profiles?.full_name?.[0] ?? 'E'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{employee.profiles?.full_name ?? '—'}</h1>
            <p className="text-xs text-slate-500 font-mono mt-1">{employee.position} &bull; {employee.profiles?.departments?.name ?? '—'}</p>
          </div>
        </div>

        {/* Period Filter — drives salary/payout & sales figures below */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 shadow-inner border">
            {(['all', 'today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                  period === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
          <CustomDateRangePicker
            isActive={period === 'custom'}
            start={customStart}
            end={customEnd}
            onApply={handleApplyCustomRange}
          />
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge
            tone={employee.is_active ? 'emerald' : 'rose'}
            pulse={employee.is_active}
            label={employee.is_active
              ? (lang === 'uz' ? 'Ishlamoqda' : lang === 'ru' ? 'Работает' : 'Employed')
              : (lang === 'uz' ? "Bo'shatilgan" : lang === 'ru' ? 'Уволен' : 'Terminated')}
          />
          <Button onClick={handleExport} size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-medium">
            <Download className="h-4 w-4" />
            {tc('export') || 'Eksport'}
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{t('salary')}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatCurrency(employee.salary)}</h3>
            <span className="text-xs text-slate-400 mt-2">{t('employeeCode')}: {employee.employee_code}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Ishlagan davri' : 'Срок службы'}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {tenureMonths} {lang === 'uz' ? 'oy' : 'мес.'}
            </h3>
            <span className="text-xs text-slate-400 mt-2">{t('hiredAt')}: {formatDate(employee.hired_at)}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Rasmiylashtirgan savdolar' : 'Оформленные продажи'}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatCurrency(totalSalesAmount)}</h3>
            <span className="text-xs text-slate-400 mt-2">{filteredSalesOrders.length} {tc('count') || 'count'}{periodSuffix}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'To\'langan maoshlar' : 'Выплачено'}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {formatCurrency(totalPaidAmount)}
            </h3>
            <span className="text-xs text-slate-400 mt-2">{filteredTransactions.length} {tc('count') || 'count'}{periodSuffix}</span>
          </CardContent>
        </Card>
      </div>

      {/* Profile Details & Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm self-start">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">{lang === 'uz' ? 'Kadr ma\'lumotlari' : 'Личное дело'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">{tc('email')}</span>
              <span className="font-medium text-slate-800">{employee.profiles?.email ?? '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">{t('department')}</span>
              <span className="font-medium text-slate-800">{employee.profiles?.departments?.name ?? '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">{t('hiredAt')}</span>
              <span className="font-medium text-slate-800">{formatDate(employee.hired_at)}</span>
            </div>
            {!employee.is_active && employee.terminated_at && (
              <div>
                <span className="text-xs text-rose-500 block font-semibold">{t('terminatedAt') || 'Bo\'shatilgan sana'}</span>
                <span className="font-bold text-rose-600">{formatDate(employee.terminated_at)}</span>
              </div>
            )}
            {employee.notes && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400 block mb-1">{tc('description')}</span>
                <p className="text-slate-600 leading-relaxed text-xs">{employee.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Activity / Documents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="flex border-b overflow-x-auto">
              <button
                onClick={() => setActiveTab('payouts')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'payouts' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <DollarSign className="h-4 w-4" />
                {lang === 'uz' ? 'To\'lovlar tarixi' : 'История выплат'}
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'sales' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <ShoppingCart className="h-4 w-4" />
                {lang === 'uz' ? 'Sotuvlar ro\'yxati' : 'Список продаж'}
              </button>
            </div>

            <div className="p-0">
              {activeTab === 'payouts' && (
                <>
                  <div className="flex flex-wrap items-center gap-3 p-4 border-b bg-slate-50/30">
                    <span className="text-xs text-slate-500 font-medium">
                      {lang === 'uz' ? 'Davr' : lang === 'ru' ? 'Период' : 'Period'}:{' '}
                      <span className="font-semibold text-slate-700">{activePeriodLabel}</span>
                    </span>
                    {period !== 'all' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setPeriod('all'); setCustomStart(''); setCustomEnd('') }}
                        className="h-7 px-2 text-xs text-slate-500 gap-1"
                      >
                        <X className="h-3.5 w-3.5" />
                        {lang === 'uz' ? 'Tozalash' : lang === 'ru' ? 'Сбросить' : 'Clear'}
                      </Button>
                    )}
                    <div className="ml-auto text-xs text-slate-500 font-medium">
                      {lang === 'uz' ? 'Jami' : lang === 'ru' ? 'Итого' : 'Total'}:{' '}
                      <span className="font-bold text-rose-600">
                        {formatCurrency(totalPaidAmount)}
                      </span>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="w-10 text-center">#</TableHead>
                        <TableHead>{lang === 'uz' ? 'Kategoriya' : 'Категория'}</TableHead>
                        <TableHead className="text-right">{tc('amount')}</TableHead>
                        <TableHead>{lang === 'uz' ? 'Izoh' : 'Комментарий'}</TableHead>
                        <TableHead>{tc('date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                            {tc('noData')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransactions.map((tx, idx) => (
                          <TableRow key={tx.id} className="hover:bg-slate-50/50">
                            <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                            <TableCell className="font-semibold text-slate-800">
                              {tx.category}
                            </TableCell>
                            <TableCell className="text-right font-bold text-rose-600">
                              -{formatCurrency(tx.amount)}
                            </TableCell>
                            <TableCell className="text-slate-600 text-sm">{tx.description || '—'}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{formatDate(tx.transaction_date)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </>
              )}

              {activeTab === 'sales' && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>{lang === 'uz' ? 'Sotuv kodi' : 'Код продажи'}</TableHead>
                      <TableHead>{lang === 'uz' ? 'Mijoz' : 'Клиент'}</TableHead>
                      <TableHead className="text-right">{tc('amount')}</TableHead>
                      <TableHead>{tc('status')}</TableHead>
                      <TableHead>{tc('date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSalesOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSalesOrders.map((o, idx) => (
                        <TableRow key={o.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-900">{o.order_number}</TableCell>
                          <TableCell>{o.customers?.name ?? '—'}</TableCell>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
