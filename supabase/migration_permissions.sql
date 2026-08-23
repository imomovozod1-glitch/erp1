-- =============================================================================
-- GRANULAR MODULE PERMISSIONS for non-admin users.
-- Safe to run multiple times.
--
-- Scope (deliberate, agreed with the user): UI-level enforcement only — this
-- is NOT an RLS/security boundary. `admin` role always has full access and
-- ignores this column entirely (see src/lib/permissions.ts). `manager`/`staff`
-- visibility into each module (sidebar nav) and their ability to see
-- "add new" actions is gated by this JSON, checked purely in React
-- components. A user who forges a raw API/PostgREST call still only hits
-- whatever the existing `USING (true)` RLS already allows — that gap is
-- pre-existing and unchanged by this migration (see CLAUDE.md's RLS gotcha).
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN profiles.permissions IS
  'UI-only per-module access for non-admin users. Shape: {"<module>": {"view": bool, "edit": bool}}. Modules match src/lib/permissions.ts PERMISSION_MODULES. Ignored entirely for role=admin (always full access).';
