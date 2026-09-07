-- =============================================================================
-- INTEGRATIONS (Telegram bot)
-- Safe to run multiple times. Run AFTER migration_multi_tenant.sql.
--
-- What this does:
--   1. Creates `integration_settings` — one row per tenant holding that
--      tenant's outbound-integration config. Today that's a Telegram bot
--      (token + target chat + which events to notify on); the table is named
--      generically so a second provider becomes extra columns, not a second
--      table with a duplicated tenant/RLS/trigger setup.
--   2. RLS is enabled with ZERO policies for `authenticated` — deliberately,
--      exactly like `super_admins`/`support_agents` (migration_support_agents.sql).
--
--      This is the important part: `telegram_bot_token` is a BEARER SECRET.
--      Anyone holding it can post as the tenant's bot to every chat the bot
--      is in. The usual `tenant_isolation_*` policy used by the business
--      tables grants `FOR ALL` to every authenticated member of the tenant,
--      which would let any cashier or staff account simply SELECT the token
--      out of the browser client. With no policy at all, only the
--      service-role key can read or write this table, so the token is
--      reachable only from `/api/integrations/**` — which additionally
--      requires role='admin' — and is never sent to the browser (the GET
--      route returns a masked hint, never the value).
--
--      Consequence to be aware of: every access must go through those server
--      routes. A direct `supabase.from('integration_settings')` call from a
--      client component will silently return zero rows, by design.
-- =============================================================================

CREATE TABLE IF NOT EXISTS integration_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- UNIQUE, not just an FK: a tenant has exactly one integration config row,
  -- which lets the API routes upsert on `tenant_id` instead of racing a
  -- select-then-insert on first save.
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  telegram_bot_username TEXT,
  telegram_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Which events actually get sent, e.g. {"sale": true, "low_stock": false}.
  -- Keys match TELEGRAM_EVENTS in src/lib/integrations/telegram.ts.
  telegram_events JSONB NOT NULL DEFAULT '{}'::jsonb,
  telegram_linked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

-- No `authenticated` policies on purpose — see the note above.

DROP TRIGGER IF EXISTS update_integration_settings_updated_at ON integration_settings;
CREATE TRIGGER update_integration_settings_updated_at
  BEFORE UPDATE ON integration_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- NOTE: deliberately NO `integration_settings_set_tenant_id` trigger.
-- set_tenant_id() overwrites tenant_id from the *caller's* profile whenever
-- auth.uid() is non-null; every write here comes from a service-role route
-- where auth.uid() is NULL and tenant_id is supplied explicitly, so the
-- trigger would add nothing and would only be a hazard if this table were
-- ever exposed to a client.

CREATE INDEX IF NOT EXISTS idx_integration_settings_tenant ON integration_settings(tenant_id);
