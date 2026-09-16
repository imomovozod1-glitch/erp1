'use client'

import { useState, useEffect } from 'react'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { Resolver, Controller, useWatch } from 'react-hook-form'
import { usePersistedForm, clearPersistedForm } from '@/lib/hooks/use-persisted-form'
import { NumericInput } from '@/components/ui/numeric-input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import {
  invalidateAnalytics,
  invalidateCashbox,
  invalidateCustomers,
  invalidateInvoices,
  invalidateMovements,
  invalidateOrderItems,
  invalidateOrders,
  invalidateProducts,
  invalidateTransactions,
} from '@/lib/data/revalidate'
import { SaleEditError, saleLineTotal, saleOrderTotal, updateSaleLines, type SaleEditResult } from '@/lib/sale-edits'
import { SaleLinesEditor, type EditableSaleLine, type SaleLineDraft } from '@/components/sales/sale-lines-editor'
import { nextOrderStatuses } from '@/lib/statuses'
import { fireTelegramNotification } from '@/lib/integrations/notify-client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { formatCurrency, isoDate } from '@/lib/utils'

interface OrderFormProps {
  initialData?: any
  /** The sale's lines, when editing an existing order. */
  items?: EditableSaleLine[]
  customers: any[]
  /** Active tenant members who can be made responsible for the order. */
  assignableUsers: AssignableUser[]
  lang: string
}

function getTodayString(): string {
  return isoDate()
}

export function OrderForm({ initialData, items = [], customers, assignableUsers, lang }: OrderFormProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('sales')
  const exitForm = useRouteModalExit(`/${lang}/sales/orders`)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any
  const [userId, setUserId] = useState<string | null>(null)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const [lineDrafts, setLineDrafts] = useState<Record<string, SaleLineDraft>>({})

  // A sale with lines gets its total from them — typing a total by hand used to
  // let it drift away from what the cashbox and the customer's debt hold.
  const hasLines = !!initialData?.id && items.length > 0
  const isCancelledOrder = initialData?.status === 'cancelled'
  const oldTotal = Number(initialData?.total_amount) || 0
  const computedTotal = hasLines
    ? saleOrderTotal(
        items
          .filter((line) => !lineDrafts[line.id]?.remove)
          .map((line) => {
            const draft = lineDrafts[line.id]
            const price = draft && draft.unitPrice !== '' ? Number(draft.unitPrice) : Number(line.unit_price)
            return saleLineTotal(price, Number(line.quantity), line.discount_percent)
          }),
        initialData?.discount_amount,
        initialData?.tax_amount
      ).total
    : oldTotal

  const updateLineDraft = (id: string, patch: Partial<SaleLineDraft>) => {
    setLineDrafts((prev) => {
      const line = items.find((l) => l.id === id)
      const current = prev[id] ?? { unitPrice: Number(line?.unit_price) || 0, remove: false }
      return { ...prev, [id]: { ...current, ...patch } }
    })
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase.auth])

  const innerFormSchema = z.object({
    order_number: z.string().min(1, tCommon('required')),
    customer_name: z.string().optional().or(z.literal('')),
    status: z.enum(['draft', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
    total_amount: z.coerce.number().min(0),
    discount_amount: z.coerce.number().min(0),
    tax_amount: z.coerce.number().min(0),
    order_date: z.string().optional().or(z.literal('')),
    delivery_date: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })

  type FormData = z.infer<typeof innerFormSchema>

  const [defaultOrderNumber] = useState(() => initialData?.order_number || '')

  const { register, handleSubmit, setValue, control, formState: { errors } } = usePersistedForm<FormData>('order-form-v3', {
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      order_number: defaultOrderNumber,
      customer_name: initialData?.customer_name || '',
      status: initialData?.status || 'draft',
      total_amount: initialData?.total_amount ?? '' as any,
      discount_amount: initialData?.discount_amount ?? '' as any,
      tax_amount: initialData?.tax_amount ?? '' as any,
      order_date: initialData?.order_date ? initialData.order_date.split('T')[0] : '',
      delivery_date: initialData?.delivery_date ? initialData.delivery_date.split('T')[0] : '',
      notes: initialData?.notes || '',
    },
  })

  const onSubmit = async (data: any) => {
    if (!userId && !initialData) {
      toast.error(lang === 'uz' ? 'Foydalanuvchi seansi topilmadi' : lang === 'ru' ? 'Сессия пользователя не найдена' : 'User session not found')
      return
    }

    const lineEdits = Object.entries(lineDrafts).map(([id, draft]) => ({
      id,
      unitPrice: draft.unitPrice === '' ? NaN : Number(draft.unitPrice),
      remove: draft.remove,
    }))
    if (lineEdits.some((edit) => !edit.remove && !(edit.unitPrice >= 0))) {
      toast.error(t('priceRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      // `customer_name` is a form-only field (it actually holds the selected
      // customer's id) — sales_orders has no such column, so spreading `data`
      // wholesale made every insert/update fail in PostgREST with
      // "Could not find the 'customer_name' column of 'sales_orders'".
      // Build the payload from the real columns explicitly instead.
      // Empty date strings must become NULL too — '' is not a valid DATE.
      const { customer_name, order_date, delivery_date, ...rest } = data
      const payload = {
        ...rest,
        customer_id: (customer_name && customer_name !== 'none') ? customer_name : null,
        order_date: order_date || getTodayString(),
        delivery_date: delivery_date || null,
        created_by: initialData?.created_by || userId,
        // Responsible person. Falls back to the creator so a document is never
        // left unassigned — an unassigned document is invisible to everyone
        // whose data scope is 'own'.
        assigned_to: assignedTo ?? initialData?.assigned_to ?? userId,
      }

      if (initialData?.id) {
        // Lines first: that is the step that can refuse (cashbox short of the
        // refund), and it owns the order total when the sale has lines.
        let lineResult: SaleEditResult | null = null
        if (hasLines && lineEdits.length > 0) {
          const { data: { session } } = await supabase.auth.getSession()
          lineResult = await updateSaleLines(supabase, initialData.id, lineEdits, session?.user?.id ?? userId)
        }
        if (hasLines) {
          delete (payload as any).total_amount
          delete (payload as any).discount_amount
        }

        const { error } = await supabase
          .from('sales_orders')
          .update(payload)
          .eq('id', initialData.id)
        if (error) throw error

        if (lineResult?.changed) {
          void Promise.all([
            invalidateOrderItems(),
            invalidateProducts(),
            invalidateMovements(),
            invalidateInvoices(),
            invalidateTransactions(),
            invalidateCustomers(),
            invalidateCashbox(),
            invalidateAnalytics(),
          ]).catch(() => {})
          const details = [
            lineResult.cashboxDelta < 0 &&
              t('saleEditRefunded', {
                amount: formatCurrency(-lineResult.cashboxDelta),
                cashbox: lineResult.cashboxName ?? '',
              }),
            lineResult.cashboxDelta > 0 &&
              t('saleEditCharged', {
                amount: formatCurrency(lineResult.cashboxDelta),
                cashbox: lineResult.cashboxName ?? '',
              }),
            lineResult.creditAdded > 0 &&
              t('cancelSaleCreditRestored', { amount: formatCurrency(lineResult.creditAdded) }),
          ].filter(Boolean)
          toast.success(t('saleEditSaved', { total: formatCurrency(lineResult.newTotal) }), {
            description: details.length > 0 ? details.join('. ') : undefined,
          })
        } else {
          toast.success(tCommon('success'))
        }
      } else {
        const { error } = await supabase
          .from('sales_orders')
          .insert([payload])
        if (error) throw error
        toast.success(tCommon('success'))

        // Telegram notification (Settings → Integrations). Only on create —
        // an edit isn't a "new order". Fire-and-forget: the order is already
        // committed, so a Telegram failure must not surface as a failed save.
        fireTelegramNotification({
          event: 'new_order',
          data: {
            orderNumber: payload.order_number,
            total: Number(payload.total_amount) || 0,
            customerName: customers.find((c) => c.id === payload.customer_id)?.name ?? null,
          },
        })
      }

      await invalidateOrders()
      clearPersistedForm('order-form-v3')
      exitForm()
    } catch (error: any) {
      if (error instanceof SaleEditError) {
        toast.error(
          error.code === 'insufficient_cashbox'
            ? t('cancelSaleInsufficient', {
                cashbox: error.details.cashboxName ?? '—',
                balance: formatCurrency(error.details.balance ?? 0),
                amount: formatCurrency(error.details.amount ?? 0),
              })
            : error.code === 'no_lines_left'
              ? t('noLinesLeft')
              : t('cancelSaleAlreadyCancelled')
        )
      } else {
        toast.error(error.message || tCommon('error'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusValue = useWatch({ control, name: 'status' })
  // Only the transitions this order may actually make, plus its current value.
  // `cancelled` is deliberately absent: cancelling has to put the goods back
  // into stock, which the list's row action does via `cancelSalesOrder` — a
  // plain column write from here would silently lose the inventory.
  const currentStatus: string = initialData?.status ?? 'draft'
  const statusOptions = [
    currentStatus,
    ...nextOrderStatuses(currentStatus).filter((next) => next !== 'cancelled'),
  ]
  const customerIdValue = useWatch({ control, name: 'customer_name' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="order_number">{t('orderNumber')} *</Label>
          <Input id="order_number" {...register('order_number')} />
          {errors.order_number && <p className="text-sm text-red-500">{errors.order_number.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_name">{t('customer')}</Label>
          <Select value={customerIdValue || 'none'} onValueChange={(val) => setValue('customer_name', val || '')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectCustomer')}>
                {customerIdValue && customerIdValue !== 'none'
                  ? customers.find((c) => c.id === customerIdValue)?.name
                  : tCommon('none')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{tCommon('none')}</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.customer_name && <p className="text-sm text-red-500">{errors.customer_name.message}</p>}
        </div>

        <div className="space-y-2">
          <AssigneeSelect
            value={assignedTo}
            onChange={setAssignedTo}
            users={assignableUsers}
            currentUserId={userId}
          />
        </div>


        <div className="space-y-2">
          <Label htmlFor="status">{tCommon('status')}</Label>
          <Select value={statusValue} onValueChange={(val: any) => setValue('status', val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectStatus')}>
                {statusValue ? t(`status.${statusValue}`) : ''}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`status.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="order_date">{t('orderDate')}</Label>
          <Controller
            control={control}
            name="order_date"
            render={({ field }) => (
              <DatePicker
                id="order_date"
                value={field.value}
                onChange={field.onChange}
                lang={lang}
                placeholder={t('orderDate')}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_amount">{tCommon('total')}</Label>
          {hasLines ? (
            <Input
              id="total_amount"
              readOnly
              value={formatCurrency(computedTotal)}
              className="bg-slate-50 dark:bg-slate-800 font-semibold tabular-nums"
            />
          ) : (
            <Controller
              control={control}
              name="total_amount"
              render={({ field: { onChange, value } }) => (
                <NumericInput id="total_amount" value={value} onChange={onChange} />
              )}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="delivery_date">{t('deliveryDate')}</Label>
          <Controller
            control={control}
            name="delivery_date"
            render={({ field }) => (
              <DatePicker
                id="delivery_date"
                value={field.value}
                onChange={field.onChange}
                lang={lang}
                placeholder={t('deliveryDate')}
              />
            )}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">{tCommon('notes')}</Label>
          <Textarea id="notes" {...register('notes')} rows={3} />
        </div>
      </div>

      {hasLines && (
        <SaleLinesEditor
          lines={items}
          drafts={lineDrafts}
          onChange={updateLineDraft}
          newTotal={computedTotal}
          oldTotal={oldTotal}
          disabled={isSubmitting || isCancelledOrder}
        />
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => exitForm()}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
