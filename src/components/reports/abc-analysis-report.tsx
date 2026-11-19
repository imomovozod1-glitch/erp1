'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { AbcClassCards, AbcShareBar, summarise } from '@/components/reports/abc/abc-summary'
import { AbcTable } from '@/components/reports/abc/abc-table'
import { formatQty } from '@/components/reports/report-format'
import { ReportLayout, type ReportPeriod } from '@/components/reports/report-layout'
import { ABC_METRICS, classifyAbc, groupItems, inRange, type AbcMetric, type SalesItemRow } from '@/lib/reports/sales-analytics'
import { formatCurrency } from '@/lib/utils'

const METRIC_FORMAT: Record<AbcMetric, (value: number) => string> = {
  revenue: formatCurrency,
  profit: formatCurrency,
  quantity: formatQty,
}

function MetricPicker({ metric, onChange }: { metric: AbcMetric; onChange: (metric: AbcMetric) => void }) {
  const t = useTranslations('reports.abc')
  const options = ABC_METRICS.map((value) => ({ value, label: t(`metric.${value}`) }))
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-xs font-semibold text-muted-foreground">{t('metricLabel')}:</span>
      <SegmentedControl<AbcMetric> label={t('metricLabel')} value={metric} onChange={onChange} options={options} className="w-full sm:w-auto" />
    </div>
  )
}

function Body({ period, items }: { period: ReportPeriod; items: SalesItemRow[] }) {
  // Revenue first: it is the figure every other report here is already denominated in.
  const [metric, setMetric] = useState<AbcMetric>('revenue')
  const rows = useMemo(() => {
    const periodItems = items.filter((i) => inRange(i.order_date, period.range))
    return classifyAbc(groupItems(periodItems, (i) => i.product_id ?? i.product_name, (i) => i.product_name), metric)
  }, [items, period.range, metric])
  const summary = summarise(rows)
  const format = METRIC_FORMAT[metric]
  return (
    <>
      <MetricPicker metric={metric} onChange={setMetric} />
      <AbcClassCards summary={summary} format={format} />
      {rows.length > 0 && <AbcShareBar summary={summary} />}
      <AbcTable rows={rows} metric={metric} format={format} />
    </>
  )
}

/**
 * ABC analysis: pick the indicator (revenue, profit or units), rank by it, take each
 * share and the running share, cut at 80% / 95%. A cheap fast-mover is an A by units
 * and a C by profit, which is why the indicator is step one.
 */
export function AbcAnalysisReport({ lang, today, items }: { lang: string; today: string; items: SalesItemRow[] }) {
  const t = useTranslations('reports.cards.abc')
  return (
    <ReportLayout lang={lang} today={today} title={t('title')} info={t('desc')} storageKey="report_period_abc">
      {(period) => <Body period={period} items={items} />}
    </ReportLayout>
  )
}
