'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useCan } from '@/components/providers/permissions-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { ReportFilters } from '@/components/reports/report-filters'
import { ReportActions, ReportQueryFields } from '@/components/reports/builder/report-query-card'
import { ReportResultTable } from '@/components/reports/builder/report-result-table'
import { ReportResultToolbar } from '@/components/reports/builder/report-result-toolbar'
import { ColumnPicker, SavedReportChips, SaveReportDialog } from '@/components/reports/builder/report-shape-panels'
import { readSaved, writeSaved, type SavedReport } from '@/components/reports/builder/saved-reports'
import { useCellFormat } from '@/components/reports/builder/use-cell-format'
import { useReportQuery, type ReportQueryState } from '@/components/reports/builder/use-report-query'
import { useReportView, type ReportViewState } from '@/components/reports/builder/use-report-view'
import { exportRowsToExcel } from '@/lib/excel-io'
import type { ReportSource } from '@/lib/reports/definitions'

// recharts loads only once the chart view is opened.
const ReportChart = dynamic(() => import('@/components/reports/report-chart').then((m) => m.ReportChart), {
  ssr: false,
  loading: () => <Skeleton className="m-4 h-[360px] rounded-xl" />,
})

function useSavedReports() {
  const [saved, setSaved] = useState<SavedReport[]>([])
  useEffect(() => {
    const timer = setTimeout(() => setSaved(readSaved()), 0)
    return () => clearTimeout(timer)
  }, [])
  const persist = (next: SavedReport[]) => {
    setSaved(next)
    writeSaved(next)
  }
  return {
    saved,
    upsert: (entry: SavedReport) => persist([...saved.filter((item) => item.name !== entry.name), entry]),
    remove: (name: string) => persist(saved.filter((item) => item.name !== name)),
  }
}

function useExport(query: ReportQueryState, view: ReportViewState, today: string) {
  const t = useTranslations('reports')
  const { typeLabel } = useCellFormat()
  return async () => {
    if (view.rows.length === 0) return
    const columns = view.visibleColumns.map((column) => ({ header: t(`col.${column.key}`), key: column.key }))
    const stamp = query.isDated ? `${query.query.from}_${query.query.to}` : today
    const rows = view.rows.map((row) => ('type' in row ? { ...row, type: typeLabel(row.type) } : row))
    await exportRowsToExcel(rows, columns, `${t(`source.${query.query.source}`)}_${stamp}.xlsx`, t('title'))
  }
}

function EmptyResult({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
      <BarChart3 className="size-8 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

function ReportResult({ query, view }: { query: ReportQueryState; view: ReportViewState }) {
  const t = useTranslations()
  const result = query.result
  if (!result) return <EmptyResult text={t('reports.emptyState')} />
  const chart = view.view === 'chart'
  return (
    <>
      <ReportResultToolbar view={view} />
      {view.rows.length === 0 ? (
        <EmptyResult text={t('common.noData')} />
      ) : chart ? (
        <ReportChart
          columns={view.columns}
          rows={view.rows}
          chartType={view.chartType}
          dimension={view.activeDimension}
          measures={view.chartType === 'pie' ? view.activeMeasures.slice(0, 1) : view.activeMeasures}
        />
      ) : (
        <ReportResultTable view={view} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs text-muted-foreground">
        <span>{view.hasActiveFilters ? t('reports.filteredRows', { shown: view.rows.length, total: result.rows.length }) : `${view.rows.length} ${t('common.rows')}`}</span>
        {result.truncated && <span className="text-amber-600 dark:text-amber-400">{t(view.hasActiveFilters ? 'reports.filterAfterCap' : 'reports.truncated')}</span>}
      </div>
    </>
  )
}

/**
 * The custom report builder: pick a source, period and grouping, run it on the server
 * (permission and data scope apply there), then shape the rows in the browser.
 */
export function ReportBuilder({ today }: { today: string }) {
  const t = useTranslations('reports')
  const canExport = useCan('analytics', 'export', 'builder')
  const [confirmDelete, confirmDialog] = useConfirmDelete()
  const query = useReportQuery(today)
  const view = useReportView(query.result)
  const reports = useSavedReports()
  const [saving, setSaving] = useState(false)
  const exportRows = useExport(query, view, today)

  const changeSource = (source: ReportSource) => {
    query.changeSource(source)
    view.reset()
  }
  const save = (name: string) => {
    reports.upsert({ name, ...query.query, ...view.snapshot() })
    setSaving(false)
    toast.success(t('saved'))
  }
  const load = (entry: SavedReport) => {
    view.apply(entry)
    query.load(entry)
  }
  const remove = async (entry: SavedReport) => {
    if (await confirmDelete({ name: entry.name })) reports.remove(entry.name)
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <ReportQueryFields state={query} today={today} onSourceChange={changeSource} />
          <ReportActions state={query} canSave={!!query.result} canExport={canExport} exportDisabled={view.rows.length === 0} onSave={() => setSaving(true)} onExport={exportRows} />
          {view.columns.length > 0 && <ColumnPicker columns={view.columns} hidden={view.hidden} onToggle={view.toggleColumn} />}
          {view.columns.length > 0 && <ReportFilters columns={view.columns} rules={view.filters} onChange={view.setFilters} />}
          {reports.saved.length > 0 && <SavedReportChips saved={reports.saved} onLoad={load} onDelete={remove} />}
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <ReportResult query={query} view={view} />
        </CardContent>
      </Card>
      <SaveReportDialog open={saving} onClose={() => setSaving(false)} onSave={save} />
      {confirmDialog}
    </div>
  )
}
