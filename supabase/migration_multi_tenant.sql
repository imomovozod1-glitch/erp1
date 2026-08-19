-- =============================================================================
-- FULL MULTI-TENANT DATA ISOLATION + SUPER-ADMIN FOUNDATION
-- Safe to run multiple times.
--
-- Run this AFTER migration_inventory_costing.sql and migration_customer_categories.sql.
-- Read the whole file before running it — this touches every table's RLS
-- policies and adds a NOT NULL tenant_id column to every business table.
--
-- What this does, in order:
--   1. Creates `tenants` (the SaaS account registry) and `super_admins`
--      (vendor-level operators, a separate identity space from tenant users).
--   2. Creates one placeholder tenant that all EXISTING data gets assigned to,
--      so nothing you already have breaks the moment this migration finishes.
--   3. Adds `profiles.tenant_id` and teaches `handle_new_user()` to read it
--      from the new auth user's metadata (set by the admin-panel provisioning
--      route — see Phase 4 of the plan).
--   4. For every business table: adds `tenant_id`, backfills it to the
--      placeholder tenant, makes it NOT NULL, attaches a BEFORE INSERT trigger
--      that stamps it from the caller's own profile (so no application code
--      has to be changed to populate it), replaces the old "any authenticated
--      user sees everything" RLS policies with tenant-scoped ones, and adds
--      an index.
--   5. Converts every column that was globally UNIQUE (sku, order_number,
--      invoice_number, po_number, employee_code, slug) into a per-tenant
--      UNIQUE (tenant_id, column) constraint — two tenants can now both use
--      SKU "ABC123" without colliding or, worse, silently overwriting each
--      other's row through an ON CONFLICT upsert.
--   6. Retires the global singleton `company_settings` table in favor of
--      `tenants.costing_method` (one row per tenant instead of one row for
--      the whole deployment) — this is what makes "each tenant's own
--      FIFO/LIFO/AVECO choice" real.
-- =============================================================================

-- =============================================================================
-- 1a. TENANTS + SUPER_ADMINS — table structure only, no RLS policies yet.
--    (Ordering bug fixed here: the tenants policies below need to reference
--    profiles.tenant_id, but profiles.tenant_id needs the tenants table to
--    exist first for its own FK. So: bare tables → profiles.tenant_id →
--    THEN the tenants policies, further down in section 1b.)
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('active', 'blocked', 'inactive');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subdomain TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  status tenant_status NOT NULL DEFAULT 'active',
  costing_method costing_method NOT NULL DEFAULT 'fifo',
  subscription_started_at DATE,
  subscription_ends_at DATE,
  price_paid DECIMAL(12, 2),
  details TEXT,
  last_active_at TIMESTAMPTZ,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies at all for `authenticated` — this table is only
-- ever read/written via the service-role key from /admin server routes.

DROP TRIGGER IF EXISTS update_super_admins_updated_at ON super_admins;
CREATE TRIGGER update_super_admins_updated_at BEFORE UPDATE ON super_admins FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 2. PLACEHOLDER TENANT — everything that already exists in your database
--    (before you had tenants at all) gets assigned here, so the app keeps
--    working immediately after this migration, fully isolated from whatever
--    real tenants you create afterward.
-- =============================================================================

INSERT INTO tenants (id, subdomain, company_name, phone, status)
SELECT '00000000-0000-0000-0000-000000000001', 'default', 'Default', '+000000000000', 'active'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001');

-- =============================================================================
-- 3. PROFILES.TENANT_ID + SIGNUP TRIGGER
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

UPDATE profiles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);

-- Every NEW auth.users row from now on must carry a tenant_id in its
-- metadata (the admin-panel provisioning route sets this — see Phase 4) —
-- the trigger copies it onto the profile so RLS has something to check.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'staff',
    NULLIF(NEW.raw_user_meta_data->>'tenant_id', '')::uuid
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 1b. TENANTS RLS POLICIES — now that profiles.tenant_id exists.
-- =============================================================================

-- No blanket "authenticated" read/write policy on purpose: the vendor's own
-- admin panel always uses the service-role key (bypasses RLS), which is the
-- only way tenant accounts get created, deleted, blocked, or billed. Tenant
-- users only get two narrow policies:
DO $$ BEGIN
  CREATE POLICY "tenant_read_own" ON tenants FOR SELECT TO authenticated
    USING (id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_update_own" ON tenants FOR UPDATE TO authenticated
    USING (id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ...and even that UPDATE policy only lets them touch the costing_method
-- column — column-level GRANTs, not just the row-level RLS check above, so a
-- tenant admin can never self-unblock their account or edit their own price/
-- subscription dates through a raw API call, only through the admin panel.
REVOKE UPDATE ON tenants FROM authenticated;
GRANT UPDATE (costing_method) ON tenants TO authenticated;

-- =============================================================================
-- 4. SHARED TRIGGER: stamp tenant_id from the caller's own profile on INSERT.
--    Runs on every business table below — a client can never write a forged
--    tenant_id (this always overwrites whatever, if anything, was sent).
-- =============================================================================

CREATE OR REPLACE FUNCTION set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tenant_id := (SELECT tenant_id FROM profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 5. BUSINESS TABLES — tenant_id + backfill + trigger + tenant-scoped RLS + index
--    Same six-step shape repeated per table on purpose (see file header).
-- =============================================================================

-- ---- departments ------------------------------------------------------------
ALTER TABLE departments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE departments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE departments ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS departments_set_tenant_id ON departments;
CREATE TRIGGER departments_set_tenant_id BEFORE INSERT ON departments FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_departments" ON departments;
DROP POLICY IF EXISTS "authenticated_write_departments" ON departments;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_departments" ON departments FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments(tenant_id);

-- ---- employees ---------------------------------------------------------------
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE employees SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE employees ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS employees_set_tenant_id ON employees;
CREATE TRIGGER employees_set_tenant_id BEFORE INSERT ON employees FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_employees" ON employees;
DROP POLICY IF EXISTS "authenticated_write_employees" ON employees;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_employees" ON employees FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_code_key;
DO $$ BEGIN
  ALTER TABLE employees ADD CONSTRAINT employees_tenant_code_key UNIQUE (tenant_id, employee_code);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- categories (inventory) ---------------------------------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE categories SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE categories ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS categories_set_tenant_id ON categories;
CREATE TRIGGER categories_set_tenant_id BEFORE INSERT ON categories FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_categories" ON categories;
DROP POLICY IF EXISTS "authenticated_write_categories" ON categories;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_categories" ON categories FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;
DO $$ BEGIN
  ALTER TABLE categories ADD CONSTRAINT categories_tenant_slug_key UNIQUE (tenant_id, slug);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- products ------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE products SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE products ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS products_set_tenant_id ON products;
CREATE TRIGGER products_set_tenant_id BEFORE INSERT ON products FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_products" ON products;
DROP POLICY IF EXISTS "authenticated_write_products" ON products;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_products" ON products FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_tenant_sku_key UNIQUE (tenant_id, sku);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- customers -------------------------------------------------------------------
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE customers SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS customers_set_tenant_id ON customers;
CREATE TRIGGER customers_set_tenant_id BEFORE INSERT ON customers FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_customers" ON customers;
DROP POLICY IF EXISTS "authenticated_write_customers" ON customers;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_customers" ON customers FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);

-- ---- customer_categories (added in migration_customer_categories.sql) -----------
ALTER TABLE customer_categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE customer_categories SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE customer_categories ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS customer_categories_set_tenant_id ON customer_categories;
CREATE TRIGGER customer_categories_set_tenant_id BEFORE INSERT ON customer_categories FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_customer_categories" ON customer_categories;
DROP POLICY IF EXISTS "authenticated_write_customer_categories" ON customer_categories;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_customer_categories" ON customer_categories FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_customer_categories_tenant ON customer_categories(tenant_id);

-- ---- suppliers ---------------------------------------------------------------------
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE suppliers SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE suppliers ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS suppliers_set_tenant_id ON suppliers;
CREATE TRIGGER suppliers_set_tenant_id BEFORE INSERT ON suppliers FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_suppliers" ON suppliers;
DROP POLICY IF EXISTS "authenticated_write_suppliers" ON suppliers;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_suppliers" ON suppliers FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- ---- sales_orders --------------------------------------------------------------------
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE sales_orders SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE sales_orders ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS sales_orders_set_tenant_id ON sales_orders;
CREATE TRIGGER sales_orders_set_tenant_id BEFORE INSERT ON sales_orders FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_orders" ON sales_orders;
DROP POLICY IF EXISTS "authenticated_write_orders" ON sales_orders;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_sales_orders" ON sales_orders FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant ON sales_orders(tenant_id);
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_order_number_key;
DO $$ BEGIN
  ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_tenant_number_key UNIQUE (tenant_id, order_number);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- sales_order_items -----------------------------------------------------------------
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE sales_order_items SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE sales_order_items ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS sales_order_items_set_tenant_id ON sales_order_items;
CREATE TRIGGER sales_order_items_set_tenant_id BEFORE INSERT ON sales_order_items FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_order_items" ON sales_order_items;
DROP POLICY IF EXISTS "authenticated_write_order_items" ON sales_order_items;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_sales_order_items" ON sales_order_items FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_sales_order_items_tenant ON sales_order_items(tenant_id);

-- ---- invoices ------------------------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE invoices SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE invoices ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS invoices_set_tenant_id ON invoices;
CREATE TRIGGER invoices_set_tenant_id BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_invoices" ON invoices;
DROP POLICY IF EXISTS "authenticated_write_invoices" ON invoices;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_invoices" ON invoices FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_tenant_number_key UNIQUE (tenant_id, invoice_number);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- purchase_orders -------------------------------------------------------------------------
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE purchase_orders SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE purchase_orders ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS purchase_orders_set_tenant_id ON purchase_orders;
CREATE TRIGGER purchase_orders_set_tenant_id BEFORE INSERT ON purchase_orders FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_po" ON purchase_orders;
DROP POLICY IF EXISTS "authenticated_write_po" ON purchase_orders;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_purchase_orders" ON purchase_orders FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;
DO $$ BEGIN
  ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_tenant_number_key UNIQUE (tenant_id, po_number);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- purchase_order_items ---------------------------------------------------------------------
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE purchase_order_items SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE purchase_order_items ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS purchase_order_items_set_tenant_id ON purchase_order_items;
CREATE TRIGGER purchase_order_items_set_tenant_id BEFORE INSERT ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_po_items" ON purchase_order_items;
DROP POLICY IF EXISTS "authenticated_write_po_items" ON purchase_order_items;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_purchase_order_items" ON purchase_order_items FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_tenant ON purchase_order_items(tenant_id);

-- ---- stock_movements ---------------------------------------------------------------------------
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE stock_movements SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE stock_movements ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS stock_movements_set_tenant_id ON stock_movements;
CREATE TRIGGER stock_movements_set_tenant_id BEFORE INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_stock" ON stock_movements;
DROP POLICY IF EXISTS "authenticated_write_stock" ON stock_movements;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_stock_movements" ON stock_movements FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);

-- ---- inventory_cost_layers (added in migration_inventory_costing.sql) -------------------------
ALTER TABLE inventory_cost_layers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE inventory_cost_layers SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE inventory_cost_layers ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS inventory_cost_layers_set_tenant_id ON inventory_cost_layers;
CREATE TRIGGER inventory_cost_layers_set_tenant_id BEFORE INSERT ON inventory_cost_layers FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_inventory_cost_layers" ON inventory_cost_layers;
DROP POLICY IF EXISTS "authenticated_write_inventory_cost_layers" ON inventory_cost_layers;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_inventory_cost_layers" ON inventory_cost_layers FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_tenant ON inventory_cost_layers(tenant_id);

-- ---- transactions ----------------------------------------------------------------------------------
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE transactions SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE transactions ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS transactions_set_tenant_id ON transactions;
CREATE TRIGGER transactions_set_tenant_id BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_transactions" ON transactions;
DROP POLICY IF EXISTS "authenticated_write_transactions" ON transactions;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_transactions" ON transactions FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenant_id);

-- ---- transaction_categories --------------------------------------------------------------------------
ALTER TABLE transaction_categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE transaction_categories SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE transaction_categories ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS transaction_categories_set_tenant_id ON transaction_categories;
CREATE TRIGGER transaction_categories_set_tenant_id BEFORE INSERT ON transaction_categories FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_transaction_categories" ON transaction_categories;
DROP POLICY IF EXISTS "authenticated_write_transaction_categories" ON transaction_categories;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_transaction_categories" ON transaction_categories FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_transaction_categories_tenant ON transaction_categories(tenant_id);

-- ---- cashboxes ------------------------------------------------------------------------------------------
ALTER TABLE cashboxes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE cashboxes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE cashboxes ALTER COLUMN tenant_id SET NOT NULL;
DROP TRIGGER IF EXISTS cashboxes_set_tenant_id ON cashboxes;
CREATE TRIGGER cashboxes_set_tenant_id BEFORE INSERT ON cashboxes FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP POLICY IF EXISTS "authenticated_read_cashboxes" ON cashboxes;
DROP POLICY IF EXISTS "authenticated_write_cashboxes" ON cashboxes;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_cashboxes" ON cashboxes FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_cashboxes_tenant ON cashboxes(tenant_id);

-- =============================================================================
-- 6. RETIRE company_settings — one row per tenant now lives on tenants.costing_method.
--    Carry the old global default forward onto the placeholder tenant first,
--    so nothing changes for whatever's already using it.
-- =============================================================================

UPDATE tenants
SET costing_method = COALESCE((SELECT default_costing_method FROM company_settings LIMIT 1), 'fifo')
WHERE id = '00000000-0000-0000-0000-000000000001';

DROP TABLE IF EXISTS company_settings;
