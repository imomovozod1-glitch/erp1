-- =============================================================================
-- TELEGRAM MINI APP: link a Telegram account to an ERP login
-- Safe to run multiple times. Run AFTER migration_multi_tenant.sql.
--
-- How sign-in works
-- -----------------
-- A Mini App gets a signed `initData` blob identifying the Telegram user, but
-- Telegram knows nothing about ERP accounts. So the first time someone opens
-- the app they sign in ONCE with the phone + password they already use, and
-- that creates a row here binding their telegram_user_id to their profile.
-- Every later open verifies initData and looks the binding up — no password.
--
-- Why a separate table rather than a column on `profiles`
-- -------------------------------------------------------
-- `profiles` has UPDATE revoked for the privilege-bearing columns
-- (migration_profile_privilege_lockdown.sql) and is written through service-role
-- routes only. Keeping the binding separate means the linking flow never needs
-- to touch `profiles` at all, and a user can unlink without a profile write.
--
-- RLS: no `authenticated` policies. The binding decides WHO you are, so it must
-- only ever be read or written by the server routes that verify initData —
-- a client that could write this table could bind itself to anyone's profile.
-- =============================================================================

CREATE TABLE IF NOT EXISTS telegram_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Telegram's numeric user id. UNIQUE: one Telegram account maps to exactly
  -- one ERP login, otherwise "who is this?" has no single answer.
  telegram_user_id BIGINT NOT NULL UNIQUE,

  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Snapshotted for display in the admin/user list; Telegram handles change.
  telegram_username TEXT,
  telegram_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A profile can be reachable from only one Telegram account, so that
  -- revoking access is unambiguous.
  UNIQUE (profile_id)
);

ALTER TABLE telegram_links ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies for `authenticated` — see the note above.

CREATE INDEX IF NOT EXISTS idx_telegram_links_tenant ON telegram_links(tenant_id);

COMMENT ON TABLE telegram_links IS
  'Binds a Telegram user id to an ERP profile for Mini App sign-in. Written only by /api/telegram/** after verifying initData signature (src/lib/telegram-miniapp.ts).';
