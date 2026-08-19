-- Customer categories (mijozlar toifalari).
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS customer_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customer_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated_read_customer_categories" ON customer_categories FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_write_customer_categories" ON customer_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TRIGGER IF EXISTS update_customer_categories_updated_at ON customer_categories;
CREATE TRIGGER update_customer_categories_updated_at BEFORE UPDATE ON customer_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customers ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES customer_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_category ON customers(category_id);
