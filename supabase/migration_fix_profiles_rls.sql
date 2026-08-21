-- =============================================================================
-- SECURITY FIX: profiles RLS was never scoped by the multi-tenant migration
-- Safe to run multiple times.
--
-- migration_multi_tenant.sql added tenant_id to every business table and
-- rewrote every one of their RLS policies to be tenant-scoped — except
-- `profiles` itself. Its original schema.sql policies are still active:
--   - "authenticated_read_all" (SELECT USING (true)) — any authenticated
--     user, from ANY tenant, can read every profile row in the system:
--     name, email, phone, role, department, is_active — across every
--     other tenant. Reachable today via Settings → Users.
--   - "users_update_own_profile"'s admin branch checks "is the caller an
--     admin" but never checks the TARGET row's tenant — since every
--     tenant's first user is provisioned with role='admin', any tenant's
--     admin can promote/demote or deactivate ANY OTHER tenant's user via
--     the same Settings → Users page (role select / active toggle).
--
-- Fix: a SECURITY DEFINER helper (same pattern as set_tenant_id() in
-- migration_multi_tenant.sql) to read the caller's own tenant_id without
-- re-entering RLS — required because a SELECT policy on `profiles` that
-- naively subqueries `profiles` again would hit Postgres's "infinite
-- recursion detected in policy" error.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "authenticated_read_all" ON profiles;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_profiles_select" ON profiles FOR SELECT TO authenticated
    USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DO $$ BEGIN
  CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE TO authenticated
    USING (
      auth.uid() = id
      OR (tenant_id = get_my_tenant_id() AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
    WITH CHECK (
      auth.uid() = id
      OR (tenant_id = get_my_tenant_id() AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;
