-- FIFO / LIFO / AVECO inventory costing.
-- Safe to run multiple times.

-- =============================================
-- ENUM
-- =============================================

DO $$ BEGIN
  CREATE TYPE costing_method AS ENUM ('fifo', 'lifo', 'aveco');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- COST LAYERS (one row per stock-IN event)
-- =============================================

CREATE TABLE IF NOT EXISTS inventory_cost_layers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  remaining_qty INTEGER NOT NULL,
  unit_cost DECIMAL(12, 2) NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_product_received
  ON inventory_cost_layers(product_id, received_at);

ALTER TABLE inventory_cost_layers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated_read_inventory_cost_layers" ON inventory_cost_layers FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_write_inventory_cost_layers" ON inventory_cost_layers FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- COMPANY SETTINGS (single row — global costing default)
-- =============================================

CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  default_costing_method costing_method NOT NULL DEFAULT 'fifo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated_read_company_settings" ON company_settings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_write_company_settings" ON company_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TRIGGER IF EXISTS update_company_settings_updated_at ON company_settings;
CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON company_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO company_settings (default_costing_method)
SELECT 'fifo' WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- =============================================
-- NEW COLUMNS
-- =============================================

-- NULL = inherit company_settings.default_costing_method.
ALTER TABLE products ADD COLUMN IF NOT EXISTS costing_method costing_method;

-- Realized COGS/unit at the moment of sale (per whichever method was active then).
-- NULL on pre-migration rows — reporting queries fall back to cost_price * qty for those.
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12, 2);

-- Realized cost for any movement (covers non-sale write-offs/adjustments too).
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12, 2);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12, 2);

-- =============================================
-- OPENING BALANCE — seed one layer per product's current stock,
-- so FIFO/LIFO have something to consume from immediately after migrating.
-- =============================================

INSERT INTO inventory_cost_layers (product_id, quantity, remaining_qty, unit_cost, source_type, received_at)
SELECT p.id, p.stock, p.stock, p.cost_price, 'opening_balance', NOW()
FROM products p
WHERE p.stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM inventory_cost_layers l WHERE l.product_id = p.id AND l.source_type = 'opening_balance'
  );
