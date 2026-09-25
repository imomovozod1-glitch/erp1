-- =============================================================================
-- Per-tenant feature flags.
-- Safe to run multiple times.
-- Run after: migration_multi_tenant.sql
--
-- One deployment serves every company — src/proxy.ts resolves the tenant from
-- the subdomain, and the same bundle answers acme.falco.business and
-- beta.falco.business alike. So shipping code is all-or-nothing: the moment
-- `main` deploys, every company runs it. This column is how a change reaches
-- ONE company first — it ships switched off, the operator turns it on for the
-- test company in the admin console, and only that subdomain takes the new
-- path.
--
-- Shape: { "<flag>": true }. The flag names the app knows are the registry in
-- src/lib/features.ts; a key that is not in it is ignored on read, so removing
-- a finished flag from the code needs no migration to clean the rows.
-- =============================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;

-- A flat object, never an array or a bare scalar: every reader treats it as a
-- map of flag -> boolean, and the admin console is the only writer.
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_features_is_object
    CHECK (jsonb_typeof(features) = 'object');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- A company's own members may READ this (the `tenant_read_own` SELECT policy
-- from migration_multi_tenant.sql covers every column, which is what lets the
-- app read its own flags) but must never write it: a tenant admin turning on an
-- unreleased feature for themselves is exactly what this column exists to
-- prevent. UPDATE on `tenants` was revoked wholesale in that migration and the
-- single column grant it left behind was taken back by
-- migration_tenant_costing_lock.sql — this restates the rule for the new
-- column so it survives any future GRANT on the table.
REVOKE UPDATE (features) ON tenants FROM authenticated;

-- Flags are set by the platform operator only, through the admin console
-- (service-role key — src/app/api/admin/tenants/[id]/route.ts).
