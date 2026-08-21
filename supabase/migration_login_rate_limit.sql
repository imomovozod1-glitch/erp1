-- Login brute-force protection: tracks every login attempt (tenant phone
-- login and super-admin email login share this table) so a server route can
-- reject further attempts once an identifier or IP has too many recent
-- failures. Written/read only via the service-role key from
-- src/lib/rate-limit.ts — no `authenticated`/`anon` RLS policy is defined,
-- so the browser can never reach this table directly (same pattern as
-- `super_admins`).

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  ip TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_created
  ON login_attempts (identifier, created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created
  ON login_attempts (ip, created_at);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
