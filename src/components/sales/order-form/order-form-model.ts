import * as z from 'zod'
import { saleLineTotal, saleOrderTotal } from '@/lib/sale-edits'
import { isoDate } from '@/lib/utils'
import type { EditableSaleLine, SaleLineDraft } from '@/components/sales/sale-lines-editor'

export const ORDER_STATUSES = ['draft', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const

export function orderSchema(required: string, invalidAmount: string) {
  return z.object({
    order_number: z.string().min(1, required),
    customer_name: z.string().optional().or(z.literal('')),
    status: z.enum(ORDER_STATUSES),
    total_amount: z.coerce.number().min(0, invalidAmount),
    discount_amount: z.coerce.number().min(0, invalidAmount),
    tax_amount: z.coerce.number().min(0, invalidAmount),
    order_date: z.string().optional().or(z.literal('')),
    delivery_date: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })
}

export type OrderFormData = z.infer<ReturnType<typeof orderSchema>>

const dateOnly = (value?: string | null) => (value ? value.split('T')[0] : '')
const blankAmount = (value: unknown) => (value ?? '') as unknown as number

export const orderDefaults = (initial: any): OrderFormData => ({
  order_number: initial?.order_number || '',
  customer_name: initial?.customer_name || initial?.customer_id || '',
  status: initial?.status || 'draft',
  total_amount: blankAmount(initial?.total_amount),
  discount_amount: blankAmount(initial?.discount_amount),
  tax_amount: blankAmount(initial?.tax_amount),
  order_date: dateOnly(initial?.order_date),
  delivery_date: dateOnly(initial?.delivery_date),
  notes: initial?.notes || '',
})

/** `customer_name` holds the picked customer's id; sales_orders has no such column. */
export function orderPayload(data: OrderFormData, initial: any, assignedTo: string | null, userId: string | null, hasLines: boolean) {
  const { customer_name, order_date, delivery_date, ...rest } = data
  const payload: Record<string, unknown> = {
    ...rest,
    customer_id: customer_name && customer_name !== 'none' ? customer_name : null,
    order_date: order_date || isoDate(),
    delivery_date: delivery_date || null,
    created_by: initial?.created_by || userId,
    assigned_to: assignedTo ?? initial?.assigned_to ?? userId,
  }
  if (hasLines) {
    delete payload.total_amount
    delete payload.discount_amount
  }
  return payload
}

const draftPrice = (line: EditableSaleLine, draft?: SaleLineDraft) =>
  draft && draft.unitPrice !== '' ? Number(draft.unitPrice) : Number(line.unit_price)

export function linesTotal(lines: EditableSaleLine[], drafts: Record<string, SaleLineDraft>, initial: any) {
  const totals = lines
    .filter((line) => !drafts[line.id]?.remove)
    .map((line) => saleLineTotal(draftPrice(line, drafts[line.id]), Number(line.quantity), line.discount_percent))
  return saleOrderTotal(totals, initial?.discount_amount, initial?.tax_amount).total
}

export const lineEditsOf = (drafts: Record<string, SaleLineDraft>) =>
  Object.entries(drafts).map(([id, draft]) => ({
    id,
    unitPrice: draft.unitPrice === '' ? NaN : Number(draft.unitPrice),
    remove: draft.remove,
  }))

export const hasInvalidPrice = (edits: ReturnType<typeof lineEditsOf>) => edits.some((edit) => !edit.remove && !(edit.unitPrice >= 0))
