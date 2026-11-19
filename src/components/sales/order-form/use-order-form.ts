'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'
import { invalidateOrders, invalidateSale } from '@/lib/data/revalidate'
import { fireTelegramNotification } from '@/lib/integrations/notify-client'
import { useCurrentUserId } from '@/lib/hooks/use-current-user-id'
import { clearPersistedForm, usePersistedForm } from '@/lib/hooks/use-persisted-form'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { SaleEditError, updateSaleLines, type SaleEditResult } from '@/lib/sale-edits'
import { insufficientCashboxMessage } from '@/lib/sale-messages'
import { formatCurrency } from '@/lib/utils'
import type { EditableSaleLine, SaleLineDraft } from '@/components/sales/sale-lines-editor'
import { hasInvalidPrice, lineEditsOf, linesTotal, orderDefaults, orderPayload, orderSchema, type OrderFormData } from './order-form-model'

const FORM_ID = 'order-form-v3'

interface OrderFormConfig {
  initial: any
  lines: EditableSaleLine[]
  customers: { id: string; name: string }[]
  lang: string
}

export function useOrderForm({ initial, lines, customers, lang }: OrderFormConfig) {
  const t = useTranslations()
  const exitForm = useRouteModalExit(`/${lang}/sales/orders`)
  const userId = useCurrentUserId()
  const [submitting, setSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initial?.assigned_to ?? null)
  const [drafts, setDrafts] = useState<Record<string, SaleLineDraft>>({})
  const form = usePersistedForm<OrderFormData>(FORM_ID, {
    resolver: zodResolver(orderSchema(t('common.required'), t('common.invalidAmount'))) as unknown as Resolver<OrderFormData>,
    defaultValues: orderDefaults(initial),
  })
  const hasLines = !!initial?.id && lines.length > 0
  const oldTotal = Number(initial?.total_amount) || 0
  const total = hasLines ? linesTotal(lines, drafts, initial) : oldTotal

  const updateDraft = (id: string, patch: Partial<SaleLineDraft>) =>
    setDrafts((current) => {
      const line = lines.find((l) => l.id === id)
      const base = current[id] ?? { unitPrice: Number(line?.unit_price) || 0, remove: false }
      return { ...current, [id]: { ...base, ...patch } }
    })

  const editMessage = (result: SaleEditResult) => {
    const cashbox = result.cashboxName ?? ''
    const details = [
      result.cashboxDelta < 0 && t('sales.saleEditRefunded', { amount: formatCurrency(-result.cashboxDelta), cashbox }),
      result.cashboxDelta > 0 && t('sales.saleEditCharged', { amount: formatCurrency(result.cashboxDelta), cashbox }),
      result.creditAdded > 0 && t('sales.cancelSaleCreditRestored', { amount: formatCurrency(result.creditAdded) }),
    ].filter(Boolean)
    toast.success(t('sales.saleEditSaved', { total: formatCurrency(result.newTotal) }), {
      description: details.length ? details.join('. ') : undefined,
    })
  }

  const failure = (error: unknown) => {
    if (!(error instanceof SaleEditError)) return errorMessage(t, error, t('common.error'))
    if (error.code === 'insufficient_cashbox') return insufficientCashboxMessage(t, error.details)
    if (error.code === 'no_lines_left') return t('sales.noLinesLeft')
    if (error.code === 'forbidden') return t('common.noPermission')
    if (error.code === 'not_found') return t('common.recordNotFound')
    return t('sales.cancelSaleAlreadyCancelled')
  }

  const update = async (supabase: any, payload: Record<string, unknown>) => {
    const edits = lineEditsOf(drafts)
    const actor = userId ?? (await supabase.auth.getSession()).data.session?.user?.id ?? null
    const result = hasLines && edits.length ? await updateSaleLines(supabase, initial.id, edits, actor) : null
    const { error } = await supabase.from('sales_orders').update(payload).eq('id', initial.id)
    if (error) throw error
    if (!result?.changed) return void toast.success(t('common.success'))
    void invalidateSale().catch(() => {})
    editMessage(result)
  }

  const create = async (supabase: any, payload: Record<string, any>) => {
    const { error } = await supabase.from('sales_orders').insert([payload])
    if (error) throw error
    toast.success(t('common.success'))
    fireTelegramNotification({
      event: 'new_order',
      data: {
        orderNumber: payload.order_number,
        total: Number(payload.total_amount) || 0,
        customerName: customers.find((c) => c.id === payload.customer_id)?.name ?? null,
      },
    })
  }

  const submit = async (data: OrderFormData) => {
    if (!userId && !initial) return void toast.error(t('common.sessionNotFound'))
    if (hasInvalidPrice(lineEditsOf(drafts))) return void toast.error(t('sales.priceRequired'))
    setSubmitting(true)
    try {
      const supabase = createClient()
      const payload = orderPayload(data, initial, assignedTo, userId, hasLines)
      await (initial?.id ? update(supabase, payload) : create(supabase, payload))
      await invalidateOrders()
      clearPersistedForm(FORM_ID)
      exitForm()
    } catch (error) {
      toast.error(failure(error))
    } finally {
      setSubmitting(false)
    }
  }

  return {
    form,
    onSubmit: form.handleSubmit(submit),
    submitting,
    userId,
    assignedTo,
    setAssignedTo,
    drafts,
    updateDraft,
    hasLines,
    total,
    oldTotal,
    exitForm,
  }
}

export type OrderFormState = ReturnType<typeof useOrderForm>
