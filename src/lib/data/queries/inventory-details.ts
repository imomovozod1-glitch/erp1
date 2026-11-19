/** One product's detail page: the row, its ledger, sales, purchases and cost layers. */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { CACHE_TAGS } from './cache-tags'

export const getCachedProductDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    // `costing_method` on tenants postdates the generated Supabase types until
    // `database.types.ts` is regenerated — cast to `any` for that one column.
    const supabase = getCacheClient() as any
    const [
      { data: product },
      { data: movements },
      { data: salesOrderItems },
      { data: purchaseOrderItems },
      { data: costLayers },
      { data: tenant },
    ] = await Promise.all([
      supabase.from('products').select('*, categories(name)').eq('id', id).eq('tenant_id', tenantId).single(),
      supabase.from('stock_movements').select('*').eq('product_id', id).eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('sales_order_items').select('quantity, total_price, sales_orders(order_number, order_date, created_at, status, customers(name))').eq('product_id', id).eq('tenant_id', tenantId),
      supabase.from('purchase_order_items').select('quantity, total_cost, purchase_orders(po_number, order_date, created_at, status, suppliers(name))').eq('product_id', id).eq('tenant_id', tenantId),
      supabase
        .from('inventory_cost_layers')
        .select('id, quantity, remaining_qty, unit_cost, source_type, received_at')
        .eq('product_id', id)
        .eq('tenant_id', tenantId)
        .gt('remaining_qty', 0)
        .order('received_at', { ascending: true }),
      supabase.from('tenants').select('costing_method').eq('id', tenantId).single(),
    ])

    // Resolve where each movement came from: purchase order (+ supplier) or sales order (+ customer)
    const poIds = (movements ?? []).filter((m: any) => m.reference_type === 'purchase_order' && m.reference_id).map((m: any) => m.reference_id)
    const orderIds = (movements ?? []).filter((m: any) => m.reference_type === 'sales_orders' && m.reference_id).map((m: any) => m.reference_id)
    // complete_production_order / cancel_production_order write four kinds of
    // movement under this reference_type — the components out, the finished
    // goods in, and both of those reversed (migration_production.sql).
    const runIds = (movements ?? []).filter((m: any) => m.reference_type === 'production_orders' && m.reference_id).map((m: any) => m.reference_id)

    const [poRes, orderRes, runRes] = await Promise.all([
      poIds.length
        ? supabase.from('purchase_orders').select('id, po_number, suppliers(name)').in('id', poIds).eq('tenant_id', tenantId)
        : Promise.resolve({ data: [] }),
      orderIds.length
        ? supabase.from('sales_orders').select('id, order_number, customers(name)').in('id', orderIds).eq('tenant_id', tenantId)
        : Promise.resolve({ data: [] }),
      runIds.length
        ? supabase.from('production_orders').select('id, order_number').in('id', runIds).eq('tenant_id', tenantId)
        : Promise.resolve({ data: [] }),
    ])

    const poMap = new Map((poRes.data ?? []).map((po: any) => [po.id, po]))
    const orderMap = new Map((orderRes.data ?? []).map((o: any) => [o.id, o]))
    const runMap = new Map((runRes.data ?? []).map((r: any) => [r.id, r]))

    const enrichedMovements = (movements ?? []).map((m: any) => {
      let source: { type: string; label: string; supplierOrCustomer?: string } | null = null
      if (m.reference_type === 'purchase_order' && poMap.has(m.reference_id)) {
        const po: any = poMap.get(m.reference_id)
        source = { type: 'purchase_order', label: po.po_number, supplierOrCustomer: po.suppliers?.name }
      } else if (m.reference_type === 'sales_orders' && orderMap.has(m.reference_id)) {
        const o: any = orderMap.get(m.reference_id)
        source = { type: 'sales_orders', label: o.order_number, supplierOrCustomer: o.customers?.name }
      } else if (m.reference_type === 'production_orders' && runMap.has(m.reference_id)) {
        const run: any = runMap.get(m.reference_id)
        source = { type: 'production_orders', label: run.order_number }
      } else if (m.reference_type === 'initial_stock') {
        source = { type: 'initial_stock', label: '' }
      } else if (m.reference_type === 'product_adjustment') {
        source = { type: 'product_adjustment', label: '' }
      }
      return { ...m, source }
    })

    const layers: any[] = costLayers ?? []
    const effectiveMethod: string = (tenant as any)?.costing_method ?? 'fifo'

    // What the *next* sale would actually be charged under the active method — can
    // differ from products.cost_price (a blended average) under FIFO/LIFO.
    let nextSaleCost: number | null = null
    if (layers.length > 0) {
      if (effectiveMethod === 'lifo') {
        nextSaleCost = Number(layers[layers.length - 1].unit_cost)
      } else if (effectiveMethod === 'fifo') {
        nextSaleCost = Number(layers[0].unit_cost)
      } else {
        const totalQty = layers.reduce((sum: number, l: any) => sum + Number(l.remaining_qty), 0)
        nextSaleCost = totalQty > 0
          ? layers.reduce((sum: number, l: any) => sum + Number(l.remaining_qty) * Number(l.unit_cost), 0) / totalQty
          : null
      }
    }

    return {
      product,
      movements: enrichedMovements,
      sales: salesOrderItems ?? [],
      purchases: purchaseOrderItems ?? [],
      costLayers: layers,
      effectiveCostingMethod: effectiveMethod,
      nextSaleCost,
    }
  },
  ['product-details-by-id'],
  {
    tags: [
      CACHE_TAGS.products,
      CACHE_TAGS.movements,
      CACHE_TAGS.orders,
      CACHE_TAGS.purchaseOrders,
      CACHE_TAGS.productionOrders,
      CACHE_TAGS.tenants,
    ],
    revalidate: 30,
  }
)
