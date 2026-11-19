import { callBusinessRpc, RPC_MISSING } from '@/lib/business-rpc'
import { can, dataScope } from '@/lib/permissions'
import { depositToCashbox, findSaleCashbox } from '@/lib/finance/cashbox-balance'
import { isoDate } from '@/lib/utils'
import { readCallerAccess } from '../document-detail/caller-access'

export async function fetchInvoiceData(supabase: any, id: string) {
  const [{ data: invoice, error }, access] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, customers(name), sales_orders(order_number, sales_order_items(*, products(name)))')
      .eq('id', id)
      .single(),
    readCallerAccess(supabase),
  ])
  if (error) throw error
  const canEdit =
    can(access.role, access.permissions, 'sales', 'edit') &&
    (dataScope(access.role, access.permissions, 'sales') === 'all' || invoice.assigned_to === access.userId)
  return { invoice, items: (invoice.sales_orders?.sales_order_items ?? []) as any[], canEdit }
}

// Pre-migration fallback for `accept_invoice_payment`: the remainder goes into the main cashbox and is
// booked against it, so it appears in that cashbox's history.
async function acceptInBrowser(supabase: any, invoice: any) {
  const { error } = await supabase
    .from('invoices')
    .update({ paid_amount: invoice.total_amount, status: 'paid', paid_at: isoDate() })
    .eq('id', invoice.id)
  if (error) throw error
  const { data } = await supabase.auth.getUser()
  const remaining = Number(invoice.total_amount) - Number(invoice.paid_amount)
  if (!data?.user?.id || remaining <= 0) return
  const cashbox = await findSaleCashbox(supabase)
  if (cashbox) await depositToCashbox(supabase, cashbox.id, remaining)
  await supabase.from('transactions').insert([
    {
      type: 'income',
      amount: remaining,
      category: 'sales',
      description: `${invoice.invoice_number} uchun tezkor to'lov`,
      reference_type: cashbox ? 'cashbox' : 'invoice',
      reference_id: cashbox?.id ?? invoice.id,
      customer_id: invoice.customer_id ?? null,
      transaction_date: isoDate(),
      created_by: data.user.id,
    },
  ])
}

/** Marks the invoice paid, records the income and puts the money in the main cashbox — one transaction. */
export async function acceptInvoicePayment(supabase: any, invoice: any) {
  const result = await callBusinessRpc(supabase, 'accept_invoice_payment', { p_invoice_id: invoice.id, p_paid_at: isoDate() })
  if (result === RPC_MISSING) await acceptInBrowser(supabase, invoice)
}
