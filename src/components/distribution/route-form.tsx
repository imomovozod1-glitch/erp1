'use client'

import { useState } from 'react'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { Resolver, Controller } from 'react-hook-form'
import { usePersistedForm, clearPersistedForm } from '@/lib/hooks/use-persisted-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateRoutes } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Trash2, Loader2, ArrowUp, ArrowDown, Waypoints, MapPinOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { ItemPicker } from '@/components/shared/item-picker'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { WEEKDAY_KEYS } from '@/components/distribution/weekdays'
import { RouteMap } from '@/components/distribution/route-map'
import {
  isRoutePlanError,
  planAdHocRoute,
  routeHoursMinutes,
  routeKm,
  routePlanErrorMessage,
  type RouteGeometry,
} from '@/lib/route-plan'

export interface RouteCustomerOption {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface Stop {
  customerId: string
  name: string
  phone?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface RouteFormProps {
  assignableUsers: AssignableUser[]
  customers: RouteCustomerOption[]
  initialData?: any
  initialStops?: any[]
  lang: string
}

/**
 * Marshrut — an agent's round.
 *
 * Shaped like the composition and role-template forms: the identity at the
 * top, the list it owns under its own label, actions bottom-right. Nothing
 * here moves stock or money, so it is an ordinary browser write — the stops
 * are replaced wholesale rather than diffed, so a half-failed save leaves a
 * route the user can see is empty and re-save.
 */
export function RouteForm({ initialData, initialStops, customers, lang, assignableUsers }: RouteFormProps) {
  const tCommon = useTranslations('common')
  const tRoot = useTranslations()
  const t = useTranslations('distribution')
  const exitForm = useRouteModalExit(`/${lang}/distribution/routes`)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const supabase = createClient() as any

  const FORM_ID = `route-form-v1:${initialData?.id ?? 'new'}`

  const [stops, setStops] = useState<Stop[]>(() =>
    (initialStops ?? []).map((s: any) => ({
      customerId: s.customer_id,
      name: s.customer?.name ?? '',
      phone: s.customer?.phone ?? null,
      address: s.customer?.address ?? null,
      latitude: s.customer?.latitude ?? null,
      longitude: s.customer?.longitude ?? null,
    }))
  )

  /**
   * The solved shape of the round, or null when it has not been solved since
   * the stops last changed.
   *
   * Held next to the stop list rather than fetched on render: each solve is a
   * metered Mapbox request (src/lib/mapbox.ts), so it happens when the user
   * asks for it, and the result is saved onto the route so no one pays for it
   * twice. `null` is the honest state — the map still shows the pins, just
   * without a line, which is also what the user sees for a route saved before
   * any of this existed.
   */
  const [plan, setPlan] = useState<{
    geometry: RouteGeometry
    distanceM: number
    durationS: number
    solver: 'mapbox' | 'local' | 'none'
  } | null>(
    initialData?.geometry && initialData?.optimized_at
      ? {
          geometry: initialData.geometry,
          distanceM: initialData.distance_m ?? 0,
          durationS: initialData.duration_s ?? 0,
          solver: initialData.optimized_by ?? 'mapbox',
        }
      : null
  )
  const [isOptimizing, setIsOptimizing] = useState(false)

  /** Stops that can actually be routed — a customer with no pin cannot be. */
  const located = stops.filter(
    (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number'
  )
  const unlocatedCount = stops.length - located.length

  /**
   * Any change to the list invalidates the drawn line. Mirrors what the
   * database does on its own side (distribution_route_stops_clear_geometry in
   * migration_route_geometry.sql), so the form and a row edited elsewhere
   * cannot disagree about whether the shape is current.
   */
  const editStops = (next: (current: Stop[]) => Stop[]) => {
    setPlan(null)
    setStops(next)
  }

  /**
   * Orders the stops by driving time and draws the result.
   *
   * Nothing is saved here — this plans the list the user is looking at,
   * including on a route that does not exist yet, and the order becomes real
   * when the form is submitted like any other field.
   */
  const optimize = async () => {
    if (located.length < 2) {
      toast.error(t('routeErrorTooFewStops'))
      return
    }
    setIsOptimizing(true)
    try {
      const result = await planAdHocRoute(
        located.map((s) => ({ lng: s.longitude as number, lat: s.latitude as number })),
        { optimize: true }
      )
      if (isRoutePlanError(result)) {
        toast.error(routePlanErrorMessage(tRoot, result))
        return
      }
      // Routed stops take the solved order; the ones with no pin keep their
      // relative order and go to the end, where the courier can see they still
      // need an address.
      const reordered = result.order.map((index) => located[index])
      const rest = stops.filter((s) => !located.includes(s))
      setStops([...reordered, ...rest])
      setPlan({
        geometry: result.geometry,
        distanceM: result.distanceM,
        durationS: result.durationS,
        solver: result.solver,
      })
      toast.success(t('routeOptimized'))
    } finally {
      setIsOptimizing(false)
    }
  }

  const schema = z.object({
    name: z.string().min(1, tCommon('required')),
    agent_id: z.string().optional().nullable(),
    weekday: z.string().optional().nullable(),
    notes: z.string().optional(),
    is_active: z.boolean().default(true),
  })
  type FormData = z.infer<typeof schema>

  const { register, handleSubmit, control, formState: { errors } } = usePersistedForm<FormData>(FORM_ID, {
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: initialData?.name || '',
      agent_id: initialData?.agent_id || '',
      weekday: initialData?.weekday ? String(initialData.weekday) : '',
      notes: initialData?.notes || '',
      is_active: initialData?.is_active ?? true,
    },
  })

  /**
   * One click puts the customer on the round, at the end — the same gesture the
   * sales and production forms use. Unlike a product line there is no quantity
   * to bump, so a customer already on the route is disabled in the list rather
   * than re-addable, and carries the number of the stop they already are.
   */
  const addStop = (customerId: string) => {
    if (stops.some((s) => s.customerId === customerId)) {
      toast.error(t('stopExists'))
      return false
    }
    const customer = customers.find((c) => c.id === customerId)
    if (!customer) return false
    editStops((current) => [
      ...current,
      {
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        latitude: customer.latitude ?? null,
        longitude: customer.longitude ?? null,
      },
    ])
  }

  /** Visit order is the point of the list, so it is reordered, not just built. */
  const move = (index: number, delta: number) => {
    editStops((current) => {
      const next = [...current]
      const target = index + delta
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const onSubmit = async (data: any) => {
    if (stops.length === 0) {
      toast.error(t('noStops'))
      return
    }
    setIsSubmitting(true)
    try {
      const userRes = await supabase.auth.getUser()
      const userId: string | null = userRes.data?.user?.id ?? null

      const payload: Record<string, any> = {
        name: data.name.trim(),
        agent_id: data.agent_id || null,
        weekday: data.weekday ? Number(data.weekday) : null,
        notes: data.notes || null,
        is_active: data.is_active,
        assigned_to: assignedTo ?? initialData?.assigned_to ?? userId,
        created_by: initialData?.created_by ?? userId,
      }

      let routeId: string = initialData?.id
      if (routeId) {
        const { error } = await supabase.from('distribution_routes').update(payload).eq('id', routeId)
        if (error) throw error
        const { error: delError } = await supabase
          .from('distribution_route_stops')
          .delete()
          .eq('route_id', routeId)
        if (delError) throw delError
      } else {
        const { data: created, error } = await supabase
          .from('distribution_routes')
          .insert([payload])
          .select('id')
          .single()
        if (error) throw error
        routeId = created.id
      }

      // `tenant_id` is left out on purpose: the set_tenant_id() BEFORE INSERT
      // trigger stamps it (migration_distribution.sql).
      const { error: stopsError } = await supabase.from('distribution_route_stops').insert(
        stops.map((s, index) => ({
          route_id: routeId,
          customer_id: s.customerId,
          position: index + 1,
        }))
      )
      if (stopsError) throw stopsError

      // Geometry last. Inserting the stops above fires
      // distribution_route_stops_clear_geometry (migration_route_geometry.sql),
      // which blanks the shape — so writing it before this point would have it
      // wiped by the very rows it describes.
      if (plan) {
        const { error: geometryError } = await supabase
          .from('distribution_routes')
          .update({
            geometry: plan.geometry,
            distance_m: plan.distanceM,
            duration_s: plan.durationS,
            optimized_at: new Date().toISOString(),
            optimized_by: plan.solver === 'none' ? 'local' : plan.solver,
          })
          .eq('id', routeId)
        // The round itself saved; only its picture did not. Not worth failing
        // the whole submit over — the map simply shows pins until it is solved
        // again.
        if (geometryError) console.error('Route geometry not saved', geometryError)
      }

      toast.success(tCommon('success'))
      await invalidateRoutes()
      clearPersistedForm(FORM_ID)
      exitForm()
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Everyone stays in the list. A customer already on the round is shown with
  // the number of the stop they are, and disabled — which answers "is this one
  // already on here, and where?" without scrolling down to the table.
  const stopIndexById = new Map(stops.map((s, index) => [s.customerId, index + 1]))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>{initialData ? t('editRoute') : t('addRoute')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('routeName')} *</Label>
              <Input id="name" {...register('name')} placeholder={t('routeNamePlaceholder')} />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent_id">{t('agent')}</Label>
              <Controller
                control={control}
                name="agent_id"
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(val) => field.onChange(!val || val === 'none' ? '' : val)}
                  >
                    <SelectTrigger id="agent_id" className="w-full">
                      <SelectValue>
                        {field.value
                          ? assignableUsers.find((u) => u.id === field.value)?.full_name ?? t('noAgent')
                          : t('noAgent')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('noAgent')}</SelectItem>
                      {assignableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name || '—'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekday">{t('weekday')}</Label>
              <Controller
                control={control}
                name="weekday"
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(val) => field.onChange(!val || val === 'none' ? '' : val)}
                  >
                    <SelectTrigger id="weekday" className="w-full">
                      <SelectValue>
                        {field.value ? t(WEEKDAY_KEYS[Number(field.value) - 1]) : t('noWeekday')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('noWeekday')}</SelectItem>
                      {WEEKDAY_KEYS.map((key, index) => (
                        <SelectItem key={key} value={String(index + 1)}>{t(key)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_active">{tCommon('status')}</Label>
              <Controller
                control={control}
                name="is_active"
                render={({ field }) => (
                  <Select value={field.value ? 'true' : 'false'} onValueChange={(val) => field.onChange(val === 'true')}>
                    <SelectTrigger id="is_active" className="w-full">
                      <SelectValue>{field.value ? tCommon('active') : tCommon('inactive')}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">{tCommon('active')}</SelectItem>
                      <SelectItem value="false">{tCommon('inactive')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{t('stops')} *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={optimize}
                disabled={isOptimizing || located.length < 2}
                title={t('optimizeHint')}
              >
                {isOptimizing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Waypoints className="mr-2 h-4 w-4" />
                )}
                {t('optimize')}
              </Button>
            </div>
            <ItemPicker
              options={customers.map((c) => ({
                id: c.id,
                name: c.name,
                keywords: c.phone ?? '',
                meta:
                  typeof c.latitude === 'number' && typeof c.longitude === 'number'
                    ? c.address || c.phone || ''
                    : t('stopNotLocated'),
                badge: stopIndexById.get(c.id) ?? null,
                disabled: stopIndexById.has(c.id),
              }))}
              onPick={(option) => addStop(option.id)}
              placeholder={`${t('stop')}...`}
              emptyLabel={tCommon('noData')}
              hint={t('clickToAddStopHint')}
            />

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                    <TableHead className="w-16 text-center">{t('visitOrder')}</TableHead>
                    <TableHead>{t('customer')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('address')}</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stops.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        {t('noStops')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stops.map((stop, index) => (
                      <TableRow key={stop.customerId}>
                        <TableCell className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {stop.name}
                          {stop.phone && (
                            <span className="ml-2 text-xs text-muted-foreground">{stop.phone}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {typeof stop.latitude === 'number' && typeof stop.longitude === 'number' ? (
                            stop.address || '—'
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400"
                              title={t('stopNotLocatedHint')}
                            >
                              <MapPinOff className="h-3.5 w-3.5" />
                              {t('stopNotLocated')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={t('moveUp')}
                              onClick={() => move(index, -1)}
                              disabled={index === 0}
                              className="h-8 w-8 p-0"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={t('moveDown')}
                              onClick={() => move(index, 1)}
                              disabled={index === stops.length - 1}
                              className="h-8 w-8 p-0"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                editStops((c) => c.filter((s) => s.customerId !== stop.customerId))
                              }
                              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {located.length > 0 && (
              <div className="space-y-2">
                {plan && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                    <span className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('routeSummary')}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {t('routeDistance', { km: routeKm(plan.distanceM) })}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {t('routeDuration', routeHoursMinutes(plan.durationS))}
                    </span>
                    {/* Above 12 stops Mapbox refuses to solve it and the order
                        comes from our own straight-line pass — a weaker answer,
                        so it says so rather than passing itself off as optimal. */}
                    {plan.solver === 'local' && (
                      <span className="text-amber-600 dark:text-amber-400">{t('routeApproximate')}</span>
                    )}
                  </div>
                )}
                {unlocatedCount > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t('routeUnlocated', { count: unlocatedCount })}
                  </p>
                )}
                <RouteMap
                  stops={located.map((stop) => ({
                    id: stop.customerId,
                    name: stop.name,
                    address: stop.address,
                    latitude: stop.latitude ?? null,
                    longitude: stop.longitude ?? null,
                  }))}
                  geometry={plan?.geometry ?? null}
                  className="w-full h-96"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{tCommon('notes')}</Label>
            <Textarea id="notes" {...register('notes')} rows={3} />
          </div>

          <div className="max-w-sm">
            <AssigneeSelect value={assignedTo} onChange={setAssignedTo} users={assignableUsers} />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => exitForm()} disabled={isSubmitting}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
