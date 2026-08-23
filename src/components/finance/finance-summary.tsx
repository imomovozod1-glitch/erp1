'use client'

import { useTranslations } from 'next-intl'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface FinanceSummaryProps {
  totalIncome: number
  totalExpenses: number
}

export function FinanceSummary({ totalIncome, totalExpenses }: FinanceSummaryProps) {
  const t = useTranslations('finance')
  const balance = totalIncome - totalExpenses
  const isPositive = balance >= 0

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 dark:from-emerald-950/40 to-white dark:to-slate-900">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('income')}</span>
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalIncome)}</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 dark:from-red-950/40 to-white dark:to-slate-900">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-700 dark:text-red-400">{t('expenses')}</span>
            <div className="p-1.5 bg-red-100 dark:bg-red-950/60 rounded-lg">
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">{formatCurrency(totalExpenses)}</p>
        </CardContent>
      </Card>
      <Card className={`border-0 shadow-sm bg-gradient-to-br ${isPositive ? 'from-violet-50 dark:from-violet-950/40 to-white dark:to-slate-900' : 'from-orange-50 dark:from-orange-950/40 to-white dark:to-slate-900'}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isPositive ? 'text-violet-700 dark:text-violet-400' : 'text-orange-700 dark:text-orange-400'}`}>
              {t('balance')}
            </span>
            <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-violet-100 dark:bg-violet-950/60' : 'bg-orange-100 dark:bg-orange-950/60'}`}>
              <Minus className={`h-4 w-4 ${isPositive ? 'text-violet-600 dark:text-violet-400' : 'text-orange-600 dark:text-orange-400'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${isPositive ? 'text-violet-700 dark:text-violet-400' : 'text-orange-700 dark:text-orange-400'}`}>
            {formatCurrency(balance)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
