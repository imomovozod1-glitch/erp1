-- =============================================================================
-- BUGFIX: set_tenant_id() trigger breaks tenant provisioning
-- Safe to run multiple times.
--
-- Problem: set_tenant_id() (migration_multi_tenant.sql) is a BEFORE INSERT
-- trigger on every business table, including `transaction_categories`. It
-- unconditionally overwrites NEW.tenant_id from
-- `(SELECT tenant_id FROM profiles WHERE id = auth.uid())` — correct for a
-- real authenticated client request (auth.uid() is always the caller's own
-- id), but the seed_default_transaction_categories() trigger
-- (migration_default_transaction_categories.sql) inserts rows using the
-- service-role key from /api/admin/tenants, where auth.uid() is NULL. That
-- NULL was clobbering the explicitly-provided tenant_id, so every new
-- tenant's INSERT INTO tenants failed downstream with:
--   "null value in column tenant_id of relation transaction_categories
--    violates not-null constraint"
-- — i.e. tenant creation via the admin panel has been completely broken
-- since that migration was applied. Caught via live end-to-end testing.
--
-- Fix: only override tenant_id when auth.uid() actually resolves to
-- someone (a real client request) — never overwrite an explicitly-supplied
-- value from trusted server-side code running as the service role. This
-- doesn't weaken the original defense: a client can only ever be
-- `authenticated` (not anon, not service-role) when reaching an INSERT
-- through RLS, and `authenticated` always implies a non-null auth.uid() by
-- construction — so this can't be used to forge a tenant_id from the
-- browser, only to stop trusted server-side code from being blocked.
-- =============================================================================

CREATE OR REPLACE FUNCTION set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.tenant_id := (SELECT tenant_id FROM profiles WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
