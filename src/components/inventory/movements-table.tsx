'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowDownRight, ArrowUpRight, Settings2, Activity } from 'lucide-react'
import { formatNumber, formatDateTime } from '@/lib/utils'
import { translateMovementReason } from '@/lib/movement-reason'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { TableSearch, TablePagination } from '@/components/shared/table-pagination'

interface MovementsTableProps {
  /** Only the current page's rows — the server applied search and paging. */
  movements: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function MovementsTable({
  movements,
  lang,
  page,
  pageSize,
  total,
  totalPages,
}: MovementsTableProps) {
  const t = useTranslations('inventory')
  const tCommon = useTranslations('common')
  const router = useRouter()



  // No client-side filtering or slicing: `movements` IS the current page.
  const paginated = movements

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in': return <ArrowDownRight className="h-4 w-4 text-emerald-600" />
      case 'out': return <ArrowUpRight className="h-4 w-4 text-red-600" />
      default: return <Settings2 className="h-4 w-4 text-orange-600" />
    }
  }

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'in': return <Badge className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50">{t('stockIn')}</Badge>
      case 'out': return <Badge className="bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50">{t('stockOut')}</Badge>
      default: return <Badge className="bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/50">{t('adjustment')}</Badge>
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            <TableSearch />
          <span className="text-xs text-muted-foreground">
            {total} {tCommon('rows')}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-10 text-center font-semibold text-slate-500 dark:text-slate-400">#</TableHead>
              <TableHead className="w-[180px]">{tCommon('date')}</TableHead>
              <TableHead>{t('productName')}</TableHead>
              <TableHead>{tCommon('type')}</TableHead>
              <TableHead className="text-right tabular-nums">{t('quantity')}</TableHead>
              <TableHead className="hidden lg:table-cell text-right tabular-nums">{t('before')}</TableHead>
              <TableHead className="hidden md:table-cell text-right tabular-nums">{t('after')}</TableHead>
              <TableHead className="hidden lg:table-cell">{tCommon('notes')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Activity className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((movement, index) => (
                <TableRow
                  key={movement.id}
                  className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors ${movement.product_id ? 'cursor-pointer' : ''}`}
                  onClick={() => movement.product_id && router.push(`/${lang}/inventory/products/${movement.product_id}`)}
                >
                  <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                    {(page - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {formatDateTime(movement.created_at)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{movement.products?.name || '—'}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getMovementIcon(movement.type)}
                      {getMovementBadge(movement.type)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <span className={movement.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : movement.type === 'out' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}>
                      {movement.type === 'in' ? '+' : movement.type === 'out' ? '-' : ''}{formatNumber(movement.quantity)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right text-muted-foreground text-sm tabular-nums">
                    {formatNumber(movement.quantity_before)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right font-medium tabular-nums">
                    {formatNumber(movement.quantity_after)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                      {translateMovementReason(movement.reason, lang)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
      </CardContent>
    </Card>
  )
}
