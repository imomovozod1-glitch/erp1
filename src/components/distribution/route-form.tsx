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
import { Trash2, Plus, Loader2, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { WEEKDAY_KEYS } from '@/components/distribution/weekdays'

export interface RouteCustomerOption {
  id: string
  name: string
  phone?: string | null
  address?: string | null
}

interface Stop {
  customerId: string
  name: string
  phone?: string | null
  address?: string | null
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
    }))
  )
  const [picked, setPicked] = useState('')

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

  const addStop = () => {
    if (!picked) return
    if (stops.some((s) => s.customerId === picked)) {
      toast.error(t('stopExists'))
      return
    }
    const customer = customers.find((c) => c.id === picked)
    if (!customer) return
    setStops((current) => [
      ...current,
      { customerId: customer.id, name: customer.name, phone: customer.phone, address: customer.address },
    ])
    setPicked('')
  }

  /** Visit order is the point of the list, so it is reordered, not just built. */
  const move = (index: number, delta: number) => {
    setStops((current) => {
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

  const available = customers.filter((c) => !stops.some((s) => s.customerId === c.id))

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
            <Label>{t('stops')} *</Label>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-60 flex-1 space-y-1">
                <Label className="text-xs">{t('stop')}</Label>
                <Select value={picked} onValueChange={(val) => setPicked(val ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={tCommon('select')}>
                      {picked ? customers.find((c) => c.id === picked)?.name : tCommon('select')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" onClick={addStop} disabled={!picked}>
                <Plus className="mr-2 h-4 w-4" /> {t('addStop')}
              </Button>
            </div>

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
                          {stop.address || '—'}
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
                                setStops((c) => c.filter((s) => s.customerId !== stop.customerId))
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
