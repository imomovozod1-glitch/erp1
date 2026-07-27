'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, DollarSign, TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface TransactionsTableProps {
  transactions: any[]
  lang: string
}

export function TransactionsTable({ transactions, lang }: TransactionsTableProps) {
  const t = useTranslations('finance')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = transactions.filter(
    (tx) =>
      (tx.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      tx.category.toLowerCase().includes(search.toLowerCase())
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
              <TableHead>{tCommon('date')}</TableHead>
              <TableHead>{t('type')}</TableHead>
              <TableHead>{t('category')}</TableHead>
              <TableHead>{tCommon('description')}</TableHead>
              <TableHead className="text-right">{tCommon('amount')}</TableHead>
              <TableHead className="w-17.5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-slate-50/50">
                  <TableCell className="text-muted-foreground">{formatDate(tx.transaction_date)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {tx.type === 'income' ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span className={`text-xs font-semibold uppercase ${tx.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {tx.type}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-slate-100 text-slate-700 font-medium">
                      {tx.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-50 truncate">
                    {tx.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold ${tx.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
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
        </Table>
      </CardContent>
    </Card>
  )
}
