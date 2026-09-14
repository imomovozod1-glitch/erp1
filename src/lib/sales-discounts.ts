/**
 * Order-level discount maths.
 *
 * Lives outside `lib/data` because it touches no database: it is a pure
 * function over rows somebody else has already read, and both the query layer
 * and the report engine (`lib/reports/engine.ts`) need it. Importing it from
 * the query layer meant the report engine depended on the whole query module
 * just to divide two numbers.
 */

/**
 * A sale can carry a general, order-level discount that is stored ONLY on
 * `sales_orders.discount_amount`; every `sales_order_items.total_price` still holds
 * the pre-discount amount (the per-line `discount_percent` is already baked into it,
 * the general one is not). Summing line items therefore reports more revenue — and
 * more profit — than the customer actually paid: two units at 1500 with a 200 general
 * discount add up to 3000 in the items while the order total is 2800.
 *
 * Returns, per order id, the factor to scale that order's line revenue by, so the
 * lines add back up to `subtotal - discount`. Splitting it proportionally (rather
 * than subtracting it from the order as a whole) keeps per-product revenue and
 * profit correct too.
 */
export function orderDiscountFactors(
  rows: { order_id?: string | null; total_price?: number | null; discount_amount?: number | null }[]
): Map<string, number> {
  const subtotals = new Map<string, number>()
  const discounts = new Map<string, number>()
  for (const row of rows) {
    if (!row.order_id) continue
    subtotals.set(row.order_id, (subtotals.get(row.order_id) ?? 0) + (Number(row.total_price) || 0))
    discounts.set(row.order_id, Number(row.discount_amount) || 0)
  }
  const factors = new Map<string, number>()
  for (const [orderId, subtotal] of subtotals) {
    // A discount can never exceed the order it belongs to, and a zero-subtotal
    // order has nothing to scale.
    const discount = Math.min(Math.max(discounts.get(orderId) ?? 0, 0), subtotal)
    factors.set(orderId, subtotal > 0 ? (subtotal - discount) / subtotal : 1)
  }
  return factors
}
