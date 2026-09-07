'use client'

import { useTranslations } from 'next-intl'
import { DollarSign, MoreHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { TableSearch, TablePagination } from '@/components/shared/table-pagination'
import { useRouter } from 'next/navigation'

interface TransactionsTableProps {
  /** Only the current page's rows — the server applied search and paging. */
  transactions: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
  /** Totals across the whole filtered set, not just this page. */
  totalIncome: number
  totalExpense: number
}

export function TransactionsTable({
  transactions,
  lang,
  page,
  pageSize,
  total,
  totalPages,
  totalIncome,
  totalExpense,
}: TransactionsTableProps) {
  const t = useTranslations('finance')
  const tCommon = useTranslations('common')
  const router = useRouter()



  // No client-side filtering or slicing: `transactions` IS the current page.
  const paginated = transactions

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            <TableSearch />
          <span className="text-xs text-muted-foreground">{total} {tCommon('rows')}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-10 text-center font-semibold text-slate-500 dark:text-slate-400">#</TableHead>
              <TableHead>{tCommon('date')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('category')}</TableHead>
              <TableHead className="hidden lg:table-cell">{tCommon('description')}</TableHead>
              <TableHead className="text-right text-emerald-600 dark:text-emerald-400 tabular-nums">{t('incomeType')}</TableHead>
              <TableHead className="text-right text-rose-600 dark:text-rose-400 tabular-nums">{t('expenseType')}</TableHead>
              <TableHead className="w-17.5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((tx, index) => (
                <TableRow 
                  key={tx.id} 
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${lang}/finance/transactions/${tx.id}/edit`)}
                >
                  <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                    {(page - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(tx.created_at)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      {tx.category}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground max-w-50 truncate">
                    {tx.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {tx.type === 'income' ? formatCurrency(tx.amount) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                    {tx.type === 'expense' ? formatCurrency(tx.amount) : '—'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => router.push(`/${lang}/finance/transactions/${tx.id}/edit`)}>
                          {tCommon('edit')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {total > 0 && (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="font-bold">
                  {lang === 'uz' ? 'Jami' : lang === 'ru' ? 'Итого' : 'Total'}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(totalIncome)}
                </TableCell>
                <TableCell className="text-right font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                  {formatCurrency(totalExpense)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
      </CardContent>
    </Card>
  )
}
