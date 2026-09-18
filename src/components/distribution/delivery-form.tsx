'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { invalidateDeliveries } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { formatCurrency, isoDate } from '@/lib/utils'

export interface DeliverableOrder {
  id: string
  order_number: string
  status: string
  total_amount: number
  customer_id: string | null
  customers?: { id: string; name: string; phone?: string | null; address?: string | null } | null
}

export interface DeliveryRouteOption {
  id: string
  name: string
  agent_id: string | null
}

interface DeliveryFormProps {
  assignableUsers: AssignableUser[]
  orders: DeliverableOrder[]
  routes: DeliveryRouteOption[]
  initialData?: any
  nextNumber: string
  lang: string
}

/**
 * Yetkazib berish — one sale on its way to a customer.
 *
 * An ordinary browser write: creating or editing a delivery moves no stock and
 * no money (`create_sale` already did both). Only the status move goes through
 * the database, because that carries the sales order with it — see
 * `set_delivery_status` in migration_distribution.sql.
 *
 * Picking the sale fills in the customer and their address, the way picking a
 * composition fills in a production run: the document it comes from knows
 * those, and retyping them is how they end up disagreeing.
 */
export function DeliveryForm({
  initialData,
  orders,
  routes,
  assignableUsers,
  nextNumber,
  lang,
}: DeliveryFormProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('distribution')
  const router = useRouter()
  const exitForm = useRouteModalExit(`/${lang}/distribution/deliveries`)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any

  const [deliveryNumber, setDeliveryNumber] = useState<string>(
    initialData?.delivery_number || nextNumber
  )
  const [orderId, setOrderId] = useState<string>(initialData?.order_id || '')
  const [customerId, setCustomerId] = useState<string>(initialData?.customer_id || '')
  const [routeId, setRouteId] = useState<string>(initialData?.route_id || '')
  const [agentId, setAgentId] = useState<string>(initialData?.agent_id || '')
  const [plannedDate, setPlannedDate] = useState<string>(initialData?.planned_date || isoDate())
  const [address, setAddress] = useState<string>(initialData?.address || '')
  const [notes, setNotes] = useState<string>(initialData?.notes || '')
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)

  // An edit keeps whatever sale it already has, even though that sale is no
  // longer "deliverable" — it is already on this delivery.
  const orderOptions = useMemo(() => {
    if (!initialData?.order_id || orders.some((o) => o.id === initialData.order_id)) return orders
    return [
      {
        id: initialData.order_id,
        order_number: initialData.order?.order_number ?? initialData.order_id,
        status: initialData.order?.status ?? '',
        total_amount: Number(initialData.order?.total_amount) || 0,
        customer_id: initialData.customer_id ?? null,
        customers: initialData.customer ?? null,
      } as DeliverableOrder,
      ...orders,
    ]
  }, [orders, initialData])

  const selectedOrder = orderOptions.find((o) => o.id === orderId)

  /** The sale knows its customer and where they are; take both from it. */
  const handleSelectOrder = (value: string | null) => {
    const next = !value || value === 'none' ? '' : value
    setOrderId(next)
    const chosen = orderOptions.find((o) => o.id === next)
    if (!chosen) return
    setCustomerId(chosen.customer_id ?? '')
    if (chosen.customers?.address) setAddress(chosen.customers.address)
  }

  /** A round has an agent; choosing it suggests them as the courier. */
  const handleSelectRoute = (value: string | null) => {
    const next = !value || value === 'none' ? '' : value
    setRouteId(next)
    const chosen = routes.find((r) => r.id === next)
    if (chosen?.agent_id && !agentId) setAgentId(chosen.agent_id)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deliveryNumber.trim()) {
      toast.error(tCommon('required'))
      return
    }
    if (!orderId && !customerId) {
      toast.error(tCommon('required'))
      return
    }

    setIsSubmitting(true)
    try {
      const userRes = await supabase.auth.getUser()
      const userId: string | null = userRes.data?.user?.id ?? null

      const payload: Record<string, any> = {
        delivery_number: deliveryNumber.trim(),
        order_id: orderId || null,
        customer_id: customerId || null,
        route_id: routeId || null,
        agent_id: agentId || null,
        planned_date: plannedDate || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        assigned_to: assignedTo ?? initialData?.assigned_to ?? userId,
        created_by: initialData?.created_by ?? userId,
      }

      if (initialData?.id) {
        const { error } = await supabase.from('deliveries').update(payload).eq('id', initialData.id)
        if (error) throw error
        toast.success(tCommon('success'))
        await invalidateDeliveries()
        exitForm()
      } else {
        const { data: created, error } = await supabase
          .from('deliveries')
          .insert([payload])
          .select('id')
          .single()
        if (error) throw error
        toast.success(tCommon('success'))
        await invalidateDeliveries()
        router.push(`/${lang}/distribution/deliveries/${created.id}`)
      }
    } catch (error: any) {
      // deliveries_tenant_number_key
      const message =
        error?.code === '23505' ? t('duplicateNumber') : error?.message || tCommon('error')
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>{initialData ? t('editDelivery') : t('addDelivery')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="delivery_number">{t('deliveryNumber')} *</Label>
              <Input
                id="delivery_number"
                value={deliveryNumber}
                onChange={(e) => setDeliveryNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_id">{t('order')}</Label>
              <Select value={orderId || 'none'} onValueChange={handleSelectOrder}>
                <SelectTrigger id="order_id" className="w-full">
                  <SelectValue placeholder={t('selectOrder')}>
                    {selectedOrder ? selectedOrder.order_number : t('noOrderLink')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noOrderLink')}</SelectItem>
                  {orderOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_number} — {o.customers?.name ?? '—'} · {formatCurrency(Number(o.total_amount) || 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {orderOptions.length === 0 && (
                <p className="text-[11px] leading-snug text-muted-foreground">{t('noDeliverableOrders')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('customer')}</Label>
              {/* Taken from the sale, not typed: two records of who this is for
                  would eventually disagree. */}
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-slate-50 px-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                {selectedOrder?.customers?.name ?? initialData?.customer?.name ?? '—'}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="route_id">{t('route')}</Label>
              <Select value={routeId || 'none'} onValueChange={handleSelectRoute}>
                <SelectTrigger id="route_id" className="w-full">
                  <SelectValue>
                    {routeId ? routes.find((r) => r.id === routeId)?.name ?? '—' : tCommon('select')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tCommon('select')}</SelectItem>
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent_id">{t('courier')}</Label>
              <Select
                value={agentId || 'none'}
                onValueChange={(val) => setAgentId(!val || val === 'none' ? '' : val)}
              >
                <SelectTrigger id="agent_id" className="w-full">
                  <SelectValue>
                    {agentId
                      ? assignableUsers.find((u) => u.id === agentId)?.full_name ?? '—'
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="planned_date">{t('plannedDate')}</Label>
              <Input
                id="planned_date"
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t('address')}</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{tCommon('notes')}</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
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
