-- =============================================================================
-- RBAC: per-module ACTIONS + data scope
-- Safe to run multiple times. Run AFTER migration_permissions.sql.
--
-- What changes
-- ------------
-- `profiles.permissions` and `role_templates.permissions` previously held two
-- flags per module:
--
--   {"inventory": {"view": true, "edit": true}}
--
-- Two flags cannot express what an ERP actually needs: a cashier who may
-- create a sale but never delete one, an accountant who may read and export
-- finance but not change it, a manager who is the only person allowed to
-- approve a purchase order. The shape is now:
--
--   {"inventory": {"view": true, "create": true, "edit": true,
--                  "delete": false, "export": true, "approve": false,
--                  "scope": "all"}}
--
-- Actions: view, create, edit, delete, export, approve.
-- Scope:   "all" (every record in the tenant) or "own" (only records this
--          user created) — see src/lib/permissions.ts.
--
-- No data migration
-- -----------------
-- Old rows are upgraded ON READ by `normaliseModulePermission`, deliberately:
-- `edit: true` used to imply create+modify, so it maps to create+edit, while
-- delete/export/approve start FALSE. Rewriting the stored JSON here would have
-- to make the same guess, but irreversibly and for every tenant at once —
-- whereas on-read conversion means an admin's next save writes the new shape
-- with values they actually chose, and nothing is granted that was never
-- granted before.
--
-- The column stays JSONB with no CHECK constraint: the server routes
-- (/api/tenant/users/[id]/access and /api/tenant/roles/**) normalise every
-- write through the same function the UI uses, so the invariants live in one
-- place rather than being duplicated in SQL and drifting.
-- =============================================================================

COMMENT ON COLUMN profiles.permissions IS
  'Per-module RBAC. Shape: {"<module>": {"view","create","edit","delete","export","approve": bool, "scope": "all"|"own"}}. Modules match src/lib/permissions.ts PERMISSION_MODULES. Ignored entirely for role=admin. Legacy {"view","edit"} rows are upgraded on read. UPDATE is revoked from `authenticated` (migration_profile_privilege_lockdown.sql) — change it only through /api/tenant/users/[id]/access.';

COMMENT ON COLUMN role_templates.permissions IS
  'Per-module RBAC preset, same shape as profiles.permissions. Applied to a profile when the role is assigned, and re-applied to every holder when the template is edited (/api/tenant/roles/[id]).';

-- Supports the "own records only" data scope, which filters these lists by the
-- creating user. Without an index that turns into a full scan per page.
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_by ON sales_orders(tenant_id, created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(tenant_id, created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON purchase_orders(tenant_id, created_by, created_at DESC);
