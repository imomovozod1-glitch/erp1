'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { Search, ArrowDownRight, ArrowUpRight, Settings2, Activity } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'

interface MovementsTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  movements: any[]
}

export function MovementsTable({ movements }: MovementsTableProps) {
  const t = useTranslations('inventory')
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')

  const filtered = movements.filter(
    (m) =>
      m.products?.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.reason?.toLowerCase().includes(search.toLowerCase())
  )

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in': return <ArrowDownRight className="h-4 w-4 text-emerald-600" />
      case 'out': return <ArrowUpRight className="h-4 w-4 text-red-600" />
      default: return <Settings2 className="h-4 w-4 text-orange-600" />
    }
  }

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'in': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t('stockIn')}</Badge>
      case 'out': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t('stockOut')}</Badge>
      default: return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{t('adjustment')}</Badge>
    }
  }

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
          <span className="text-xs text-muted-foreground">
            {filtered.length} {tCommon('rows')}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-[180px]">{tCommon('date')}</TableHead>
              <TableHead>{t('productName')}</TableHead>
              <TableHead>{tCommon('type')}</TableHead>
              <TableHead className="text-right">{t('quantity')}</TableHead>
              <TableHead className="text-right">{t('before')}</TableHead>
              <TableHead className="text-right">{t('after')}</TableHead>
              <TableHead>{tCommon('notes')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Activity className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((movement) => (
                <TableRow key={movement.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="text-sm text-slate-600">
                    {format(new Date(movement.created_at), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800">{movement.products?.name || '—'}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getMovementIcon(movement.type)}
                      {getMovementBadge(movement.type)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={movement.type === 'in' ? 'text-emerald-600' : movement.type === 'out' ? 'text-red-600' : 'text-orange-600'}>
                      {movement.type === 'in' ? '+' : movement.type === 'out' ? '-' : ''}{formatNumber(movement.quantity)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {formatNumber(movement.quantity_before)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(movement.quantity_after)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                      {movement.reason || '—'}
                    </span>
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
