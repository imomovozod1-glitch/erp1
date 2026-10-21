-- Sign-up requests ("ariza") from the public landing page (falco.business).
-- Anyone can submit one, so rows are written only by POST /api/leads with the
-- service-role key, and read/updated only by the super-admin console
-- (/admin/leads). RLS is on with NO policy for `anon` or `authenticated`, so the
-- browser can never reach this table directly — the same pattern as
-- `login_attempts` and `super_admins`. Re-runnable. Needs no other migration.

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  comment TEXT,
  -- The language of the page the request came from (uz / ru / en).
  lang TEXT,
  -- Client IP, kept only to throttle repeated submissions (src/app/api/leads).
  ip TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_ip_created ON leads (ip, created_at);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
