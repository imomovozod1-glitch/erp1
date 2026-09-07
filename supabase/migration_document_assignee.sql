-- =============================================================================
-- DOCUMENT OWNERSHIP: creator vs responsible person
-- Safe to run multiple times. Run AFTER migration_rbac_actions.sql.
--
-- The problem
-- -----------
-- Documents recorded only `created_by`, so "who made this" and "whose work is
-- this" were the same field. They routinely differ: a cashier rings up a sale
-- that belongs to a salesperson's book; an assistant enters a purchase order
-- the procurement manager owns; an admin fixes someone else's invoice and
-- silently becomes its owner.
--
-- That also made the `own` data scope (migration_rbac_actions.sql) filter on
-- the wrong person — a salesperson saw orders they had TYPED rather than the
-- orders they are RESPONSIBLE FOR.
--
-- The change
-- ----------
-- `assigned_to` is the responsible person; `created_by` stays as the audit
-- trail of who entered it. Both are shown in lists and on detail pages. The
-- `own` scope now filters on `assigned_to`.
--
-- Backfill: existing rows get assigned_to = created_by. Before this column
-- existed the creator WAS the de-facto owner, so that is the only reading of
-- the history that doesn't invent information — and it keeps every existing
-- document visible to exactly the person who could see it yesterday.
--
-- ON DELETE SET NULL rather than CASCADE: removing an employee must not delete
-- the company's sales history. A NULL assignee means "unassigned", which the
-- UI surfaces so it can be corrected.
-- =============================================================================

ALTER TABLE sales_orders     ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE invoices         ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE purchase_orders  ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- Constraints are named EXPLICITLY because PostgREST disambiguates a table
-- with two foreign keys to the same target by constraint name — the queries in
-- src/lib/data/queries.ts embed
--   creator:profiles!<name>(full_name), assignee:profiles!<name>(full_name)
-- and would fail with "more than one relationship found" if these names drifted
-- from what the code expects. Relying on Postgres's default naming would work
-- today but leaves nothing stating the contract.
DO $$ BEGIN
  ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- The created_by foreign keys were created inline in schema.sql and therefore
-- carry Postgres's default name. Assert that name so the embed above has a
-- guaranteed counterpart even on a database where the table was rebuilt.
DO $$ BEGIN
  ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id);
EXCEPTION WHEN duplicate_object THEN null; WHEN others THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id);
EXCEPTION WHEN duplicate_object THEN null; WHEN others THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id);
EXCEPTION WHEN duplicate_object THEN null; WHEN others THEN null; END $$;

-- Only touches rows that have not been assigned yet, so re-running never
-- overwrites an assignment someone has since made by hand.
UPDATE sales_orders    SET assigned_to = created_by WHERE assigned_to IS NULL;
UPDATE invoices        SET assigned_to = created_by WHERE assigned_to IS NULL;
UPDATE purchase_orders SET assigned_to = created_by WHERE assigned_to IS NULL;

-- The `own` data scope filters these lists by assignee, so the index that
-- matters is (tenant, assignee, recency). The created_by indexes added by
-- migration_rbac_actions.sql are now redundant for that query path but are
-- left in place: they still serve "documents entered by X" audit lookups.
CREATE INDEX IF NOT EXISTS idx_sales_orders_assigned_to    ON sales_orders(tenant_id, assigned_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_assigned_to        ON invoices(tenant_id, assigned_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_assigned_to ON purchase_orders(tenant_id, assigned_to, created_at DESC);

COMMENT ON COLUMN sales_orders.assigned_to IS
  'Responsible person (masul shaxs). Distinct from created_by, which records who entered the document. The `own` RBAC data scope filters on THIS column — see src/lib/permissions.ts.';
COMMENT ON COLUMN invoices.assigned_to IS
  'Responsible person. Distinct from created_by; the `own` RBAC data scope filters on this column.';
COMMENT ON COLUMN purchase_orders.assigned_to IS
  'Responsible person. Distinct from created_by; the `own` RBAC data scope filters on this column.';
