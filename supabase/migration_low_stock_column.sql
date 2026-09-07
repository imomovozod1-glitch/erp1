-- =============================================================================
-- PERFORMANCE: make "low stock" a database predicate instead of a client filter
-- Safe to run multiple times.
--
-- The header's notification bell asked for EVERY active product
--   .from('products').select('id, name, stock, min_stock, updated_at')
--                    .eq('is_active', true)
-- and then narrowed it in JavaScript with `.filter(p => p.stock <= p.min_stock)`.
-- The same shape ran for unpaid invoices. So every page load — and again every
-- two minutes after — shipped the tenant's entire catalogue to the browser to
-- display, typically, a handful of alerts. On a few thousand products that is
-- megabytes of JSON per navigation and easily the most expensive thing the app
-- does.
--
-- PostgREST can't express a column-to-column comparison in a filter, which is
-- presumably why it was written client-side. A generated column can: it stores
-- the comparison, so the API can filter on it directly and an index can serve
-- it.
--
-- STORED (not VIRTUAL) because the value has to be indexable, and because it is
-- read far more often than stock is written.
-- =============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_low_stock BOOLEAN
  GENERATED ALWAYS AS (stock <= min_stock) STORED;

-- Partial index: the query only ever asks for the `true` side, and low-stock
-- rows are a small minority of the table, so this stays tiny.
CREATE INDEX IF NOT EXISTS idx_products_low_stock
  ON products(tenant_id)
  WHERE is_low_stock AND is_active;

COMMENT ON COLUMN products.is_low_stock IS
  'Generated: stock <= min_stock. Exists so the notification bell can filter server-side instead of downloading every product and filtering in the browser.';

-- Supports the overdue-invoice half of the same query
-- (status IN (sent, overdue) AND due_at < today, ordered by due_at).
CREATE INDEX IF NOT EXISTS idx_invoices_overdue
  ON invoices(tenant_id, due_at)
  WHERE status IN ('sent', 'overdue');
