-- =============================================================================
-- FRACTIONAL QUANTITIES (kg, litr, metr …)
-- Safe to run multiple times.
--
-- Why: the UI already lets a non-"dona" unit be typed with a decimal point
-- (`unitAllowsDecimals` in src/lib/units.ts), but every quantity column was
-- INTEGER. Postgres applies an *assignment cast* on INSERT/UPDATE, which
-- ROUNDS silently — selling 1.3 kg stored 1, and the stock, the cost layers and
-- the movement log all drifted with it. No error was ever raised, so the sale
-- simply came out wrong.
--
-- DECIMAL(12, 3) gives gram/millilitre resolution while staying exact (never
-- float), matching how money is already stored as DECIMAL(12, 2).
-- =============================================================================

ALTER TABLE products
  ALTER COLUMN stock TYPE DECIMAL(12, 3),
  ALTER COLUMN min_stock TYPE DECIMAL(12, 3),
  ALTER COLUMN max_stock TYPE DECIMAL(12, 3);

ALTER TABLE sales_order_items
  ALTER COLUMN quantity TYPE DECIMAL(12, 3);

ALTER TABLE purchase_order_items
  ALTER COLUMN quantity TYPE DECIMAL(12, 3),
  ALTER COLUMN received_qty TYPE DECIMAL(12, 3);

ALTER TABLE stock_movements
  ALTER COLUMN quantity TYPE DECIMAL(12, 3),
  ALTER COLUMN quantity_before TYPE DECIMAL(12, 3),
  ALTER COLUMN quantity_after TYPE DECIMAL(12, 3);

-- Cost layers are consumed FIFO/LIFO by these same quantities, so they have to
-- carry the same resolution or a fractional sale can never fully drain a layer.
ALTER TABLE inventory_cost_layers
  ALTER COLUMN quantity TYPE DECIMAL(12, 3),
  ALTER COLUMN remaining_qty TYPE DECIMAL(12, 3);
