'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { FormFooter } from '@/components/shared/form-footer'
import { LabeledField } from '@/components/shared/labeled-field'
import { NameSelect } from '@/components/shared/name-select'
import type { DeliverableOrder, DeliveryRouteOption } from '@/components/distribution/delivery-form/delivery-model'
import { useDeliveryForm, type DeliveryFormState } from '@/components/distribution/delivery-form/use-delivery-form'
import { formatCurrency } from '@/lib/utils'

export type { DeliverableOrder, DeliveryRouteOption } from '@/components/distribution/delivery-form/delivery-model'

interface DeliveryFormProps {
  assignableUsers: AssignableUser[]
  orders: DeliverableOrder[]
  routes: DeliveryRouteOption[]
  initialData?: any
  nextNumber: string
  lang: string
}

function OrderField({ state }: { state: DeliveryFormState }) {
  const t = useTranslations('distribution')
  const options = state.orderOptions.map((o) => ({ id: o.id, name: o.order_number, customer: o.customers?.name ?? '—', total: Number(o.total_amount) || 0 }))
  return (
    <LabeledField id="order_id" label={t('order')}>
      <NameSelect
        id="order_id"
        value={state.draft.orderId}
        onChange={state.chooseOrder}
        options={options}
        placeholder={t('noOrderLink')}
        clearLabel={t('noOrderLink')}
        meta={(o) => <span className="text-xs text-muted-foreground">{`${o.customer} · ${formatCurrency(o.total)}`}</span>}
      />
      {options.length === 0 && <p className="text-[11px] leading-snug text-muted-foreground">{t('noDeliverableOrders')}</p>}
    </LabeledField>
  )
}

function MainFields({ state, routes, users, initial, lang }: { state: DeliveryFormState; routes: DeliveryRouteOption[]; users: AssignableUser[]; initial: any; lang: string }) {
  const t = useTranslations()
  const { draft, patch } = state
  const agents = users.map((u) => ({ id: u.id, name: u.full_name || '—' }))
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      <LabeledField id="delivery_number" label={t('distribution.deliveryNumber')} required>
        <Input id="delivery_number" value={draft.deliveryNumber} onChange={(e) => patch({ deliveryNumber: e.target.value })} />
      </LabeledField>
      <OrderField state={state} />
      {/* Taken from the sale, not typed: two records of who it is for would eventually disagree. */}
      <LabeledField id="customer" label={t('distribution.customer')}>
        <div id="customer" className="flex h-9 w-full items-center rounded-xl border border-input bg-muted/50 px-3 text-sm text-foreground max-md:h-10">
          {state.selectedOrder?.customers?.name ?? initial?.customer?.name ?? '—'}
        </div>
      </LabeledField>
      <LabeledField id="route_id" label={t('distribution.route')}>
        <NameSelect id="route_id" value={draft.routeId} onChange={state.chooseRoute} options={routes} placeholder={t('common.select')} clearLabel={t('common.select')} />
      </LabeledField>
      <LabeledField id="agent_id" label={t('distribution.courier')}>
        <NameSelect id="agent_id" value={draft.agentId} onChange={(agentId) => patch({ agentId })} options={agents} placeholder={t('distribution.noAgent')} clearLabel={t('distribution.noAgent')} />
      </LabeledField>
      <LabeledField id="planned_date" label={t('distribution.plannedDate')}>
        <DatePicker id="planned_date" value={draft.plannedDate} onChange={(plannedDate) => patch({ plannedDate })} lang={lang} placeholder={t('distribution.plannedDate')} />
      </LabeledField>
    </div>
  )
}

/** Yetkazib berish — one sale on its way to a customer. */
export function DeliveryForm({ initialData, orders, routes, assignableUsers, nextNumber, lang }: DeliveryFormProps) {
  const t = useTranslations()
  const state = useDeliveryForm(initialData, orders, routes, nextNumber, lang)
  const { draft, patch } = state
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>{t(initialData ? 'distribution.editDelivery' : 'distribution.addDelivery')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={state.submit} className="space-y-6">
          <MainFields state={state} routes={routes} users={assignableUsers} initial={initialData} lang={lang} />
          <LabeledField id="address" label={t('distribution.address')}>
            <Input id="address" value={draft.address} onChange={(e) => patch({ address: e.target.value })} />
          </LabeledField>
          <LabeledField id="notes" label={t('common.notes')}>
            <Textarea id="notes" value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} rows={3} />
          </LabeledField>
          <div className="max-w-sm">
            <AssigneeSelect value={draft.assignedTo} onChange={(assignedTo) => patch({ assignedTo })} users={assignableUsers} />
          </div>
          <FormFooter>
            <Button type="button" variant="outline" onClick={() => state.exitForm()} disabled={state.submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={state.submitting}>
              {state.submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </FormFooter>
        </form>
      </CardContent>
    </Card>
  )
}
