'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, Scale, Trash2, X, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCan } from '@/components/providers/permissions-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MobileThumb } from '@/components/shared/mobile-list'
import { ResponsiveTable } from '@/components/shared/responsive-table'
import { cn } from '@/lib/utils'
import { EmptyCatalog } from '../catalog/catalog-parts'
import { useUnits, type UnitRow, type UnitsState } from './use-units'

interface UnitsListProps {
  lang: string
  initialUnits: UnitRow[]
}

export function UnitsList({ initialUnits }: UnitsListProps) {
  const t = useTranslations()
  const state = useUnits(initialUnits)
  const name = (unit: UnitRow) => <UnitName unit={unit} state={state} />
  const actions = (unit: UnitRow) => <UnitActions unit={unit} state={state} />
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <UnitsTotal count={state.rows.length} />
        <AddUnitCard state={state} />
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <ResponsiveTable
            rows={state.visible}
            rowKey={(unit) => unit.id}
            indexOffset={state.offset}
            empty={<EmptyCatalog icon={Scale} />}
            columns={[
              { key: 'name', header: t('inventory.units.name'), className: 'text-sm font-semibold', cell: name },
              { key: 'actions', header: t('common.actions'), align: 'right', className: 'w-[100px]', cell: actions },
            ]}
            card={(unit) => ({ leading: <MobileThumb fallback={<Scale />} />, title: name(unit), menu: actions(unit) })}
          />
          <UnitsPager state={state} />
        </CardContent>
      </Card>
      {state.confirmDialog}
    </div>
  )
}

function UnitsTotal({ count }: { count: number }) {
  const t = useTranslations('inventory.units')
  return (
    <Card className="flex items-center gap-4 border-0 p-4 shadow-sm md:p-6">
      <span className="rounded-xl bg-brand-subtle p-3 text-violet-600 dark:text-violet-400">
        <Scale className="size-6" />
      </span>
      <div>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t('total')}</p>
        <p className="text-2xl font-bold text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">{t('companyWide')}</p>
      </div>
    </Card>
  )
}

function AddUnitCard({ state }: { state: UnitsState }) {
  const t = useTranslations()
  const [name, setName] = useState('')
  const submit = async (e: React.SubmitEvent) => {
    e.preventDefault()
    if (await state.add(name)) setName('')
  }
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="py-4">
        <CardTitle className="text-sm font-bold">{t('inventory.units.addNew')}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <form onSubmit={submit} className="flex gap-2">
          <Input placeholder={t('inventory.units.placeholder')} value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
          <Button type="submit" disabled={!name.trim() || state.adding} className="shrink-0">
            <Plus className="size-4" />
            {t('common.add')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function UnitName({ unit, state }: { unit: UnitRow; state: UnitsState }) {
  if (state.editing?.id !== unit.id) return <>{unit.name}</>
  return (
    <Input
      value={state.editing.value}
      onChange={(e) => state.changeEdit(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && state.rename(unit)}
      className="h-10 max-w-50 text-sm md:h-8"
      autoFocus
    />
  )
}

function IconAction({ icon: Icon, label, tone, onClick }: { icon: LucideIcon; label: string; tone: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" title={label} aria-label={label} onClick={onClick} className={cn('size-10 md:size-8', tone)}>
      <Icon className="size-4" />
    </Button>
  )
}

function UnitActions({ unit, state }: { unit: UnitRow; state: UnitsState }) {
  const t = useTranslations('common')
  const canEdit = useCan('inventory', 'edit', 'units')
  const canDelete = useCan('inventory', 'delete', 'units')
  if (state.editing?.id === unit.id) {
    return (
      <div className="flex justify-end gap-1">
        <IconAction icon={Check} label={t('save')} tone="text-emerald-600 dark:text-emerald-400" onClick={() => state.rename(unit)} />
        <IconAction icon={X} label={t('cancel')} tone="text-muted-foreground" onClick={state.cancelEdit} />
      </div>
    )
  }
  return (
    <div className="flex justify-end gap-1">
      {canEdit && <IconAction icon={Pencil} label={t('edit')} tone="text-violet-600 dark:text-violet-400" onClick={() => state.startEdit(unit)} />}
      {canDelete && <IconAction icon={Trash2} label={t('delete')} tone="text-rose-600 dark:text-rose-400" onClick={() => state.remove(unit)} />}
    </div>
  )
}

function UnitsPager({ state }: { state: UnitsState }) {
  const t = useTranslations('common')
  if (state.totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t p-4">
      <Button variant="outline" size="sm" onClick={() => state.setPage(state.page - 1)} disabled={state.page === 1}>
        {t('previous')}
      </Button>
      <span className="text-xs font-medium text-muted-foreground">
        {state.page} / {state.totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={() => state.setPage(state.page + 1)} disabled={state.page === state.totalPages}>
        {t('next')}
      </Button>
    </div>
  )
}
