/**
 * Telling a service apart from a product.
 *
 * Both are rows of `products`; `is_service` (migration_services.sql) is the
 * only thing that separates them. A service has no quantity on a shelf, so
 * every rule written around `stock` — "sold out", "below the minimum", "you
 * cannot sell more than you have" — is meaningless for one and has to be
 * skipped rather than evaluated against its permanent zero.
 *
 * Kept as a function rather than inlining `p.is_service`: the column is absent
 * from rows read by code paths that predate it (and from the stale generated
 * types), where `undefined` must read as "a product", not as a missing value.
 */

export function isService(product: { is_service?: boolean | null } | null | undefined): boolean {
  return product?.is_service === true
}
