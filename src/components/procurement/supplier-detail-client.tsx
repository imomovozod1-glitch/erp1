'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import {
  Download, Truck, Phone, Mail, Globe, MapPin, DollarSign, Landmark
} from 'lucide-react'
import * as XLSX from 'xlsx'

const PO_STATUS_TONES: Record<string, StatusTone> = {
  draft: 'blue',
  sent: 'blue',
  received: 'emerald',
  partially_received: 'blue',
  cancelled: 'rose',
}

interface SupplierDetailClientProps {
  lang: string
  supplier: any
  purchaseOrders: any[]
  transactions: any[]
}

export function SupplierDetailClient({ lang, supplier, purchaseOrders, transactions }: SupplierDetailClientProps) {
  const t = useTranslations('procurement')
  const tc = useTranslations('common')
  const [activeTab, setActiveTab] = useState<'purchases' | 'payments'>('purchases')

  // Calculate Metrics
  const totalPurchases = purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0)
  const totalPayments = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const outstandingDebt = totalPurchases - totalPayments

  // Export to Excel function
  const handleExport = () => {
    const workbook = XLSX.utils.book_new()

    // 1. Supplier Details Sheet
    const supplierData = [
      { [tc('name')]: supplier.name, Value: supplier.name },
      { [t('contactPerson')]: supplier.contact_person ?? '—', Value: supplier.contact_person ?? '—' },
      { [tc('email')]: supplier.email ?? '—', Value: supplier.email ?? '—' },
      { [tc('phone')]: supplier.phone ?? '—', Value: supplier.phone ?? '—' },
      { [t('tin')]: supplier.tin ?? '—', Value: supplier.tin ?? '—' },
      { [tc('address')]: supplier.address ?? '—', Value: supplier.address ?? '—' },
      { [tc('status')]: supplier.is_active ? tc('active') : tc('inactive'), Value: supplier.is_active ? tc('active') : tc('inactive') }
    ]
    const supplierWS = XLSX.utils.json_to_sheet(supplierData)
    XLSX.utils.book_append_sheet(workbook, supplierWS, "Supplier Profile")

    // 2. Purchase Orders Sheet
    const poData = purchaseOrders.map(po => ({
      PONumber: po.po_number,
      TotalCost: po.total_amount,
      Status: po.status,
      Notes: po.notes || '—',
      Date: formatDate(po.order_date)
    }))
    const poWS = XLSX.utils.json_to_sheet(poData)
    XLSX.utils.book_append_sheet(workbook, poWS, "Purchase Orders")

    // 3. Payments Sheet
    const paymentsData = transactions.map(tx => ({
      Category: tx.category,
      Amount: tx.amount,
      Description: tx.description || '—',
      Date: formatDate(tx.transaction_date)
    }))
    const paymentsWS = XLSX.utils.json_to_sheet(paymentsData)
    XLSX.utils.book_append_sheet(workbook, paymentsWS, "Payment History")

    XLSX.writeFile(workbook, `${supplier.name.replace(/\s+/g, '_')}_details.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Truck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{supplier.name}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {supplier.contact_person ? `${t('contactPerson')}: ${supplier.contact_person}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge tone={supplier.is_active ? 'emerald' : 'slate'} label={supplier.is_active ? tc('active') : tc('inactive')} />
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
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Jami xaridlar' : 'Всего закупок'}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatCurrency(totalPurchases)}</h3>
            <span className="text-xs text-slate-400 mt-2">{purchaseOrders.length} {t('purchaseOrders')}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Jami to\'lovlar' : 'Всего выплачено'}</span>
            <h3 className="text-2xl font-extrabold text-emerald-700 tracking-tight mt-1">{formatCurrency(totalPayments)}</h3>
            <span className="text-xs text-slate-400 mt-2">{transactions.length} {lang === 'uz' ? 'ta to\'lov' : 'выплат'}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Balans (Qarzimiz)' : 'Баланс (Долг)'}</span>
            <h3 className={`text-2xl font-extrabold tracking-tight mt-1 ${outstandingDebt > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {formatCurrency(outstandingDebt)}
            </h3>
            <span className="text-xs text-slate-400 mt-2">{t('tin')}: {supplier.tin || '—'}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{tc('status')}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {supplier.is_active ? (lang === 'uz' ? 'Faol' : 'Активен') : (lang === 'uz' ? 'Nofaol' : 'Неактивен')}
            </h3>
            <span className="text-xs text-slate-400 mt-2">{lang === 'uz' ? 'Kontakt' : 'Контакты'}: {supplier.phone || '—'}</span>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Profile Info & Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm self-start">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">{lang === 'uz' ? 'Hamkor ma\'lumotlari' : 'Профиль партнёра'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {supplier.phone && (
              <div className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-slate-450 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 block">{tc('phone')}</span>
                  <span className="font-medium text-slate-800">{supplier.phone}</span>
                </div>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-slate-450 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 block">{tc('email')}</span>
                  <span className="font-medium text-slate-800">{supplier.email}</span>
                </div>
              </div>
            )}
            {supplier.tin && (
              <div className="flex items-start gap-2.5">
                <Landmark className="h-4 w-4 text-slate-450 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 block">{t('tin')}</span>
                  <span className="font-medium text-slate-800">{supplier.tin}</span>
                </div>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-450 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 block">{tc('address')}</span>
                  <span className="font-medium text-slate-800">{supplier.address}</span>
                </div>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-start gap-2.5">
                <Globe className="h-4 w-4 text-slate-450 text-slate-400 mt-0.5" />
                <div>
                  <span className="text-xs text-slate-400 block">Website</span>
                  <a href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline text-xs break-all">
                    {supplier.website}
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Activity / Documents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="flex border-b overflow-x-auto">
              <button
                onClick={() => setActiveTab('purchases')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'purchases' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Truck className="h-4 w-4" />
                {lang === 'uz' ? 'Xarid buyurtmalari' : 'Заказы на закупку'}
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'payments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <DollarSign className="h-4 w-4" />
                {lang === 'uz' ? 'To\'lovlar tarixi' : 'История платежей'}
              </button>
            </div>

            <div className="p-0">
              {activeTab === 'purchases' && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
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
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseOrders.map((po, idx) => (
                        <TableRow key={po.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-900">{po.po_number}</TableCell>
                          <TableCell className="text-right font-bold text-rose-600">{formatCurrency(po.total_amount)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={PO_STATUS_TONES[po.status] ?? 'slate'} label={t(`status.${po.status}`)} />
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">{formatDate(po.order_date)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'payments' && (
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
