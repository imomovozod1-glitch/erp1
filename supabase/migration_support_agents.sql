-- =============================================================================
-- SUPPORT AGENTS
-- Safe to run multiple times. Run AFTER migration_multi_tenant.sql.
--
-- What this does:
--   1. Creates `support_agents` — a separate identity space from both
--      `super_admins` and tenant `profiles`, mirroring `super_admins`
--      exactly (id references auth.users, RLS enabled with ZERO policies
--      for `authenticated` — service-role-only access from /api/admin/**
--      and /api/support/** routes). Deliberately NOT rows in `tenants`:
--      every tenant-count/billing/inactivity-deletion query in the admin
--      console assumes a `tenants` row is a real paying customer, so a
--      "fake tenant" would either need special-casing everywhere or get
--      counted as a real (empty) customer by mistake.
--   2. Adds `tenants.support_agent_id` — nullable FK, one agent can be
--      assigned to many tenants (the FK lives on the many side, so no join
--      table is needed; "which tenants does agent X have" is just
--      `SELECT * FROM tenants WHERE support_agent_id = X`).
-- =============================================================================

CREATE TABLE IF NOT EXISTS support_agents (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_agents ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies at all for `authenticated` — same reasoning as
-- super_admins (migration_multi_tenant.sql): only ever read/written via the
-- service-role key from /api/admin/** and /api/support/** server routes.

DROP TRIGGER IF EXISTS update_support_agents_updated_at ON support_agents;
CREATE TRIGGER update_support_agents_updated_at BEFORE UPDATE ON support_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_agent_id UUID REFERENCES support_agents(id) ON DELETE SET NULL;
