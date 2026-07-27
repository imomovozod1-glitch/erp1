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
      <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-emerald-700">{t('income')}</span>
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totalIncome)}</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-white">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-700">{t('expenses')}</span>
            <div className="p-1.5 bg-red-100 rounded-lg">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(totalExpenses)}</p>
        </CardContent>
      </Card>
      <Card className={`border-0 shadow-sm bg-gradient-to-br ${isPositive ? 'from-indigo-50 to-white' : 'from-orange-50 to-white'}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isPositive ? 'text-indigo-700' : 'text-orange-700'}`}>
              {t('balance')}
            </span>
            <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-indigo-100' : 'bg-orange-100'}`}>
              <Minus className={`h-4 w-4 ${isPositive ? 'text-indigo-600' : 'text-orange-600'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${isPositive ? 'text-indigo-700' : 'text-orange-700'}`}>
            {formatCurrency(balance)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
