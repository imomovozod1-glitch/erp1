'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ReportTable } from '@/components/reports/report-table'
import { formatQty } from '@/components/reports/report-format'
import type { SlowMoverRow } from '@/lib/reports/sales-analytics'
import { formatCurrency } from '@/lib/utils'

/** How many units still counts as "barely moving" in the period. */
export const MOVEMENT_THRESHOLDS = ['0', '3', '10'] as const
export type MovementThreshold = (typeof MOVEMENT_THRESHOLDS)[number]

interface SlowMoversProps {
  rows: SlowMoverRow[]
  threshold: MovementThreshold
  onThreshold: (value: MovementThreshold) => void
  includeOutOfStock: boolean
  onIncludeOutOfStock: (value: boolean) => void
}

function SlowMoverControls({ threshold, onThreshold, includeOutOfStock, onIncludeOutOfStock }: Omit<SlowMoversProps, 'rows'>) {
  const t = useTranslations('reports.slowMovers')
  const options = MOVEMENT_THRESHOLDS.map((value) => ({ value, label: value === '0' ? t('neverSold') : t('upToUnits', { count: Number(value) }) }))
  return (
    <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
      <SegmentedControl<MovementThreshold> label={t('title')} value={threshold} onChange={onThreshold} options={options} className="w-full sm:w-auto" />
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
        <Checkbox checked={includeOutOfStock} onCheckedChange={(on) => onIncludeOutOfStock(on === true)} />
        {t('includeOutOfStock')}
      </label>
    </div>
  )
}

function LastSale({ days }: { days: number | null }) {
  const t = useTranslations('reports.slowMovers')
  if (days === null) return <span className="text-amber-600 dark:text-amber-400">{t('neverSoldShort')}</span>
  return <>{t('daysAgo', { count: days })}</>
}

/** Money stuck in products nobody buys — invisible until something goes looking for it. */
export function SlowMoversSection({ rows, ...controls }: SlowMoversProps) {
  const t = useTranslations('reports')
  const tiedUp = rows.reduce((sum, row) => sum + row.tiedUpValue, 0)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('slowMovers.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('slowMovers.desc')}</p>
        </div>
        <SlowMoverControls {...controls} />
      </div>
      <ReportTable
        rows={rows}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder={t('searchProduct')}
        filterRow={(row, needle) => row.name.toLowerCase().includes(needle) || row.sku.toLowerCase().includes(needle)}
        columns={[
          {
            key: 'name',
            header: t('col.product'),
            render: (row) => (
              <div>
                <p className="font-medium text-foreground">{row.name}</p>
                <p className="text-[11px] text-muted-foreground">{row.sku}</p>
              </div>
            ),
          },
          { key: 'stock', header: t('col.stock'), align: 'right', render: (row) => formatQty(row.stock) },
          { key: 'sold', header: t('slowMovers.soldInPeriod'), align: 'right', className: 'hidden sm:table-cell', render: (row) => formatQty(row.quantity) },
          { key: 'lastSale', header: t('slowMovers.lastSale'), align: 'right', className: 'hidden md:table-cell', render: (row) => <LastSale days={row.daysSinceLastSale} /> },
          { key: 'tiedUp', header: t('slowMovers.tiedUpValue'), align: 'right', render: (row) => <span className="font-semibold text-foreground">{formatCurrency(row.tiedUpValue)}</span> },
        ]}
        footer={
          rows.length > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs">
              <span className="text-muted-foreground">{t('slowMovers.totalTiedUp')}</span>
              <span className="font-semibold text-foreground tabular-nums">{formatCurrency(tiedUp)}</span>
            </div>
          )
        }
      />
    </div>
  )
}
