'use client'

import type { ComponentProps, ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MobileCard, MobileCardList } from '@/components/shared/mobile-list'
import { cn } from '@/lib/utils'

export interface ResponsiveColumn<T> {
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  align?: 'right'
  className?: string
  isolated?: boolean
}

interface ResponsiveTableProps<T> {
  rows: readonly T[]
  rowKey: (row: T, index: number) => string
  columns: ResponsiveColumn<T>[]
  card: (row: T, index: number) => ComponentProps<typeof MobileCard>
  numbered?: boolean
  indexOffset?: number
  onRowClick?: (row: T) => void
  empty?: ReactNode
}

export function ResponsiveTable<T>({ rows, rowKey, columns, card, numbered = true, indexOffset = 0, onRowClick, empty }: ResponsiveTableProps<T>) {
  const t = useTranslations('common')
  const emptyState = empty ?? <p className="py-10 text-center text-sm text-muted-foreground">{t('noData')}</p>
  const span = columns.length + (numbered ? 1 : 0)
  return (
    <>
      <MobileCardList className="p-3" isEmpty={rows.length === 0} empty={emptyState}>
        {rows.map((row, index) => (
          <MobileCard key={rowKey(row, index)} onClick={onRowClick && (() => onRowClick(row))} {...card(row, index)} />
        ))}
      </MobileCardList>
      <Table containerClassName="max-md:hidden">
        <TableHeader>
          <TableRow className="bg-muted/40">
            {numbered && <TableHead className="w-10 text-center">#</TableHead>}
            {columns.map((column) => (
              <TableHead key={column.key} className={cn(column.align === 'right' && 'text-right', column.className)}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={span}>{emptyState}</TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow
                key={rowKey(row, index)}
                onClick={onRowClick && (() => onRowClick(row))}
                className={cn(onRowClick && 'cursor-pointer transition-colors')}
              >
                {numbered && <TableCell className="text-center text-xs text-muted-foreground">{indexOffset + index + 1}</TableCell>}
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    onClick={column.isolated ? (e) => e.stopPropagation() : undefined}
                    className={cn(column.align === 'right' && 'text-right', column.className)}
                  >
                    {column.cell(row, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  )
}
