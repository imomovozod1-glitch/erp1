'use client'

import { useTranslations } from 'next-intl'
import { Filter, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { ReportColumn } from '@/lib/reports/definitions'
import { OPERATORS_BY_TYPE, type FilterOperator, type FilterRule } from '@/lib/reports/view'

/**
 * Stackable filter rules over the report result — the "show me only the rows
 * I care about" half of the builder. Every rule must pass, so adding rules
 * always narrows.
 */
export function ReportFilters({
  columns,
  rules,
  onChange,
}: {
  columns: ReportColumn[]
  rules: FilterRule[]
  onChange: (next: FilterRule[]) => void
}) {
  const t = useTranslations('reports')

  const typeOf = (key: string) => columns.find((column) => column.key === key)?.type ?? 'text'

  const addRule = () => {
    const first = columns[0]
    if (!first) return
    onChange([...rules, { column: first.key, operator: OPERATORS_BY_TYPE[first.type][0], value: '' }])
  }

  const updateRule = (index: number, patch: Partial<FilterRule>) => {
    onChange(
      rules.map((rule, i) => {
        if (i !== index) return rule
        const next = { ...rule, ...patch }
        // Switching column can strand an operator the new type doesn't offer.
        if (patch.column) {
          const allowed = OPERATORS_BY_TYPE[typeOf(patch.column)]
          if (!allowed.includes(next.operator)) next.operator = allowed[0]
        }
        return next
      })
    )
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Filter className="h-3.5 w-3.5" /> {t('filters')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addRule} className="h-10 gap-1.5 text-xs md:h-7">
          <Plus className="h-3.5 w-3.5" />
          {t('addFilter')}
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('noFilters')}</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, index) => {
            const type = typeOf(rule.column)
            const operators = OPERATORS_BY_TYPE[type]
            return (
              <div key={index} className="grid grid-cols-2 items-center gap-2 max-md:rounded-2xl max-md:border max-md:p-2.5 md:flex md:flex-wrap">
                <Select value={rule.column} onValueChange={(value) => value && updateRule(index, { column: value })}>
                  <SelectTrigger className="h-10 w-full md:h-9 md:w-44">
                    <SelectValue>{t(`col.${rule.column}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem key={column.key} value={column.key}>
                        {t(`col.${column.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={rule.operator}
                  onValueChange={(value) => updateRule(index, { operator: value as FilterOperator })}
                >
                  <SelectTrigger className="h-10 w-full md:h-9 md:w-36">
                    <SelectValue>{t(`op.${rule.operator}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {t(`op.${operator}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  value={rule.value}
                  onChange={(event) => updateRule(index, { value: event.target.value })}
                  placeholder={t('filterValue')}
                  inputMode={type === 'number' || type === 'money' ? 'decimal' : undefined}
                  className="h-10 w-full min-w-32 flex-1 md:h-9 md:w-40"
                />

                <button
                  type="button"
                  onClick={() => onChange(rules.filter((_, i) => i !== index))}
                  aria-label={t('removeFilter')}
                  className="flex h-10 w-10 items-center justify-center justify-self-end rounded-md p-1.5 text-slate-400 md:h-auto md:w-auto transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
