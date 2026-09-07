-- =============================================================================
-- SECURITY FIX: any user could grant themselves admin
-- Safe to run multiple times. Run AFTER migration_fix_profiles_rls.sql.
--
-- The problem
-- -----------
-- `users_update_own_profile` (migration_fix_profiles_rls.sql) permits
-- `auth.uid() = id` — i.e. a user may UPDATE their own profile row. That is
-- correct and necessary for Settings → Profile (name, phone, avatar), but RLS
-- policies are row-level, not column-level: the same permission also lets any
-- cashier open the browser console and run
--
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', <their own id>)
--
-- becoming a tenant admin. `permissions` and `is_active` are escalatable the
-- same way, which makes the entire role/permission system advisory — a user
-- can simply grant themselves whatever the UI declined to give them.
--
-- The fix
-- -------
-- Column-level privileges, which RLS cannot express. `authenticated` keeps
-- UPDATE only on the columns a user legitimately edits about themselves;
-- everything privilege-bearing is revoked outright, so no policy — present or
-- future — can hand it back by accident.
--
-- Admins still change roles and permissions, but through
-- /api/tenant/users/[id]/access, which runs with the service-role key (not
-- subject to these grants) after checking, server-side, that the caller is an
-- admin of the SAME tenant as the target. That is the same pattern already
-- used for creating logins and resetting passwords, where the browser
-- likewise cannot be trusted with the operation.
--
-- Note on GRANT semantics: granting specific columns and granting the whole
-- table are tracked separately, so the REVOKE below must come first —
-- otherwise a pre-existing table-wide UPDATE would continue to apply.
-- =============================================================================

REVOKE UPDATE ON public.profiles FROM authenticated;

-- The self-service columns, and the only ones the browser can write:
--   full_name, phone, avatar_url  -> Settings → Profile
--   department_id                 -> HR assignment, still gated by RLS to
--                                    self or a same-tenant admin
GRANT UPDATE (full_name, phone, avatar_url, department_id)
  ON public.profiles TO authenticated;

-- Deliberately NOT granted to `authenticated` (service-role only):
--   role, permissions, role_template_id  -> privilege-bearing
--   is_active                            -> account enable/disable
--   tenant_id                            -> tenant isolation
--   force_logout_at                      -> session revocation
--   id, created_at, updated_at           -> identity/bookkeeping

COMMENT ON COLUMN public.profiles.role IS
  'Privilege-bearing. UPDATE is revoked from `authenticated` (see migration_profile_privilege_lockdown.sql) — change it only through /api/tenant/users/[id]/access.';
COMMENT ON COLUMN public.profiles.permissions IS
  'UI-only per-module access for non-admin users. Shape: {"<module>": {"view": bool, "edit": bool}}. Modules match src/lib/permissions.ts PERMISSION_MODULES. Ignored entirely for role=admin. UPDATE is revoked from `authenticated` — change it only through /api/tenant/users/[id]/access.';
