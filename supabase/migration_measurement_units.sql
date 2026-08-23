-- =============================================================================
-- MEASUREMENT UNITS: move from per-browser localStorage to a real,
-- tenant-shared database table. Safe to run multiple times.
--
-- Problem this fixes: `src/lib/units.ts` previously read/wrote
-- `localStorage['measurement_units']` — every browser/device had its own
-- independent list, so two people on the same tenant could see completely
-- different unit dropdowns, and nothing was seeded centrally. This mirrors
-- the exact same pattern already used for `transaction_categories` (see
-- migration_default_transaction_categories.sql): a real tenant-scoped
-- table, an AFTER INSERT trigger on `tenants` so every newly-provisioned
-- tenant starts seeded, and a one-time backfill for tenants that already
-- exist.
-- =============================================================================

CREATE TABLE IF NOT EXISTS measurement_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness per tenant ("Dona" and "dona" are the same
-- unit) — enforced at the database level, not just in the UI, since that's
-- the only place duplicates truly can't slip through (concurrent requests,
-- API calls that bypass the client-side check, etc.).
CREATE UNIQUE INDEX IF NOT EXISTS idx_measurement_units_tenant_name_ci
  ON measurement_units (tenant_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_measurement_units_tenant ON measurement_units(tenant_id);

ALTER TABLE measurement_units ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation_measurement_units" ON measurement_units FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Stamps tenant_id from the caller's own profile on INSERT — same shared
-- trigger function every other business table uses (see migration_multi_tenant.sql).
DROP TRIGGER IF EXISTS measurement_units_set_tenant_id ON measurement_units;
CREATE TRIGGER measurement_units_set_tenant_id BEFORE INSERT ON measurement_units
  FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

-- Seed every newly-provisioned tenant with the 4 defaults.
CREATE OR REPLACE FUNCTION seed_default_measurement_units()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO measurement_units (tenant_id, name) VALUES
    (NEW.id, 'Dona'),
    (NEW.id, 'Kilogram'),
    (NEW.id, 'Litr'),
    (NEW.id, 'Metr')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tenants_seed_measurement_units ON tenants;
CREATE TRIGGER tenants_seed_measurement_units AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION seed_default_measurement_units();

-- One-time backfill for every tenant that already exists and currently has
-- zero measurement units (i.e. every tenant created before this trigger
-- existed). Idempotent — a tenant with at least one unit is skipped.
INSERT INTO measurement_units (tenant_id, name)
SELECT t.id, v.name
FROM tenants t
CROSS JOIN (VALUES ('Dona'), ('Kilogram'), ('Litr'), ('Metr')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM measurement_units mu WHERE mu.tenant_id = t.id);
