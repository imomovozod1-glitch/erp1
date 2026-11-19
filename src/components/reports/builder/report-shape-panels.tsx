'use client'

import { useState } from 'react'
import { SlidersHorizontal, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { LabeledField } from '@/components/shared/labeled-field'
import type { ReportColumn } from '@/lib/reports/definitions'
import type { SavedReport } from './saved-reports'

const SECTION_TITLE = 'flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase'

export function CheckList({ columns, checked, onToggle }: { columns: ReportColumn[]; checked: (key: string) => boolean; onToggle: (key: string, on: boolean) => void }) {
  const t = useTranslations('reports')
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {columns.map((column) => (
        <label key={column.key} className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={checked(column.key)} onCheckedChange={(on) => onToggle(column.key, on === true)} />
          <span className="text-sm text-foreground">{t(`col.${column.key}`)}</span>
        </label>
      ))}
    </div>
  )
}

export function ColumnPicker({ columns, hidden, onToggle }: { columns: ReportColumn[]; hidden: string[]; onToggle: (key: string, visible: boolean) => void }) {
  const t = useTranslations('reports')
  return (
    <div className="space-y-2 border-t pt-3">
      <p className={SECTION_TITLE}>
        <SlidersHorizontal className="size-3.5" /> {t('columns')}
      </p>
      <CheckList columns={columns} checked={(key) => !hidden.includes(key)} onToggle={onToggle} />
    </div>
  )
}

export function SavedReportChips({ saved, onLoad, onDelete }: { saved: SavedReport[]; onLoad: (entry: SavedReport) => void; onDelete: (entry: SavedReport) => void }) {
  const t = useTranslations()
  return (
    <div className="space-y-2 border-t pt-3">
      <p className={SECTION_TITLE}>{t('reports.savedReports')}</p>
      <div className="flex flex-wrap gap-2">
        {saved.map((entry) => (
          <span key={entry.name} className="inline-flex items-center gap-1 rounded-full bg-violet-50 py-1 pr-1.5 pl-3 text-xs font-medium text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
            <button type="button" onClick={() => onLoad(entry)} className="transition-colors hover:text-violet-600 dark:hover:text-violet-400">
              {entry.name}
            </button>
            <button type="button" onClick={() => onDelete(entry)} aria-label={t('common.delete')} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-rose-600 md:size-6">
              <Trash2 className="size-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

export function SaveReportDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const t = useTranslations()
  const [name, setName] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave(name.trim())
    setName('')
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm p-6">
        <DialogHeader>
          <DialogTitle>{t('common.save')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <LabeledField id="report-name" label={t('reports.savePrompt')}>
            <Input id="report-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </LabeledField>
          <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
