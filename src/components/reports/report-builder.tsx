'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronsUpDown,
  Download,
  Loader2,
  Play,
  Search,
  Save,
  Table2,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ReportChart, CHART_TYPES, type ChartType } from '@/components/reports/report-chart'
import { ReportFilters } from '@/components/reports/report-filters'
import { exportRowsToExcel } from '@/lib/excel-io'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'
import {
  DATED_SOURCES,
  REPORT_SOURCES,
  SOURCE_GROUPINGS,
  type ReportGrouping,
  type ReportResult,
  type ReportSource,
} from '@/lib/reports/definitions'
import {
  applyFilters,
  applySort,
  computeTotals,
  dimensionColumns,
  numericColumns,
  type FilterRule,
  type SortRule,
} from '@/lib/reports/view'

/** Saved report configurations, per browser. Mirrors how measurement units and
 *  the cashbox fallback already persist small user preferences locally. */
const SAVED_KEY = 'erp_saved_reports'

type ViewMode = 'table' | 'chart'

interface SavedReport {
  name: string
  source: ReportSource
  groupBy: ReportGrouping
  from: string
  to: string
  search: string
  hidden: string[]
  /** Added after the first release — older entries simply lack them. */
  filters?: FilterRule[]
  sort?: SortRule | null
  view?: ViewMode
  chartType?: ChartType
  dimension?: string
  measures?: string[]
}

function readSaved(): SavedReport[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function isoDaysAgo(days: number, today: string): string {
  const date = new Date(`${today}T00:00:00`)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

/**
 * The custom report builder: pick a source, a period and a grouping, then
 * shape what comes back — which columns to show, which rows to keep, how to
 * sort them, and whether to read the result as a table or a chart.
 *
 * The query runs server-side (/api/reports/run) because it has to respect the
 * caller's module permission and data scope; everything after that — filters,
 * sorting, charting — is applied in the browser over the returned rows, so
 * exploring a result never costs another round trip. See src/lib/reports/view.ts
 * for the one caveat that follows from it.
 */
export function ReportBuilder({ today }: { today: string }) {
  const t = useTranslations('reports')
  const tCommon = useTranslations('common')

  const [source, setSource] = useState<ReportSource>('sales')
  const [groupBy, setGroupBy] = useState<ReportGrouping>('day')
  const [from, setFrom] = useState(() => isoDaysAgo(29, today))
  const [to, setTo] = useState(today)
  const [search, setSearch] = useState('')
  const [hidden, setHidden] = useState<string[]>([])

  const [filters, setFilters] = useState<FilterRule[]>([])
  const [sort, setSort] = useState<SortRule | null>(null)
  const [view, setView] = useState<ViewMode>('table')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [dimension, setDimension] = useState('')
  const [measures, setMeasures] = useState<string[]>([])

  const [result, setResult] = useState<ReportResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [saved, setSaved] = useState<SavedReport[]>([])

  // Deferred with a 0 ms timer rather than called straight from the effect
  // body: a synchronous setState inside an effect is flagged as a cascading
  // render (react-hooks/set-state-in-effect), the same shape already used in
  // support-conversation.tsx.
  useEffect(() => {
    const timer = setTimeout(() => setSaved(readSaved()), 0)
    return () => clearTimeout(timer)
  }, [])

  const groupings = SOURCE_GROUPINGS[source]
  const isDated = DATED_SOURCES.includes(source)

  const columns = useMemo(() => result?.columns ?? [], [result])

  const handleSourceChange = (next: ReportSource) => {
    setSource(next)
    // Every source offers a different set of groupings; keep the current one
    // only when it still exists.
    setGroupBy((prev) => (SOURCE_GROUPINGS[next].includes(prev) ? prev : SOURCE_GROUPINGS[next][0]))
    setResult(null)
    setHidden([])
    // Filters, sort and the chart axes all reference column keys that the new
    // source does not have.
    setFilters([])
    setSort(null)
    setDimension('')
    setMeasures([])
  }

  const run = async (override?: Partial<SavedReport>) => {
    if (isRunning) return
    setIsRunning(true)
    try {
      const body = {
        source: override?.source ?? source,
        groupBy: override?.groupBy ?? groupBy,
        search: (override?.search ?? search).trim() || undefined,
        ...(DATED_SOURCES.includes(override?.source ?? source)
          ? { from: override?.from ?? from, to: override?.to ?? to }
          : {}),
      }
      const res = await fetch('/api/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error === 'forbidden' ? t('errorForbidden') : tCommon('error'))
        return
      }
      setResult(json as ReportResult)
      if ((json as ReportResult).truncated) toast.warning(t('truncated'))
    } catch {
      toast.error(tCommon('error'))
    } finally {
      setIsRunning(false)
    }
  }

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hidden.includes(column.key)),
    [columns, hidden]
  )

  // Filter first, then sort: sorting a set the user is still narrowing would
  // reorder rows that are about to disappear.
  const filteredRows = useMemo(
    () => applyFilters(result?.rows ?? [], columns, filters),
    [result, columns, filters]
  )
  const rows = useMemo(
    () => applySort(filteredRows, columns, sort),
    [filteredRows, columns, sort]
  )
  // Recomputed from the filtered rows so the footer can never contradict what
  // is shown above it.
  const totals = useMemo(() => computeTotals(columns, filteredRows), [columns, filteredRows])

  /*
   * Chart axes are derived, not stored in an effect: picking defaults from the
   * result inside `useEffect` would be a setState-in-effect (a React Compiler
   * lint error here). Falling back at read time keeps a user's explicit choice
   * while staying valid when the columns change under it.
   */
  const dimensions = useMemo(() => dimensionColumns(columns), [columns])
  const numerics = useMemo(() => numericColumns(columns), [columns])

  const activeDimension =
    dimension && columns.some((column) => column.key === dimension)
      ? dimension
      : dimensions[0]?.key ?? ''

  const chosenMeasures = measures.filter((key) => numerics.some((column) => column.key === key))
  const activeMeasures =
    chosenMeasures.length > 0 ? chosenMeasures : numerics[0] ? [numerics[0].key] : []

  const toggleMeasure = (key: string) => {
    const next = activeMeasures.includes(key)
      ? activeMeasures.filter((item) => item !== key)
      : [...activeMeasures, key]
    // A chart with no series is not a chart; keep the last one selected.
    setMeasures(next.length > 0 ? next : activeMeasures)
  }

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.column !== key) return { column: key, direction: 'desc' }
      if (prev.direction === 'desc') return { column: key, direction: 'asc' }
      return null // third click clears it and restores the engine's own order
    })
  }

  const renderCell = (value: string | number | null, type: string) => {
    if (value === null || value === '') return '—'
    if (type === 'money') return formatCurrency(Number(value))
    if (type === 'number') return formatNumber(Number(value))
    if (type === 'date') return formatDate(String(value))
    // Status-ish values come back as raw enum keys; translate what we can.
    return String(value)
  }

  const handleExport = async () => {
    if (rows.length === 0) return
    const exportColumns = visibleColumns.map((column) => ({
      header: t(`col.${column.key}`),
      key: column.key,
    }))
    const stamp = isDated ? `${from}_${to}` : today
    // Exports what is on screen — filtered and sorted — not the raw result.
    await exportRowsToExcel(rows, exportColumns, `${t(`source.${source}`)}_${stamp}.xlsx`, 'Report')
  }

  const persist = (next: SavedReport[]) => {
    setSaved(next)
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next))
    } catch {
      /* private mode / quota — the report still runs, it just isn't remembered */
    }
  }

  const handleSave = () => {
    const name = window.prompt(t('savePrompt'))?.trim()
    if (!name) return
    const entry: SavedReport = {
      name, source, groupBy, from, to, search, hidden,
      filters, sort, view, chartType,
      dimension: activeDimension,
      measures: activeMeasures,
    }
    persist([...saved.filter((item) => item.name !== name), entry])
    toast.success(t('saved'))
  }

  const handleLoad = (entry: SavedReport) => {
    setSource(entry.source)
    setGroupBy(entry.groupBy)
    setFrom(entry.from)
    setTo(entry.to)
    setSearch(entry.search)
    setHidden(entry.hidden ?? [])
    setFilters(entry.filters ?? [])
    setSort(entry.sort ?? null)
    setView(entry.view ?? 'table')
    setChartType(entry.chartType ?? 'bar')
    setDimension(entry.dimension ?? '')
    setMeasures(entry.measures ?? [])
    run(entry)
  }

  const viewButton = (mode: ViewMode, Icon: typeof Table2, label: string) => (
    <button
      type="button"
      onClick={() => setView(mode)}
      aria-pressed={view === mode}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
        view === mode
          ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )

  const hasActiveFilters = filters.some((rule) => rule.column && rule.value.trim())

  return (
    <div className="space-y-4">
      {/* Builder */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>{t('sourceLabel')}</Label>
              <Select value={source} onValueChange={(value) => handleSourceChange(value as ReportSource)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{t(`source.${source}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REPORT_SOURCES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`source.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('groupBy')}</Label>
              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as ReportGrouping)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{t(`group.${groupBy}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {groupings.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`group.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isDated ? (
              <>
                <div className="space-y-2">
                  <Label>{t('from')}</Label>
                  <DatePicker value={from} onChange={(value) => setFrom(value || today)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('to')}</Label>
                  <DatePicker value={to} onChange={(value) => setTo(value || today)} />
                </div>
              </>
            ) : (
              <div className="space-y-2 sm:col-span-2 flex items-end">
                <p className="text-xs text-muted-foreground">{t('snapshotHint')}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2 flex-1 min-w-56">
              <Label>{tCommon('search')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="pl-9"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') run()
                  }}
                />
              </div>
            </div>
            <Button onClick={() => run()} disabled={isRunning} className="gap-2">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {t('run')}
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={!result} className="gap-2">
              <Save className="h-4 w-4" />
              {tCommon('save')}
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={rows.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {tCommon('export')}
            </Button>
          </div>

          {/* Column picker — appears once a report has been run, because the
              available columns depend on the source and grouping. */}
          {columns.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <SlidersHorizontal className="h-3.5 w-3.5" /> {t('columns')}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {columns.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={!hidden.includes(column.key)}
                      onCheckedChange={(checked) =>
                        setHidden((prev) =>
                          checked === true
                            ? prev.filter((key) => key !== column.key)
                            : [...prev, column.key]
                        )
                      }
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{t(`col.${column.key}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {columns.length > 0 && (
            <ReportFilters columns={columns} rules={filters} onChange={setFilters} />
          )}

          {saved.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('savedReports')}
              </p>
              <div className="flex flex-wrap gap-2">
                {saved.map((entry) => (
                  <span
                    key={entry.name}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 pl-3 pr-1.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    <button type="button" onClick={() => handleLoad(entry)} className="hover:underline">
                      {entry.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => persist(saved.filter((item) => item.name !== entry.name))}
                      className="rounded p-0.5 text-slate-400 hover:text-rose-600"
                      aria-label={tCommon('delete')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {!result ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <BarChart3 className="h-8 w-8 opacity-40" />
              <p className="text-sm">{t('emptyState')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
                <div className="inline-flex items-center gap-1 rounded-lg border bg-slate-100 p-1 shadow-inner dark:bg-slate-800">
                  {viewButton('table', Table2, t('viewTable'))}
                  {viewButton('chart', BarChart3, t('viewChart'))}
                </div>

                {view === 'chart' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
                      <SelectTrigger className="h-9 w-32">
                        <SelectValue>{t(`chartType.${chartType}`)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CHART_TYPES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {t(`chartType.${item}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={activeDimension} onValueChange={(value) => setDimension(value ?? '')}>
                      <SelectTrigger className="h-9 w-40">
                        <SelectValue>
                          {activeDimension ? t(`col.${activeDimension}`) : t('dimension')}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {dimensions.map((column) => (
                          <SelectItem key={column.key} value={column.key}>
                            {t(`col.${column.key}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {view === 'chart' && numerics.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-slate-50/50 px-4 py-2.5 dark:bg-slate-800/30">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('measures')}
                  </span>
                  {numerics.map((column) => (
                    <label key={column.key} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={activeMeasures.includes(column.key)}
                        onCheckedChange={() => toggleMeasure(column.key)}
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {t(`col.${column.key}`)}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{tCommon('noData')}</p>
                </div>
              ) : view === 'chart' ? (
                <ReportChart
                  columns={columns}
                  rows={rows}
                  chartType={chartType}
                  dimension={activeDimension}
                  // Pie renders a single series; extra measures would silently
                  // do nothing, so only the first is passed.
                  measures={chartType === 'pie' ? activeMeasures.slice(0, 1) : activeMeasures}
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        {visibleColumns.map((column) => {
                          const numeric = column.type === 'money' || column.type === 'number'
                          const active = sort?.column === column.key
                          return (
                            <TableHead
                              key={column.key}
                              className={numeric ? 'text-right tabular-nums' : ''}
                            >
                              <button
                                type="button"
                                onClick={() => toggleSort(column.key)}
                                className={`inline-flex items-center gap-1 transition-colors hover:text-violet-600 dark:hover:text-violet-400 ${
                                  numeric ? 'flex-row-reverse' : ''
                                } ${active ? 'text-violet-600 dark:text-violet-400' : ''}`}
                              >
                                {t(`col.${column.key}`)}
                                {active ? (
                                  sort.direction === 'asc' ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3" />
                                  )
                                ) : (
                                  <ChevronsUpDown className="h-3 w-3 opacity-30" />
                                )}
                              </button>
                            </TableHead>
                          )
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, index) => (
                        <TableRow key={index}>
                          {visibleColumns.map((column) => (
                            <TableCell
                              key={column.key}
                              className={
                                column.type === 'money' || column.type === 'number'
                                  ? 'text-right tabular-nums'
                                  : ''
                              }
                            >
                              {renderCell(row[column.key], column.type)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 dark:bg-slate-800/60 font-bold">
                        {visibleColumns.map((column, index) => (
                          <TableCell
                            key={column.key}
                            className={
                              column.type === 'money' || column.type === 'number'
                                ? 'text-right tabular-nums'
                                : ''
                            }
                          >
                            {index === 0
                              ? tCommon('total')
                              : column.key in totals
                                ? renderCell(totals[column.key], column.type)
                                : ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs text-muted-foreground">
                <span>
                  {hasActiveFilters
                    ? t('filteredRows', { shown: rows.length, total: result.rows.length })
                    : `${rows.length} ${tCommon('rows')}`}
                </span>
                {result.truncated && (
                  <span className="text-amber-600">
                    {hasActiveFilters ? t('filterAfterCap') : t('truncated')}
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
