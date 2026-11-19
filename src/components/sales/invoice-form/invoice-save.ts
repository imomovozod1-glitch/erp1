import { callBusinessRpc, RPC_MISSING } from '@/lib/business-rpc'
import { adjustCashboxBalance } from '@/lib/finance/cashbox-balance'
import { invoicePayload, paidDifference, type InvoiceFormData } from './invoice-form-model'

interface InvoiceSave {
  supabase: any
  data: InvoiceFormData
  initial: any
  assignedTo: string | null
  userId: string | null
  paymentLabel: string
}

async function writeInvoice(supabase: any, payload: Record<string, unknown>, id?: string): Promise<string | undefined> {
  if (id) {
    const { error } = await supabase.from('invoices').update(payload).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await supabase.from('invoices').insert([payload]).select().single()
  if (error) throw error
  return data?.id
}

// Pre-migration fallback for `save_invoice`: the invoice, then the cashbox and its transaction.
async function saveInBrowser({ supabase, data, initial, assignedTo, userId, paymentLabel }: InvoiceSave) {
  const invoiceId = await writeInvoice(supabase, invoicePayload(data, initial, assignedTo, userId), initial?.id)
  const difference = paidDifference(data, initial)
  if (difference === 0) return
  const type = difference > 0 ? 'income' : 'expense'
  await adjustCashboxBalance(Math.abs(difference), type, supabase)
  await supabase.from('transactions').insert({
    type,
    amount: Math.abs(difference),
    category: paymentLabel,
    description: `${paymentLabel} #${data.invoice_number}`,
    reference_type: 'invoices',
    reference_id: invoiceId,
    transaction_date: data.paid_at || data.issued_at,
    created_by: initial?.created_by || userId,
  })
}

/** Saves the invoice in one transaction (`save_invoice`); answers whether the paid amount moved. */
export async function saveInvoice(input: InvoiceSave) {
  const payload = invoicePayload(input.data, input.initial, input.assignedTo, input.userId)
  const saved = await callBusinessRpc(input.supabase, 'save_invoice', {
    p_invoice: { ...payload, id: input.initial?.id ?? null, payment_label: input.paymentLabel },
  })
  if (saved === RPC_MISSING) await saveInBrowser(input)
  return paidDifference(input.data, input.initial) !== 0
}
