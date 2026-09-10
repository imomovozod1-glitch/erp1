-- Security-relevant account events (password changes, and anything similar
-- added later).
--
-- Kept separate from `login_attempts` on purpose: that table drives the login
-- rate limiter, which counts rows per identifier inside a time window. Writing
-- password changes there would both distort the limiter and make the admin
-- security log report a password change as a successful sign-in.

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Who it happened to, in readable form, kept even if the account is deleted.
  identifier TEXT NOT NULL,
  -- 'password_changed', 'password_change_failed', …
  event TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_created
  ON security_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_created
  ON security_events (created_at DESC);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Append-only from the client: a user may record their own events and read
-- them back, but never edit or delete them — an audit trail the audited party
-- can rewrite is not an audit trail.
CREATE POLICY security_events_insert_self ON security_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY security_events_select_self ON security_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
