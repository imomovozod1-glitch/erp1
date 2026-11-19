import * as z from 'zod'
import { reconcileInvoiceStatus } from '@/lib/statuses'
import { isoDate } from '@/lib/utils'

const optionalText = z.string().optional().or(z.literal(''))

export function invoiceSchema(required: string, invalidAmount: string) {
  return z.object({
    invoice_number: z.string().min(1, required),
    customer_id: optionalText,
    order_id: optionalText,
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
    total_amount: z.coerce.number().min(0, invalidAmount),
    paid_amount: z.coerce.number().min(0, invalidAmount),
    issued_at: z.string().min(1, required),
    due_at: z.string().min(1, required),
    paid_at: optionalText,
    notes: optionalText,
  })
}

export type InvoiceFormData = z.infer<ReturnType<typeof invoiceSchema>>

const dateOnly = (value?: string | null) => (value ? value.split('T')[0] : '')
const blankAmount = (value: unknown) => (value ?? '') as unknown as number

export const invoiceDefaults = (initial: any): InvoiceFormData => ({
  invoice_number: initial?.invoice_number || '',
  customer_id: initial?.customer_id || '',
  order_id: initial?.order_id || '',
  status: initial?.status || 'draft',
  total_amount: blankAmount(initial?.total_amount),
  paid_amount: blankAmount(initial?.paid_amount),
  issued_at: dateOnly(initial?.issued_at) || isoDate(),
  due_at: dateOnly(initial?.due_at),
  paid_at: dateOnly(initial?.paid_at),
  notes: initial?.notes || '',
})

export function invoicePayload(data: InvoiceFormData, initial: any, assignedTo: string | null, userId: string | null) {
  return {
    ...data,
    customer_id: data.customer_id && data.customer_id !== 'none' ? data.customer_id : null,
    order_id: data.order_id || null,
    paid_at: data.paid_at || null,
    created_by: initial?.created_by || userId,
    assigned_to: assignedTo ?? initial?.assigned_to ?? userId,
    status: reconcileInvoiceStatus(data.status, data.total_amount, Number(data.paid_amount) || 0),
  }
}

export const paidDifference = (data: InvoiceFormData, initial: any) =>
  (Number(data.paid_amount) || 0) - (initial ? Number(initial.paid_amount) || 0 : 0)
