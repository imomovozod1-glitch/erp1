import type { StatusTone } from '@/components/shared/status-badge'

/**
 * One source of truth for every document status in the app.
 *
 * Before this module each table and detail page carried its own tone map, and
 * they had drifted apart (an order was blue in one place and slate in another,
 * a cancelled invoice slate here and rose there). Worse, the message catalogues
 * had collapsed five different order statuses onto the single label "New", so
 * the badge could not tell a draft from a shipped order.
 *
 * Tones follow AGENTS.md §2: emerald = done, blue = in progress, indigo =
 * highlight, amber = needs attention, rose = cancelled/failed, slate = draft.
 */

export const ORDER_STATUSES = [
  'draft',
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const PURCHASE_STATUSES = [
  'draft',
  'sent',
  'partially_received',
  'received',
  'cancelled',
] as const
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]

export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  draft: 'slate',
  pending: 'amber',
  confirmed: 'blue',
  shipped: 'indigo',
  delivered: 'emerald',
  cancelled: 'rose',
}

export const INVOICE_STATUS_TONES: Record<InvoiceStatus, StatusTone> = {
  draft: 'slate',
  sent: 'blue',
  paid: 'emerald',
  overdue: 'amber',
  cancelled: 'rose',
}

export const PURCHASE_STATUS_TONES: Record<PurchaseStatus, StatusTone> = {
  draft: 'slate',
  sent: 'blue',
  partially_received: 'amber',
  received: 'emerald',
  cancelled: 'rose',
}

export function orderStatusTone(status: string): StatusTone {
  return ORDER_STATUS_TONES[status as OrderStatus] ?? 'slate'
}

export function invoiceStatusTone(status: string): StatusTone {
  return INVOICE_STATUS_TONES[status as InvoiceStatus] ?? 'slate'
}

export function purchaseStatusTone(status: string): StatusTone {
  return PURCHASE_STATUS_TONES[status as PurchaseStatus] ?? 'slate'
}

/**
 * Which statuses a document may move to next.
 *
 * Terminal states (delivered / paid / received / cancelled) list nothing: a
 * finished document is corrected by a new one, not by being walked backwards,
 * because the stock and cash effects behind it have already happened.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['confirmed', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'cancelled'],
  overdue: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
}

export const PURCHASE_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['partially_received', 'received', 'cancelled'],
  partially_received: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

export function nextOrderStatuses(status: string): OrderStatus[] {
  return ORDER_TRANSITIONS[status as OrderStatus] ?? []
}

export function nextInvoiceStatuses(status: string): InvoiceStatus[] {
  return INVOICE_TRANSITIONS[status as InvoiceStatus] ?? []
}

/**
 * The status an invoice should be *shown* with.
 *
 * `overdue` is never written to the database — nothing runs on a schedule to
 * flip it — so an unpaid invoice past its due date stayed labelled "sent"
 * everywhere except the notification bell, which computed the same thing by
 * hand. Deriving it on read keeps the badge honest without a cron job, and the
 * stored value stays whatever a human actually set.
 */
export function effectiveInvoiceStatus(invoice: {
  status: string
  due_at?: string | null
  total_amount?: number | string | null
  paid_amount?: number | string | null
}): InvoiceStatus {
  const status = invoice.status as InvoiceStatus
  if (status !== 'sent') return status
  if (!invoice.due_at) return status
  const outstanding = (Number(invoice.total_amount) || 0) - (Number(invoice.paid_amount) || 0)
  if (outstanding <= 0) return status
  // Compare dates only: an invoice due today is not late yet.
  const today = new Date().toISOString().split('T')[0]
  return String(invoice.due_at).split('T')[0] < today ? 'overdue' : status
}

/**
 * Reconciles the status a user picked on the invoice form with the money
 * actually recorded on it.
 *
 * The form used to let anyone pick `paid` while leaving the paid amount at
 * zero (and vice versa), so the invoice list, the receivables total and the
 * cashbox could all disagree about the same document. Payment is now expressed
 * by one thing only — the paid amount — and the status follows from it.
 */
export function reconcileInvoiceStatus(
  chosen: string,
  totalAmount: number | string | null | undefined,
  paidAmount: number | string | null | undefined
): InvoiceStatus {
  if (chosen === 'cancelled') return 'cancelled'
  const total = Number(totalAmount) || 0
  const paid = Number(paidAmount) || 0
  if (total > 0 && paid >= total) return 'paid'
  // Anything not fully paid is at most "sent"; `overdue` is derived on read by
  // `effectiveInvoiceStatus`, never stored.
  if (chosen === 'paid' || chosen === 'overdue') return 'sent'
  return (chosen as InvoiceStatus) ?? 'draft'
}

/** True when the document can still be worked on (i.e. is not in a terminal state). */
export function isOpenStatus(status: string): boolean {
  return status !== 'cancelled' && status !== 'delivered' && status !== 'paid' && status !== 'received'
}
