-- Safe to run multiple times.

DO $$ BEGIN
  CREATE TYPE transaction_person_type AS ENUM ('employee', 'supplier', 'customer', 'none');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE cashbox_type AS ENUM ('cash', 'card', 'transfer', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS transaction_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type transaction_type NOT NULL,
  person_type transaction_person_type NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated_read_transaction_categories" ON transaction_categories FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_write_transaction_categories" ON transaction_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TRIGGER IF EXISTS update_transaction_categories_updated_at ON transaction_categories;
CREATE TRIGGER update_transaction_categories_updated_at BEFORE UPDATE ON transaction_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE cashboxes ADD COLUMN IF NOT EXISTS type cashbox_type NOT NULL DEFAULT 'cash';

INSERT INTO transaction_categories (name, type, person_type)
SELECT * FROM (VALUES
  ('Sotuv', 'income'::transaction_type, 'none'::transaction_person_type),
  ('Xizmat', 'income'::transaction_type, 'none'::transaction_person_type),
  ('Mijozdan qarz undirish', 'income'::transaction_type, 'customer'::transaction_person_type),
  ('Boshqa daromad', 'income'::transaction_type, 'none'::transaction_person_type),
  ('Maosh', 'expense'::transaction_type, 'employee'::transaction_person_type),
  ('Yetkazib beruvchiga to''lov', 'expense'::transaction_type, 'supplier'::transaction_person_type),
  ('Ijara', 'expense'::transaction_type, 'none'::transaction_person_type),
  ('Kommunal xizmatlar', 'expense'::transaction_type, 'none'::transaction_person_type),
  ('Marketing', 'expense'::transaction_type, 'none'::transaction_person_type),
  ('Ta''minotlar', 'expense'::transaction_type, 'none'::transaction_person_type),
  ('Boshqa xarajat', 'expense'::transaction_type, 'none'::transaction_person_type)
) AS v(name, type, person_type)
WHERE NOT EXISTS (SELECT 1 FROM transaction_categories);
