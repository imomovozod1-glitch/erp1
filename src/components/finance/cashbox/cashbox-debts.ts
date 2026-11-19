import { SUPPLIER_ORDER_COLUMNS, supplierBalance } from '@/lib/supplier-debt'
import { readMirror } from './cashbox-mirror'
import { isOpenInvoiceOf, sumOutstanding } from './invoice-balance'

export interface CustomerBalance {
  debt: number
  credit: number
}

function customerBalanceOffline(customerId: string): CustomerBalance {
  const open = readMirror<any[]>('erp_invoices', []).filter(isOpenInvoiceOf(customerId))
  return { debt: sumOutstanding(open), credit: 0 }
}

async function customerBalanceOnline(supabase: any, customerId: string): Promise<CustomerBalance> {
  const [invoices, customer] = await Promise.all([
    supabase
      .from('invoices')
      .select('total_amount, paid_amount')
      .eq('customer_id', customerId)
      .not('status', 'in', '("paid","cancelled")'),
    supabase.from('customers').select('credit_balance').eq('id', customerId).maybeSingle(),
  ])
  if (invoices.error) throw invoices.error
  if (customer.error) throw customer.error
  return { debt: sumOutstanding(invoices.data ?? []), credit: Number(customer.data?.credit_balance) || 0 }
}

export const loadCustomerBalance = async (supabase: any, customerId: string, offline: boolean) =>
  offline ? customerBalanceOffline(customerId) : customerBalanceOnline(supabase, customerId)

function supplierDebtOffline(supplierId: string) {
  const ofSupplier = (row: any) => row.supplier_id === supplierId
  return supplierBalance(
    readMirror<any[]>('erp_purchase_orders', []).filter(ofSupplier),
    readMirror<any[]>('erp_transactions', []).filter(ofSupplier)
  )
}

async function supplierDebtOnline(supabase: any, supplierId: string) {
  const [orders, paid] = await Promise.all([
    supabase.from('purchase_orders').select(SUPPLIER_ORDER_COLUMNS).eq('supplier_id', supplierId),
    supabase.from('transactions').select('amount, type').eq('supplier_id', supplierId),
  ])
  if (orders.error) throw orders.error
  if (paid.error) throw paid.error
  return supplierBalance(orders.data ?? [], paid.data ?? [])
}

export const loadSupplierDebt = async (supabase: any, supplierId: string, offline: boolean) =>
  offline ? supplierDebtOffline(supplierId) : supplierDebtOnline(supabase, supplierId)
