'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { formatNumber } from '@/lib/utils'

interface LowStockAlertProps {
  products: { id: string; name: string; sku: string; stock: number; min_stock: number }[]
  lang: string
}

export function LowStockAlert({ products, lang }: LowStockAlertProps) {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')

  if (products.length === 0) {
    return (
      <Card className="col-span-1 md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('lowStock')}</CardTitle>
          <CardDescription>{tCommon('noData')}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          {t('lowStock')}
        </CardTitle>
        <Link
          href={`/${lang}/inventory/products`}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          {tCommon('all')} →
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.map((product) => {
            const pct = Math.min((product.stock / product.min_stock) * 100, 100)
            const isOut = product.stock === 0
            return (
              <Link
                key={product.id}
                href={`/${lang}/inventory/products/${product.id}`}
                className="block group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 group-hover:text-indigo-600 transition-colors truncate max-w-[140px]">
                    {product.name}
                  </span>
                  <span
                    className={`text-xs font-bold ${isOut ? 'text-red-600' : 'text-orange-600'}`}
                  >
                    {formatNumber(product.stock)} / {formatNumber(product.min_stock)}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOut ? 'bg-red-500' : pct < 50 ? 'bg-orange-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
