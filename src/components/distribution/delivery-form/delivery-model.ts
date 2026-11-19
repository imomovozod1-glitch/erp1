import { isoDate } from '@/lib/utils'

export interface DeliverableOrder {
  id: string
  order_number: string
  status: string
  total_amount: number
  customer_id: string | null
  customers?: { id: string; name: string; phone?: string | null; address?: string | null } | null
}

export interface DeliveryRouteOption {
  id: string
  name: string
  agent_id: string | null
}

export interface DeliveryDraft {
  deliveryNumber: string
  orderId: string
  customerId: string
  routeId: string
  agentId: string
  plannedDate: string
  address: string
  notes: string
  assignedTo: string | null
}

export const draftFrom = (initial: any, nextNumber: string): DeliveryDraft => ({
  deliveryNumber: initial?.delivery_number || nextNumber,
  orderId: initial?.order_id || '',
  customerId: initial?.customer_id || '',
  routeId: initial?.route_id || '',
  agentId: initial?.agent_id || '',
  plannedDate: initial?.planned_date || isoDate(),
  address: initial?.address || '',
  notes: initial?.notes || '',
  assignedTo: initial?.assigned_to ?? null,
})

/** An edit keeps its own sale in the list even though that sale is no longer "deliverable". */
export function orderOptionsFor(orders: DeliverableOrder[], initial: any): DeliverableOrder[] {
  if (!initial?.order_id || orders.some((o) => o.id === initial.order_id)) return orders
  const own: DeliverableOrder = {
    id: initial.order_id,
    order_number: initial.order?.order_number ?? initial.order_id,
    status: initial.order?.status ?? '',
    total_amount: Number(initial.order?.total_amount) || 0,
    customer_id: initial.customer_id ?? null,
    customers: initial.customer ?? null,
  }
  return [own, ...orders]
}

export const deliveryPayload = (draft: DeliveryDraft, initial: any, userId: string | null) => ({
  delivery_number: draft.deliveryNumber.trim(),
  order_id: draft.orderId || null,
  customer_id: draft.customerId || null,
  route_id: draft.routeId || null,
  agent_id: draft.agentId || null,
  planned_date: draft.plannedDate || null,
  address: draft.address.trim() || null,
  notes: draft.notes.trim() || null,
  assigned_to: draft.assignedTo ?? initial?.assigned_to ?? userId,
  created_by: initial?.created_by ?? userId,
})

/** Two unique rules answer 23505; naming the wrong one would send the user chasing the wrong thing. */
export function conflictKey(error: any): 'orderAlreadyHasDelivery' | 'duplicateNumber' | null {
  if (error?.code !== '23505') return null
  return `${error.message ?? ''}${error.details ?? ''}`.includes('uniq_deliveries_live_order') ? 'orderAlreadyHasDelivery' : 'duplicateNumber'
}
