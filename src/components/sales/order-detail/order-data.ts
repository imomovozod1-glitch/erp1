import { can, dataScope } from '@/lib/permissions'
import { readCallerAccess } from '../document-detail/caller-access'

// Tolerant of failure: the distribution tables are a later migration, and a sale must
// still open on a tenant that has not applied it.
const readDelivery = (supabase: any, orderId: string) =>
  Promise.resolve(
    supabase
      .from('deliveries')
      .select('id, delivery_number, status, planned_date, agent:profiles!deliveries_agent_id_fkey(full_name)')
      .eq('order_id', orderId)
      .neq('status', 'cancelled')
      .maybeSingle()
  ).then(
    ({ data }: any) => data ?? null,
    () => null
  )

export async function fetchOrderData(supabase: any, id: string) {
  const [order, items, access, delivery] = await Promise.all([
    supabase.from('sales_orders').select('*, customers(name)').eq('id', id).single(),
    supabase.from('sales_order_items').select('*, products(name)').eq('order_id', id),
    readCallerAccess(supabase),
    readDelivery(supabase, id),
  ])
  if (order.error) throw order.error
  if (items.error) throw items.error
  const { role, permissions, userId } = access
  return {
    order: order.data,
    items: (items.data ?? []) as any[],
    delivery,
    canEdit: can(role, permissions, 'sales', 'create') || can(role, permissions, 'sales', 'edit'),
    canCancel: can(role, permissions, 'sales', 'edit') && (dataScope(role, permissions, 'sales') === 'all' || order.data.assigned_to === userId),
  }
}

/** The one system-written note (POS: "POS Sale - Paid via CARD") is translated; anything else is user text. */
export function translateOrderNotes(notes: string | null | undefined, t: (key: string, values?: Record<string, string>) => string) {
  if (!notes) return ''
  const pos = notes.match(/^POS Sale - Paid via (CASH|CARD|TRANSFER|DEBT)$/)
  return pos ? t('sales.posSaleNote', { method: t(`sales.posNoteMethod.${pos[1]}`) }) : notes
}
