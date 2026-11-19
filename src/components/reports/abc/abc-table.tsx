'use client'

import { useTranslations } from 'next-intl'
import { ReportTable } from '@/components/reports/report-table'
import { formatQty } from '@/components/reports/report-format'
import type { AbcMetric, AbcRow } from '@/lib/reports/sales-analytics'
import { cn, formatCurrency } from '@/lib/utils'
import { ClassChip } from './abc-summary'

interface AbcTableProps {
  rows: AbcRow[]
  metric: AbcMetric
  format: (value: number) => string
}

// The ranked-by column is printed last and bold: it is the one the table is sorted and classified on.
export function AbcTable({ rows, metric, format }: AbcTableProps) {
  const t = useTranslations()
  return (
    <ReportTable
      title={t('reports.cards.abc.title')}
      rows={rows}
      rowKey={(row) => row.key}
      searchable
      searchPlaceholder={t('reports.searchProduct')}
      filterRow={(row, needle) => row.label.toLowerCase().includes(needle)}
      columns={[
        { key: 'rank', header: '#', className: 'w-10 text-muted-foreground', render: (_row, index) => index + 1 },
        { key: 'abc', header: t('reports.col.abcClass'), className: 'w-14', render: (row) => <ClassChip cls={row.abc} className="size-6 rounded-md text-xs" /> },
        { key: 'name', header: t('reports.col.product'), render: (row) => <span className="font-medium text-foreground">{row.label || t('common.noData')}</span> },
        { key: 'quantity', header: t('reports.col.quantity'), align: 'right', className: 'hidden md:table-cell', render: (row) => formatQty(row.quantity) },
        { key: 'revenue', header: t('reports.col.revenue'), align: 'right', className: 'hidden md:table-cell', render: (row) => formatCurrency(row.revenue) },
        {
          key: 'metric',
          header: t(`reports.abc.metric.${metric}`),
          align: 'right',
          render: (row) => <span className={cn('font-semibold', row.metricValue < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>{format(row.metricValue)}</span>,
        },
        { key: 'share', header: t('reports.col.share'), align: 'right', className: 'hidden sm:table-cell', render: (row) => `${row.metricShare.toFixed(1)}%` },
        { key: 'cumulative', header: t('reports.col.cumulativeShare'), align: 'right', render: (row) => <span className="text-muted-foreground">{row.cumulativeShare.toFixed(1)}%</span> },
      ]}
    />
  )
}
