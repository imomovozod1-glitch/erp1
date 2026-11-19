'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Waypoints } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Control, Resolver } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { FormNameField } from '@/components/shared/form-controls'
import { FormFooter } from '@/components/shared/form-footer'
import { ItemPicker } from '@/components/shared/item-picker'
import { LabeledField } from '@/components/shared/labeled-field'
import { StatusField } from '@/components/inventory/catalog-form/catalog-fields'
import { WEEKDAY_KEYS } from '@/components/distribution/weekdays'
import { RoutePlanPanel } from '@/components/distribution/route-form/route-plan-panel'
import { routeDefaults, routeSchema, isLocated, type RouteCustomerOption, type RouteData } from '@/components/distribution/route-form/route-model'
import { saveRoute } from '@/components/distribution/route-form/route-save'
import { RouteStopsList } from '@/components/distribution/route-form/route-stops-list'
import { useRouteStops, type RouteStops } from '@/components/distribution/route-form/use-route-stops'
import { invalidateRoutes } from '@/lib/data/revalidate'
import { errorMessage } from '@/lib/error-message'
import { clearPersistedForm, usePersistedForm } from '@/lib/hooks/use-persisted-form'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { createClient } from '@/lib/supabase/client'

export type { RouteCustomerOption } from '@/components/distribution/route-form/route-model'

interface RouteFormProps {
  assignableUsers: AssignableUser[]
  customers: RouteCustomerOption[]
  initialData?: any
  initialStops?: any[]
  lang: string
}

function HeaderFields({ control, register, error, users }: { control: Control<RouteData>; register: any; error?: string; users: AssignableUser[] }) {
  const t = useTranslations('distribution')
  const weekdays = WEEKDAY_KEYS.map((key, index) => ({ id: String(index + 1), name: t(key) }))
  const agents = users.map((u) => ({ id: u.id, name: u.full_name || '—' }))
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <LabeledField id="name" label={t('routeName')} required error={error}>
        <Input id="name" {...register('name')} placeholder={t('routeNamePlaceholder')} />
      </LabeledField>
      <FormNameField control={control} name="agent_id" label={t('agent')} options={agents} emptyLabel={t('noAgent')} />
      <FormNameField control={control} name="weekday" label={t('weekday')} options={weekdays} emptyLabel={t('noWeekday')} />
      <StatusField control={control} />
    </div>
  )
}

// A customer already on the round stays listed, disabled and badged with their stop number.
function StopsSection({ state, customers }: { state: RouteStops; customers: RouteCustomerOption[] }) {
  const t = useTranslations()
  const options = customers.map((c) => ({
    id: c.id,
    name: c.name,
    keywords: c.phone ?? '',
    meta: isLocated({ customerId: c.id, ...c }) ? c.address || c.phone || '' : t('distribution.stopNotLocated'),
    badge: state.positionOf.get(c.id) ?? null,
    disabled: state.positionOf.has(c.id),
  }))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{t('distribution.stops')} *</Label>
        <Button type="button" variant="outline" size="sm" onClick={state.optimize} disabled={state.optimizing || state.located.length < 2} title={t('distribution.optimizeHint')}>
          {state.optimizing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Waypoints className="mr-2 size-4" />}
          {t('distribution.optimize')}
        </Button>
      </div>
      <ItemPicker options={options} onPick={(option) => state.add(option.id)} placeholder={`${t('distribution.stop')}...`} emptyLabel={t('common.noData')} hint={t('distribution.clickToAddStopHint')} />
      <RouteStopsList state={state} />
      <RoutePlanPanel state={state} />
    </div>
  )
}

/** Marshrut — an agent's round: identity on top, the stops it owns below, actions bottom-right. */
export function RouteForm({ initialData, initialStops, customers, lang, assignableUsers }: RouteFormProps) {
  const t = useTranslations()
  const exitForm = useRouteModalExit(`/${lang}/distribution/routes`)
  const formId = `route-form-v1:${initialData?.id ?? 'new'}`
  const [submitting, setSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const state = useRouteStops(initialData, initialStops, customers)
  const { register, handleSubmit, control, formState } = usePersistedForm<RouteData>(formId, {
    resolver: zodResolver(routeSchema(t('common.required'))) as unknown as Resolver<RouteData>,
    defaultValues: routeDefaults(initialData),
  })

  const submit = async (data: RouteData) => {
    if (state.stops.length === 0) return void toast.error(t('distribution.noStops'))
    setSubmitting(true)
    try {
      await saveRoute(createClient(), { initial: initialData, data, stops: state.stops, plan: state.plan, assignedTo })
      toast.success(t('common.success'))
      await invalidateRoutes()
      clearPersistedForm(formId)
      exitForm()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>{t(initialData ? 'distribution.editRoute' : 'distribution.addRoute')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(submit)} className="space-y-6">
          <HeaderFields control={control} register={register} error={formState.errors.name?.message} users={assignableUsers} />
          <StopsSection state={state} customers={customers} />
          <LabeledField id="notes" label={t('common.notes')}>
            <Textarea id="notes" {...register('notes')} rows={3} />
          </LabeledField>
          <div className="max-w-sm">
            <AssigneeSelect value={assignedTo} onChange={setAssignedTo} users={assignableUsers} />
          </div>
          <FormFooter>
            <Button type="button" variant="outline" onClick={() => exitForm()} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </FormFooter>
        </form>
      </CardContent>
    </Card>
  )
}
