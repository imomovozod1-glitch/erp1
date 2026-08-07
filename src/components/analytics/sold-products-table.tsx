'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Search, BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface SoldProduct {
  name: string
  costPrice: number
  sellingPrice: number
  quantity: number
  totalSum: number
  profit: number
}

interface SoldProductsTableProps {
  products: SoldProduct[]
  lang: string
}

export function SoldProductsTable({ products, lang }: SoldProductsTableProps) {
  const t = useTranslations('analytics')
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [search])

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const totals = filtered.reduce(
    (acc, p) => ({
      quantity: acc.quantity + p.quantity,
      totalSum: acc.totalSum + p.totalSum,
      profit: acc.profit + p.profit,
    }),
    { quantity: 0, totalSum: 0, profit: 0 }
  )

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${tCommon('search')}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} {tCommon('rows')}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-10 text-center font-semibold text-slate-500">#</TableHead>
              <TableHead className="font-semibold">{t('productName')}</TableHead>
              <TableHead className="text-right">{t('costPrice')}</TableHead>
              <TableHead className="text-right">{t('sellingPrice')}</TableHead>
              <TableHead className="text-right">{t('quantitySold')}</TableHead>
              <TableHead className="text-right">{t('totalSum')}</TableHead>
              <TableHead className="text-right">{t('profit')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {filtered.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <BarChart3 className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{t('noSalesData')}</p>
                  </div>
                </TableCell>
              </TableRow>
             ) : (
               <>
                 {paginated.map((product, idx) => (
                   <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                     <TableCell className="text-center font-medium text-slate-500 text-xs">
                       {(currentPage - 1) * itemsPerPage + idx + 1}
                     </TableCell>
                    <TableCell className="font-medium text-slate-800">{product.name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(product.costPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.sellingPrice)}</TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(product.quantity)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(product.totalSum)}</TableCell>
                    <TableCell className="text-right">
                      <span className={product.profit >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {formatCurrency(product.profit)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                 {/* Totals row */}
                 <TableRow className="bg-slate-50 border-t-2 font-semibold">
                   <TableCell className="text-center text-xs">#</TableCell>
                   <TableCell>{tCommon('total')}</TableCell>
                   <TableCell />
                   <TableCell />
                  <TableCell className="text-right">{formatNumber(totals.quantity)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.totalSum)}</TableCell>
                  <TableCell className="text-right">
                    <span className={totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {formatCurrency(totals.profit)}
                    </span>
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="cursor-pointer"
            >
              {lang === 'uz' ? 'Orqaga' : lang === 'ru' ? 'Назад' : 'Previous'}
            </Button>
            <span className="text-xs text-muted-foreground font-medium">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="cursor-pointer"
            >
              {lang === 'uz' ? 'Oldinga' : lang === 'ru' ? 'Вперед' : 'Next'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
