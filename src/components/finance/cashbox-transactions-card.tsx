'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Calendar, Receipt, Search, TrendingUp } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDateTime } from '@/lib/utils'

interface Cashbox {
  id: string
  name: string
}

/**
 * The cashbox transaction history: one row per movement, with the period's
 * income and expense totalled in the footer.
 *
 * Split out of `cashbox-client.tsx` (1600 lines) because it is the one part of
 * that screen that only reads: the rows it renders are already filtered by
 * period in Postgres and by the search box here, and the only thing it can do
 * to them is hand one back for deletion.
 */
export function CashboxTransactionsCard({
  transactions,
  cashboxes,
  search,
  onSearchChange,
  lang,
}: {
  /** Already filtered — by period on the server, by `search` by the caller. */
  transactions: any[]
  cashboxes: Cashbox[]
  search: string
  onSearchChange: (value: string) => void
  lang: string
}) {
  const router = useRouter()
  const tCommon = useTranslations('common')
  const t = useTranslations('finance')

  return (
  <Card className="border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
    <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="space-y-1">
        <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          {t('transactions')}
        </CardTitle>
        <CardDescription className="text-xs">
          {lang === 'uz'
            ? "Kassalar bo'yicha kirim va chiqim operatsiyalari tarixi"
            : lang === 'ru'
            ? "История приходных и расходных операций по кассам"
            : "History of incoming and outgoing operations across cash registers"}
        </CardDescription>
      </div>
      <div className="relative max-w-xs w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={`${tCommon('search')}...`}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 border-slate-200 dark:border-slate-700 rounded-xl text-xs"
        />
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800">
              <th className="p-4 pl-6 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{tCommon('date')}</th>
              <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('cashbox')}</th>
              <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('category')}</th>
              <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{tCommon('description')}</th>
              <th className="p-4 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-right">
                {lang === 'uz' ? 'Kirim' : lang === 'ru' ? 'Приход' : 'Income'}
              </th>
              <th className="p-4 pr-6 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider text-right">
                {lang === 'uz' ? 'Chiqim' : lang === 'ru' ? 'Расход' : 'Expense'}
              </th>
              {/* No trailing actions column on purpose — there are no row
                  actions. Adding one here without a matching cell in every body
                  row skews the whole table, which is how it broke last time. */}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {/* No loading branch: the rows are rendered by the server, so the
                table is never mounted empty-and-waiting. */}
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col items-center gap-2 py-4">
                    <TrendingUp className="h-10 w-10 opacity-30 text-slate-400" />
                    <p className="text-sm font-semibold">{tCommon('noData')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const cbName = cashboxes.find(c => c.id === tx.reference_id)?.name || 'Kassa'
                const isIncome = tx.type === 'income'
                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    onClick={() => router.push(`/${lang}/finance/transactions/${tx.id}/edit`)}
                  >
                    <td className="p-4 pl-6 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{formatDateTime(tx.created_at)}</span>
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{cbName}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/30 dark:border-slate-700">
                        {tx.category}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">{tx.description || '—'}</td>
                    <td className="p-4 font-extrabold text-right text-base text-emerald-600 dark:text-emerald-400">
                      {isIncome ? formatCurrency(tx.amount) : '—'}
                    </td>
                    <td className="p-4 pr-6 font-extrabold text-right text-base text-rose-600 dark:text-rose-400">
                      {!isIncome ? formatCurrency(tx.amount) : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {transactions.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 font-bold">
                {/* The label spans the first four columns (date, cashbox, category,
                    description) so each total sits under its own header — a shorter
                    span plus a trailing filler cell shifted both one column left. */}
                <td className="p-4 pl-6" colSpan={4}>
                  {tCommon('total')}
                </td>
                <td className="p-4 text-right text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount), 0))}
                </td>
                <td className="p-4 pr-6 text-right text-rose-600 dark:text-rose-400">
                  {formatCurrency(transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount), 0))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </CardContent>
  </Card>
  )
}
