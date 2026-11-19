'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ReportColumn } from '@/lib/reports/definitions'
import { cn } from '@/lib/utils'
import { useCellFormat } from './use-cell-format'
import type { ReportViewState } from './use-report-view'

const isNumeric = (column: ReportColumn) => column.type === 'money' || column.type === 'number'

// Phones scroll the table sideways; the first column stays pinned so each row keeps its name.
const pinned = (first: boolean, surface: string) => (first ? cn('max-md:sticky max-md:left-0 max-md:z-10', surface) : '')
const HEAD_SURFACE = 'max-md:bg-muted'
const BODY_SURFACE = 'max-md:bg-card'

function SortIcon({ direction }: { direction?: 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp className="size-3" />
  if (direction === 'desc') return <ArrowDown className="size-3" />
  return <ChevronsUpDown className="size-3 opacity-30" />
}

function HeaderCell({ column, first, view }: { column: ReportColumn; first: boolean; view: ReportViewState }) {
  const t = useTranslations('reports')
  const active = view.sort?.column === column.key
  return (
    <TableHead className={cn(isNumeric(column) && 'text-right tabular-nums', pinned(first, HEAD_SURFACE))}>
      <button
        type="button"
        onClick={() => view.toggleSort(column.key)}
        className={cn('inline-flex items-center gap-1 transition-colors hover:text-violet-600 dark:hover:text-violet-400', isNumeric(column) && 'flex-row-reverse', active && 'text-violet-600 dark:text-violet-400')}
      >
        {t(`col.${column.key}`)}
        <SortIcon direction={active ? view.sort?.direction : undefined} />
      </button>
    </TableHead>
  )
}

export function ReportResultTable({ view }: { view: ReportViewState }) {
  const t = useTranslations('common')
  const { format } = useCellFormat()
  const columns = view.visibleColumns
  const cellClass = (column: ReportColumn, index: number, surface: string) => cn(isNumeric(column) && 'text-right tabular-nums', pinned(index === 0, surface))
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {columns.map((column, index) => (
              <HeaderCell key={column.key} column={column} first={index === 0} view={view} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((column, index) => (
                <TableCell key={column.key} className={cellClass(column, index, BODY_SURFACE)}>
                  {format(row[column.key], column.type, column.key)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow className="bg-muted font-bold">
            {columns.map((column, index) => (
              <TableCell key={column.key} className={cellClass(column, index, HEAD_SURFACE)}>
                {index === 0 ? t('total') : column.key in view.totals ? format(view.totals[column.key], column.type) : ''}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
