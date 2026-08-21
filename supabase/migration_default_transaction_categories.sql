-- =============================================================================
-- DEFAULT TRANSACTION CATEGORIES FOR NEW TENANTS
-- Safe to run multiple times.
--
-- Problem: `transaction_categories`' original 11-row seed (schema.sql) only
-- ever landed on the placeholder tenant created by the multi-tenant
-- migration — every tenant provisioned since then (via /admin/tenants/new)
-- starts with a completely empty category list, since nothing seeds new
-- tenants. A DB trigger (not application code) is the right place for this:
-- it fires no matter which path creates a `tenants` row.
-- =============================================================================

CREATE OR REPLACE FUNCTION seed_default_transaction_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO transaction_categories (tenant_id, name, type, person_type) VALUES
    (NEW.id, 'Mijozdan pul olish', 'income', 'customer'),
    (NEW.id, 'Yetkazib beruvchiga pul berish', 'expense', 'supplier'),
    (NEW.id, 'Kommunal to''lovlar', 'expense', 'none'),
    (NEW.id, 'Boshqa xarajatlar', 'expense', 'none'),
    (NEW.id, 'Oylik berish', 'expense', 'employee');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tenants_seed_transaction_categories ON tenants;
CREATE TRIGGER tenants_seed_transaction_categories AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION seed_default_transaction_categories();

-- One-time backfill: every already-provisioned tenant that currently has
-- zero transaction categories (i.e. every tenant created before this
-- trigger existed) gets the same 5 defaults. Idempotent — once a tenant has
-- at least one category, the NOT EXISTS check skips it on any re-run.
INSERT INTO transaction_categories (tenant_id, name, type, person_type)
SELECT t.id, v.name, v.type::transaction_type, v.person_type::transaction_person_type
FROM tenants t
CROSS JOIN (VALUES
  ('Mijozdan pul olish', 'income', 'customer'),
  ('Yetkazib beruvchiga pul berish', 'expense', 'supplier'),
  ('Kommunal to''lovlar', 'expense', 'none'),
  ('Boshqa xarajatlar', 'expense', 'none'),
  ('Oylik berish', 'expense', 'employee')
) AS v(name, type, person_type)
WHERE NOT EXISTS (SELECT 1 FROM transaction_categories tc WHERE tc.tenant_id = t.id);
