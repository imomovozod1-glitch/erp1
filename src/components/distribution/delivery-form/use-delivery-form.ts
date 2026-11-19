'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { invalidateDeliveries } from '@/lib/data/revalidate'
import { errorMessage } from '@/lib/error-message'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { createClient } from '@/lib/supabase/client'
import { conflictKey, deliveryPayload, draftFrom, orderOptionsFor, type DeliverableOrder, type DeliveryDraft, type DeliveryRouteOption } from './delivery-model'

async function persist(draft: DeliveryDraft, initial: any) {
  const supabase = createClient() as any
  const { data: auth } = await supabase.auth.getUser()
  const payload = deliveryPayload(draft, initial, auth?.user?.id ?? null)
  if (initial?.id) {
    const { error } = await supabase.from('deliveries').update(payload).eq('id', initial.id)
    if (error) throw error
    return initial.id as string
  }
  const { data, error } = await supabase.from('deliveries').insert([payload]).select('id').single()
  if (error) throw error
  return data.id as string
}

/**
 * An ordinary browser write — the sale already moved stock and money. Picking the sale
 * fills in its customer and address; picking a round suggests its agent as the courier.
 */
export function useDeliveryForm(initial: any, orders: DeliverableOrder[], routes: DeliveryRouteOption[], nextNumber: string, lang: string) {
  const t = useTranslations()
  const router = useRouter()
  const exitForm = useRouteModalExit(`/${lang}/distribution/deliveries`)
  const [draft, setDraft] = useState(() => draftFrom(initial, nextNumber))
  const [submitting, setSubmitting] = useState(false)
  const orderOptions = orderOptionsFor(orders, initial)
  const selectedOrder = orderOptions.find((o) => o.id === draft.orderId)

  const patch = (next: Partial<DeliveryDraft>) => setDraft((current) => ({ ...current, ...next }))

  const chooseOrder = (orderId: string) => {
    const chosen = orderOptions.find((o) => o.id === orderId)
    patch({ orderId, ...(chosen ? { customerId: chosen.customer_id ?? '' } : {}), ...(chosen?.customers?.address ? { address: chosen.customers.address } : {}) })
  }

  const chooseRoute = (routeId: string) => {
    const agent = routes.find((r) => r.id === routeId)?.agent_id
    patch({ routeId, ...(agent && !draft.agentId ? { agentId: agent } : {}) })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.deliveryNumber.trim() || (!draft.orderId && !draft.customerId)) return void toast.error(t('common.required'))
    setSubmitting(true)
    try {
      const id = await persist(draft, initial)
      toast.success(t('common.success'))
      await invalidateDeliveries()
      if (initial?.id) exitForm()
      else router.push(`/${lang}/distribution/deliveries/${id}`)
    } catch (error) {
      const conflict = conflictKey(error)
      toast.error(conflict ? t(`distribution.${conflict}`) : errorMessage(t, error, t('common.error')))
    } finally {
      setSubmitting(false)
    }
  }

  return { draft, patch, orderOptions, selectedOrder, chooseOrder, chooseRoute, submitting, submit, exitForm }
}

export type DeliveryFormState = ReturnType<typeof useDeliveryForm>
