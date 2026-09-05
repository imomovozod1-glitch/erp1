-- =============================================================================
-- ROLE TEMPLATES + PAID-SEAT EMPLOYEE GATING
-- Safe to run multiple times. Run AFTER migration_multi_tenant.sql and
-- migration_permissions.sql.
--
-- What this does:
--   1. Adds `role_templates` — per-tenant named permission presets (e.g.
--      "Sotuvchi", "Buxgalter") so an admin picks a role for an employee
--      instead of manually checking every module's View/Edit boxes each
--      time. Same UI-level-only caveat as profiles.permissions
--      (migration_permissions.sql) — not an RLS boundary, purely what the
--      HR form/PermissionsMatrix reads to pre-fill `profiles.permissions`.
--   2. Adds `profiles.role_template_id` (nullable) so a profile can
--      optionally track which template it was seeded from, while the
--      actual enforced values stay on `profiles.permissions` (still
--      manually overridable after picking a template).
--   3. Adds `employees.is_paid` (default false) — a "free" employee cannot
--      be given a system login at all; see the gate in
--      src/components/hr/employee-form.tsx and src/app/api/tenant/users/route.ts.
--   4. Adds `employees.cashbox_id` (nullable) — an employee can be assigned
--      an existing cashbox at creation time; if none is picked,
--      employee-form.tsx auto-creates one named after the employee instead
--      of leaving it unset.
-- =============================================================================

CREATE TABLE IF NOT EXISTS role_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE role_templates ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_role_templates_updated_at ON role_templates;
CREATE TRIGGER update_role_templates_updated_at BEFORE UPDATE ON role_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS role_templates_set_tenant_id ON role_templates;
CREATE TRIGGER role_templates_set_tenant_id BEFORE INSERT ON role_templates FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

DO $$ BEGIN
  CREATE POLICY "tenant_isolation_role_templates" ON role_templates FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_role_templates_tenant ON role_templates(tenant_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_template_id UUID REFERENCES role_templates(id) ON DELETE SET NULL;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS cashbox_id UUID REFERENCES cashboxes(id) ON DELETE SET NULL;
