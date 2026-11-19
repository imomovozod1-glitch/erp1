'use client'

import { useTranslations } from 'next-intl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { CHART_TYPES, type ChartType } from '@/components/reports/chart-types'
import { CheckList } from './report-shape-panels'
import type { ViewMode } from './saved-reports'
import type { ReportViewState } from './use-report-view'

function ChartControls({ view }: { view: ReportViewState }) {
  const t = useTranslations('reports')
  return (
    <div className="grid w-full grid-cols-2 items-center gap-2 md:flex md:w-auto md:flex-wrap">
      <Select value={view.chartType} onValueChange={(value) => view.setChartType(value as ChartType)}>
        <SelectTrigger className="h-10 w-full md:h-9 md:w-32">
          <SelectValue>{t(`chartType.${view.chartType}`)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CHART_TYPES.map((item) => (
            <SelectItem key={item} value={item}>
              {t(`chartType.${item}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={view.activeDimension} onValueChange={(value) => view.setDimension(value ?? '')}>
        <SelectTrigger className="h-10 w-full md:h-9 md:w-40">
          <SelectValue>{view.activeDimension ? t(`col.${view.activeDimension}`) : t('dimension')}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {view.dimensions.map((column) => (
            <SelectItem key={column.key} value={column.key}>
              {t(`col.${column.key}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ReportResultToolbar({ view }: { view: ReportViewState }) {
  const t = useTranslations('reports')
  const modes = [
    { value: 'table' as const, label: t('viewTable') },
    { value: 'chart' as const, label: t('viewChart') },
  ]
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <SegmentedControl<ViewMode> label={t('viewTable')} value={view.view} onChange={view.setView} options={modes} className="w-full sm:w-auto" />
        {view.view === 'chart' && <ChartControls view={view} />}
      </div>
      {view.view === 'chart' && view.numerics.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/30 px-4 py-2.5">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t('measures')}</span>
          <CheckList columns={view.numerics} checked={(key) => view.activeMeasures.includes(key)} onToggle={(key) => view.toggleMeasure(key)} />
        </div>
      )}
    </>
  )
}
