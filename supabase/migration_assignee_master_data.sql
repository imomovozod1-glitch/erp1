-- =============================================================================
-- RESPONSIBLE PERSON on the remaining records
-- Safe to run multiple times. Run AFTER migration_document_assignee.sql.
--
-- migration_document_assignee.sql covered the three documents (sales orders,
-- invoices, purchase orders). This extends the same pattern to the records
-- those documents are made from:
--
--   customers     -> account manager
--   suppliers     -> responsible buyer
--   products      -> responsible person
--   transactions  -> responsible for the payment
--
-- `stock_movements` is deliberately NOT included. It is an append-only audit
-- log written by the system as a side effect of sales, receipts and
-- adjustments — it already records `created_by`, and a movement is not a piece
-- of work anyone is assigned. Adding an owner there would suggest it can be
-- reassigned, which is exactly what an audit trail must not allow.
--
-- customers/suppliers/products have no `created_by` at all today, so both
-- columns are added: `created_by` as the audit trail, `assigned_to` as the
-- responsible person.
--
-- Backfill
-- --------
-- There is nothing to backfill these from — unlike the documents, no prior
-- column carried the same meaning, so inventing one would be guessing. They
-- start unassigned, which is why the `own` data scope treats an unassigned
-- record as visible rather than hidden: see the note in
-- src/lib/data/paginate.ts. Without that, turning on `own` for a salesperson
-- would show them an empty customer list on day one.
-- =============================================================================

-- ─── new columns ─────────────────────────────────────────────────────────────
ALTER TABLE customers    ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE customers    ADD COLUMN IF NOT EXISTS created_by  UUID;
ALTER TABLE suppliers    ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE suppliers    ADD COLUMN IF NOT EXISTS created_by  UUID;
ALTER TABLE products     ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE products     ADD COLUMN IF NOT EXISTS created_by  UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- ─── named foreign keys ──────────────────────────────────────────────────────
-- Named explicitly for the same reason as the documents: PostgREST picks
-- between two foreign keys to the same table by CONSTRAINT NAME, and
-- src/lib/data/queries.ts embeds `creator:profiles!<name>` /
-- `assignee:profiles!<name>`. Default naming would work but states nothing.
DO $$ BEGIN
  ALTER TABLE customers ADD CONSTRAINT customers_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE customers ADD CONSTRAINT customers_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE suppliers ADD CONSTRAINT suppliers_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE suppliers ADD CONSTRAINT suppliers_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD CONSTRAINT transactions_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;
-- transactions.created_by already exists (schema.sql) but inline, so assert
-- the name the embed relies on.
DO $$ BEGIN
  ALTER TABLE transactions ADD CONSTRAINT transactions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id);
EXCEPTION WHEN duplicate_object THEN null; WHEN others THEN null; END $$;

-- transactions is the one table here that HAS a prior owner-ish column, so it
-- gets the same backfill the documents did. Only touches NULLs.
UPDATE transactions SET assigned_to = created_by WHERE assigned_to IS NULL;

-- ─── indexes for the `own` data scope ────────────────────────────────────────
-- Partial-free on purpose: the scope filter is
-- `assigned_to = me OR assigned_to IS NULL`, so NULLs are matched too and must
-- stay in the index.
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to    ON customers(tenant_id, assigned_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suppliers_assigned_to    ON suppliers(tenant_id, assigned_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_assigned_to     ON products(tenant_id, assigned_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_assigned_to ON transactions(tenant_id, assigned_to, created_at DESC);

COMMENT ON COLUMN customers.assigned_to IS
  'Account manager. The `own` RBAC data scope filters on this column (unassigned rows stay visible) — see src/lib/permissions.ts.';
COMMENT ON COLUMN suppliers.assigned_to IS
  'Responsible buyer. The `own` RBAC data scope filters on this column.';
COMMENT ON COLUMN products.assigned_to IS
  'Responsible person for the product. The `own` RBAC data scope filters on this column.';
COMMENT ON COLUMN transactions.assigned_to IS
  'Responsible for the payment. Distinct from created_by, which records who entered it.';
