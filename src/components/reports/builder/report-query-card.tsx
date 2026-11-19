'use client'

import { Download, Loader2, Play, Save, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LabeledField } from '@/components/shared/labeled-field'
import { REPORT_SOURCES, SOURCE_GROUPINGS, type ReportGrouping, type ReportSource } from '@/lib/reports/definitions'
import type { ReportQueryState } from './use-report-query'

function KeySelect<T extends string>({ id, value, options, label, onChange }: { id: string; value: T; options: readonly T[]; label: (key: T) => string; onChange: (value: T) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue>{label(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {label(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ReportQueryFields({ state, today, onSourceChange }: { state: ReportQueryState; today: string; onSourceChange: (source: ReportSource) => void }) {
  const t = useTranslations('reports')
  const { query, update } = state
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <LabeledField id="report-source" label={t('sourceLabel')}>
        <KeySelect id="report-source" value={query.source} options={REPORT_SOURCES} label={(key) => t(`source.${key}`)} onChange={onSourceChange} />
      </LabeledField>
      <LabeledField id="report-group" label={t('groupBy')}>
        <KeySelect<ReportGrouping> id="report-group" value={query.groupBy} options={SOURCE_GROUPINGS[query.source]} label={(key) => t(`group.${key}`)} onChange={(groupBy) => update({ groupBy })} />
      </LabeledField>
      {state.isDated ? (
        <>
          <LabeledField id="report-from" label={t('from')}>
            <DatePicker id="report-from" value={query.from} onChange={(from) => update({ from: from || today })} />
          </LabeledField>
          <LabeledField id="report-to" label={t('to')}>
            <DatePicker id="report-to" value={query.to} onChange={(to) => update({ to: to || today })} />
          </LabeledField>
        </>
      ) : (
        <p className="flex items-end text-xs text-muted-foreground sm:col-span-2">{t('snapshotHint')}</p>
      )}
    </div>
  )
}

interface ActionsProps {
  state: ReportQueryState
  canSave: boolean
  canExport: boolean
  exportDisabled: boolean
  onSave: () => void
  onExport: () => void
}

export function ReportActions({ state, canSave, canExport, exportDisabled, onSave, onExport }: ActionsProps) {
  const t = useTranslations()
  return (
    <div className="flex flex-wrap items-end gap-3">
      <LabeledField id="report-search" label={t('common.search')} className="min-w-0 flex-1 max-md:basis-full md:min-w-56">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="report-search"
            value={state.query.search}
            onChange={(e) => state.update({ search: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && state.run()}
            placeholder={t('reports.searchPlaceholder')}
            className="pl-9"
          />
        </div>
      </LabeledField>
      <Button onClick={state.run} disabled={state.running} className="gap-2">
        {state.running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        {t('reports.run')}
      </Button>
      <Button variant="outline" onClick={onSave} disabled={!canSave} className="gap-2">
        <Save className="size-4" />
        {t('common.save')}
      </Button>
      {canExport && (
        <Button variant="outline" onClick={onExport} disabled={exportDisabled} className="gap-2">
          <Download className="size-4" />
          {t('common.export')}
        </Button>
      )}
    </div>
  )
}
