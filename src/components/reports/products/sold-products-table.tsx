'use client'

import { useTranslations } from 'next-intl'
import { ReportTable } from '@/components/reports/report-table'
import { formatQty } from '@/components/reports/report-format'
import type { GroupRow } from '@/lib/reports/sales-analytics'
import { formatCurrency, formatNumber } from '@/lib/utils'

export function SoldProductsTable({ rows }: { rows: GroupRow[] }) {
  const t = useTranslations()
  return (
    <ReportTable
      title={t('reports.cards.products.title')}
      rows={rows}
      rowKey={(row) => row.key}
      searchable
      searchPlaceholder={t('reports.searchProduct')}
      filterRow={(row, needle) => row.label.toLowerCase().includes(needle)}
      columns={[
        { key: 'rank', header: '#', className: 'w-10 text-muted-foreground', render: (_row, index) => index + 1 },
        { key: 'name', header: t('reports.col.product'), render: (row) => <span className="font-medium text-foreground">{row.label || t('common.noData')}</span> },
        { key: 'quantity', header: t('reports.col.quantity'), align: 'right', render: (row) => formatQty(row.quantity) },
        { key: 'orders', header: t('reports.col.orders'), align: 'right', className: 'hidden md:table-cell', render: (row) => formatNumber(row.orders) },
        { key: 'cost', header: t('reports.col.cost'), align: 'right', className: 'hidden lg:table-cell', render: (row) => formatCurrency(row.cost) },
        { key: 'profit', header: t('reports.col.profit'), align: 'right', className: 'hidden md:table-cell', render: (row) => formatCurrency(row.profit) },
        { key: 'revenue', header: t('reports.col.revenue'), align: 'right', render: (row) => <span className="font-semibold text-foreground">{formatCurrency(row.revenue)}</span> },
      ]}
    />
  )
}
