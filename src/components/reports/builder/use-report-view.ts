'use client'

import { useMemo, useState } from 'react'
import type { ChartType } from '@/components/reports/chart-types'
import type { ReportColumn, ReportResult } from '@/lib/reports/definitions'
import { applyFilters, applySort, computeTotals, dimensionColumns, numericColumns, type FilterRule, type SortRule } from '@/lib/reports/view'
import type { ReportShape, ViewMode } from './saved-reports'

const EMPTY: ReportColumn[] = []

function nextSort(current: SortRule | null, column: string): SortRule | null {
  if (current?.column !== column) return { column, direction: 'desc' }
  return current.direction === 'desc' ? { column, direction: 'asc' } : null
}

/** How a result is shaped in the browser — columns, filters, sort, table or chart — without another round trip. */
export function useReportView(result: ReportResult | null) {
  const columns = result?.columns ?? EMPTY
  const [hidden, setHidden] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterRule[]>([])
  const [sort, setSort] = useState<SortRule | null>(null)
  const [view, setView] = useState<ViewMode>('table')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [dimension, setDimension] = useState('')
  const [measures, setMeasures] = useState<string[]>([])

  // Filter, then sort; the totals come from the filtered rows so the footer never contradicts them.
  const filtered = useMemo(() => applyFilters(result?.rows ?? [], columns, filters), [result, columns, filters])
  const rows = useMemo(() => applySort(filtered, columns, sort), [filtered, columns, sort])
  const totals = useMemo(() => computeTotals(columns, filtered), [columns, filtered])
  const dimensions = useMemo(() => dimensionColumns(columns), [columns])
  const numerics = useMemo(() => numericColumns(columns), [columns])

  // Chart axes fall back at read time, keeping an explicit choice valid when the columns change under it.
  const activeDimension = columns.some((c) => c.key === dimension) ? dimension : (dimensions[0]?.key ?? '')
  const chosen = measures.filter((key) => numerics.some((c) => c.key === key))
  const activeMeasures = chosen.length > 0 ? chosen : numerics.slice(0, 1).map((c) => c.key)

  const toggleMeasure = (key: string) => {
    const next = activeMeasures.includes(key) ? activeMeasures.filter((item) => item !== key) : [...activeMeasures, key]
    setMeasures(next.length > 0 ? next : activeMeasures)
  }

  const toggleColumn = (key: string, visible: boolean) => setHidden((current) => (visible ? current.filter((k) => k !== key) : [...current, key]))

  const apply = (shape: ReportShape) => {
    setHidden(shape.hidden ?? [])
    setFilters(shape.filters ?? [])
    setSort(shape.sort ?? null)
    setView(shape.view ?? 'table')
    setChartType(shape.chartType ?? 'bar')
    setDimension(shape.dimension ?? '')
    setMeasures(shape.measures ?? [])
  }

  // A new source has other column keys; the table/chart choice itself carries over.
  const reset = () => {
    setHidden([])
    setFilters([])
    setSort(null)
    setDimension('')
    setMeasures([])
  }

  const snapshot = (): ReportShape => ({ hidden, filters, sort, view, chartType, dimension: activeDimension, measures: activeMeasures })

  return {
    columns, visibleColumns: columns.filter((c) => !hidden.includes(c.key)), hidden, toggleColumn,
    filters, setFilters, hasActiveFilters: filters.some((rule) => rule.column && rule.value.trim()),
    sort, toggleSort: (column: string) => setSort((current) => nextSort(current, column)),
    view, setView, chartType, setChartType, dimensions, numerics, activeDimension, setDimension, activeMeasures, toggleMeasure,
    rows, totals, apply, reset, snapshot,
  }
}

export type ReportViewState = ReturnType<typeof useReportView>
