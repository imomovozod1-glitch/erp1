-- =============================================================================
-- ADMIN PANEL ENHANCEMENTS: license fields, payment history, employees.full_name
-- Safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. TENANTS: license count + license duration (months)
--    `license_months` replaces the previously-hardcoded "+1 month" auto-fill
--    on the admin tenant form — the super-admin now sets the actual billing
--    term length, and both the form's auto-fill and payment recording (below)
--    use it to compute subscription_ends_at.
-- =============================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_months INTEGER NOT NULL DEFAULT 1;

-- =============================================================================
-- 2. TENANT_PAYMENTS: payment history log.
--    Vendor-only data (like `tenants`/`super_admins`) — no `authenticated`
--    RLS policy at all, only ever read/written via the service-role key from
--    /admin server routes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  recorded_by UUID REFERENCES super_admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tenant_payments_tenant ON tenant_payments(tenant_id);

-- =============================================================================
-- 3. EMPLOYEES: a real, typeable name — `profile_id` (linking an employee to
--    a login account) was always optional, but the create form still forced
--    picking one from a dropdown just to have *a* name to show. Every
--    employee now carries its own name directly; profile_id remains purely
--    for "this employee also has a login", entirely separate from identity.
-- =============================================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS full_name TEXT;

UPDATE employees e
SET full_name = p.full_name
FROM profiles p
WHERE e.profile_id = p.id AND e.full_name IS NULL;

UPDATE employees SET full_name = employee_code WHERE full_name IS NULL;

ALTER TABLE employees ALTER COLUMN full_name SET NOT NULL;
