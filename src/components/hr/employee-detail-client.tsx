'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import {
  Download, DollarSign, ShoppingCart
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface EmployeeDetailClientProps {
  lang: string
  employee: any
  transactions: any[]
  salesOrders: any[]
}

export function EmployeeDetailClient({ lang, employee, transactions, salesOrders }: EmployeeDetailClientProps) {
  const t = useTranslations('hr')
  const tc = useTranslations('common')
  const [activeTab, setActiveTab] = useState<'payouts' | 'sales'>('payouts')

  // Calculate Tenure
  const hiredDate = new Date(employee.hired_at)
  const endDate = employee.is_active ? new Date() : new Date(employee.terminated_at || new Date())
  const diffTime = Math.abs(endDate.getTime() - hiredDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const tenureMonths = Math.floor(diffDays / 30)

  const totalSalesAmount = salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

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

        <div className="flex items-center gap-2">
          {employee.is_active ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {lang === 'uz' ? 'Ishlamoqda' : lang === 'ru' ? 'Работает' : 'Employed'}
            </Badge>
          ) : (
            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
              {lang === 'uz' ? 'Bo\'shatilgan' : lang === 'ru' ? 'Уволен' : 'Terminated'}
            </Badge>
          )}
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
            <span className="text-xs text-slate-400 mt-2">{salesOrders.length} {tc('rows')}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'To\'langan maoshlar' : 'Выплачено'}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {formatCurrency(transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0))}
            </h3>
            <span className="text-xs text-slate-400 mt-2">{transactions.length} {tc('rows')}</span>
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
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((tx, idx) => (
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
                    {salesOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      salesOrders.map((o, idx) => (
                        <TableRow key={o.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-900">{o.order_number}</TableCell>
                          <TableCell>{o.customers?.name ?? '—'}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(o.total_amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={o.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-650'}>
                              {o.status}
                            </Badge>
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
