-- =============================================================================
-- A tenant's costing method is fixed once the tenant exists.
-- Safe to run multiple times.
-- Run after: migration_multi_tenant.sql, migration_inventory_costing.sql
--
-- FIFO / LIFO / AVECO decides how every cost layer already recorded is read.
-- Switching it on a live tenant silently re-prices stock and past margins, so
-- it is chosen once, when the super-admin creates the tenant.
--
-- migration_multi_tenant.sql granted tenant users UPDATE on exactly this
-- column; nothing in the app used it, and it is revoked here. The trigger also
-- covers the service role (the admin panel), so the rule holds for everyone.
-- =============================================================================

REVOKE UPDATE (costing_method) ON tenants FROM authenticated;

CREATE OR REPLACE FUNCTION prevent_costing_method_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.costing_method IS DISTINCT FROM OLD.costing_method THEN
    RAISE EXCEPTION 'costing_method cannot be changed after the tenant is created'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_lock_costing_method ON tenants;
CREATE TRIGGER tenants_lock_costing_method
  BEFORE UPDATE OF costing_method ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION prevent_costing_method_change();
