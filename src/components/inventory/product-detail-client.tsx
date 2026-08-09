'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import {
  TrendingUp, Download, Package, RefreshCw, ShoppingCart, Truck
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface ProductDetailClientProps {
  lang: string
  product: any
  movements: any[]
  sales: any[]
  purchases: any[]
}

export function ProductDetailClient({ lang, product, movements, sales, purchases }: ProductDetailClientProps) {
  const t = useTranslations('inventory')
  const tc = useTranslations('common')
  const [activeTab, setActiveTab] = useState<'movements' | 'sales' | 'purchases'>('movements')

  const profitMarginPercent = product.price > 0 
    ? ((product.price - product.cost_price) / product.price * 100).toFixed(1) 
    : '0'
  const totalValuation = product.stock * product.cost_price

  // Export to Excel function
  const handleExport = () => {
    const workbook = XLSX.utils.book_new()

    // 1. Product Info Sheet
    const infoData = [
      { [tc('name')]: product.name, Value: product.name },
      { SKU: product.sku, Value: product.sku },
      { [t('category')]: product.categories?.name ?? '—', Value: product.categories?.name ?? '—' },
      { [t('costPrice')]: product.cost_price, Value: formatCurrency(product.cost_price) },
      { [t('price')]: product.price, Value: formatCurrency(product.price) },
      { [t('stock')]: product.stock, Value: `${formatNumber(product.stock)} ${product.unit}` },
      { [tc('status')]: product.is_active ? tc('active') : tc('inactive'), Value: product.is_active ? tc('active') : tc('inactive') }
    ]
    const infoWS = XLSX.utils.json_to_sheet(infoData)
    XLSX.utils.book_append_sheet(workbook, infoWS, "General Info")

    // 2. Movements Sheet
    const movementsData = movements.map(m => ({
      Type: m.type === 'incoming' ? (lang === 'uz' ? 'Kirim' : 'Приход') : (lang === 'uz' ? 'Chiqim' : 'Расход'),
      Quantity: m.quantity,
      Before: m.quantity_before,
      After: m.quantity_after,
      Reason: m.reason || '—',
      Date: formatDate(m.created_at)
    }))
    const movementsWS = XLSX.utils.json_to_sheet(movementsData)
    XLSX.utils.book_append_sheet(workbook, movementsWS, "Movements")

    // 3. Sales Sheet
    const salesData = sales.map(s => ({
      OrderNumber: s.sales_orders?.order_number ?? '—',
      Customer: s.sales_orders?.customers?.name ?? '—',
      Quantity: s.quantity,
      TotalPrice: s.total_price,
      Date: s.sales_orders?.order_date ? formatDate(s.sales_orders.order_date) : '—'
    }))
    const salesWS = XLSX.utils.json_to_sheet(salesData)
    XLSX.utils.book_append_sheet(workbook, salesWS, "Sales")

    // 4. Purchases Sheet
    const purchasesData = purchases.map(p => ({
      PONumber: p.purchase_orders?.po_number ?? '—',
      Supplier: p.purchase_orders?.suppliers?.name ?? '—',
      Quantity: p.quantity,
      TotalCost: p.total_cost,
      Date: p.purchase_orders?.order_date ? formatDate(p.purchase_orders.order_date) : '—'
    }))
    const purchasesWS = XLSX.utils.json_to_sheet(purchasesData)
    XLSX.utils.book_append_sheet(workbook, purchasesWS, "Purchases")

    XLSX.writeFile(workbook, `${product.name.replace(/\s+/g, '_')}_details_report.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Package className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{product.name}</h1>
            <p className="text-xs text-slate-500 font-mono mt-1">SKU: {product.sku}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={product.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-700"}>
            {product.is_active ? tc('active') : tc('inactive')}
          </Badge>
          <Button onClick={handleExport} size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-medium">
            <Download className="h-4 w-4" />
            {tc('export') || 'Eksport'}
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm relative overflow-hidden">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{t('costPrice')}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatCurrency(product.cost_price)}</h3>
            <span className="text-xs text-slate-400 mt-2">{t('incomingCost', { fallback: 'Kirim narxi' })}: {formatCurrency(product.incoming_cost || product.cost_price)}</span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{t('price')}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatCurrency(product.price)}</h3>
            <span className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {lang === 'uz' ? 'Foyda marjasi' : 'Маржа'}: {profitMarginPercent}%
            </span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{t('stock')}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {formatNumber(product.stock)} {product.unit}
            </h3>
            <span className={`text-xs font-semibold mt-2 ${product.stock <= product.min_stock ? 'text-orange-600' : 'text-slate-400'}`}>
              {lang === 'uz' ? 'Minimal limit' : 'Мин. запас'}: {formatNumber(product.min_stock)} {product.unit}
            </span>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Zaxira qiymati' : 'Стоимость запасов'}</span>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatCurrency(totalValuation)}</h3>
            <span className="text-xs text-slate-400 mt-2">{t('category')}: {product.categories?.name ?? '—'}</span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs list */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'movements' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <RefreshCw className="h-4 w-4" />
            {lang === 'uz' ? 'Harakatlar tarixi' : 'История движений'}
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'sales' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            {lang === 'uz' ? 'Sotuvlar tarixi' : 'История продаж'}
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'purchases' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Truck className="h-4 w-4" />
            {lang === 'uz' ? 'Xaridlar tarixi' : 'История закупок'}
          </button>
        </div>

        <div className="p-0">
          {activeTab === 'movements' && (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>{lang === 'uz' ? 'Harakat turi' : 'Тип движения'}</TableHead>
                  <TableHead className="text-right">{lang === 'uz' ? 'Miqdor' : 'Количество'}</TableHead>
                  <TableHead className="text-right">{lang === 'uz' ? 'Avval' : 'До'}</TableHead>
                  <TableHead className="text-right">{lang === 'uz' ? 'Keyin' : 'После'}</TableHead>
                  <TableHead>{lang === 'uz' ? 'Qayerdan (Manba)' : 'Источник'}</TableHead>
                  <TableHead>{lang === 'uz' ? 'Sabab' : 'Причина'}</TableHead>
                  <TableHead>{tc('date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      {tc('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((m, idx) => (
                    <TableRow key={m.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          m.type === 'incoming' || m.type === 'in'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {m.type === 'incoming' || m.type === 'in' ? (lang === 'uz' ? 'Kirim' : 'Приход') : (lang === 'uz' ? 'Chiqim' : 'Расход')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {m.type === 'incoming' || m.type === 'in' ? '+' : '-'}{formatNumber(m.quantity)}
                      </TableCell>
                      <TableCell className="text-right text-slate-500">{formatNumber(m.quantity_before)}</TableCell>
                      <TableCell className="text-right text-slate-700 font-medium">{formatNumber(m.quantity_after)}</TableCell>
                      <TableCell className="text-sm">
                        {m.source?.type === 'purchase_order' ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-700">
                            <Truck className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-medium">{m.source.label}</span>
                            {m.source.supplierOrCustomer && <span className="text-slate-400">· {m.source.supplierOrCustomer}</span>}
                          </span>
                        ) : m.source?.type === 'sales_orders' ? (
                          <span className="inline-flex items-center gap-1.5 text-indigo-700">
                            <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-medium">{m.source.label}</span>
                            {m.source.supplierOrCustomer && <span className="text-slate-400">· {m.source.supplierOrCustomer}</span>}
                          </span>
                        ) : m.source?.type === 'initial_stock' ? (
                          <span className="text-slate-500">{lang === 'uz' ? "Boshlang'ich zaxira" : 'Начальный запас'}</span>
                        ) : m.source?.type === 'product_adjustment' ? (
                          <span className="text-slate-500">{lang === 'uz' ? "Qo'lda tuzatish" : 'Ручная корректировка'}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">{m.reason || '—'}</TableCell>
                      <TableCell className="text-slate-500 text-xs">{formatDate(m.created_at)}</TableCell>
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
                  <TableHead>{lang === 'uz' ? 'Buyurtma raqami' : 'Номер заказа'}</TableHead>
                  <TableHead>{lang === 'uz' ? 'Mijoz' : 'Клиент'}</TableHead>
                  <TableHead className="text-right">{lang === 'uz' ? 'Soni' : 'Кол-во'}</TableHead>
                  <TableHead className="text-right">{tc('amount')}</TableHead>
                  <TableHead>{tc('date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                      {tc('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((s, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50">
                      <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{s.sales_orders?.order_number ?? '—'}</TableCell>
                      <TableCell>{s.sales_orders?.customers?.name ?? '—'}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(s.quantity)}</TableCell>
                      <TableCell className="text-right font-bold text-slate-900">{formatCurrency(s.total_price)}</TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {s.sales_orders?.order_date ? formatDate(s.sales_orders.order_date) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {activeTab === 'purchases' && (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>{lang === 'uz' ? 'Xarid kodi' : 'Код закупки'}</TableHead>
                  <TableHead>{lang === 'uz' ? 'Yetkazib beruvchi' : 'Поставщик'}</TableHead>
                  <TableHead className="text-right">{lang === 'uz' ? 'Soni' : 'Кол-во'}</TableHead>
                  <TableHead className="text-right">{tc('amount')}</TableHead>
                  <TableHead>{tc('date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                      {tc('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  purchases.map((p, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50">
                      <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{p.purchase_orders?.po_number ?? '—'}</TableCell>
                      <TableCell>{p.purchase_orders?.suppliers?.name ?? '—'}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(p.quantity)}</TableCell>
                      <TableCell className="text-right font-bold text-slate-900">{formatCurrency(p.total_cost)}</TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {p.purchase_orders?.order_date ? formatDate(p.purchase_orders.order_date) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
