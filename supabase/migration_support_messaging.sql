-- =============================================================================
-- SUPPORT MESSAGING (tenant ↔ support agent, and admin → support agent)
-- Safe to run multiple times. Run AFTER migration_support_agents.sql.
--
-- Why this exists
-- ---------------
-- The tenant Support page had a "send us a ticket" form that was a prop: its
-- submit handler ran a setTimeout, showed a success toast and threw the text
-- away. Nothing was ever stored, so nothing could ever be answered. The
-- support portal, correspondingly, could only list which tenants an agent was
-- assigned to.
--
-- Two conversation kinds, one table pair
-- --------------------------------------
-- `support_threads.kind` distinguishes them because they share every other
-- field and all of the message plumbing:
--
--   'tenant' — a tenant user's ticket. tenant_id + created_by are set, and
--              agent_id is the agent assigned to that tenant at creation time.
--   'agent'  — a message from a super-admin to one agent (no tenant involved).
--              tenant_id and created_by are NULL, agent_id is the recipient.
--
-- Access model
-- ------------
-- Tenant users reach their own tenant's threads through normal RLS. Support
-- agents and super-admins have no `authenticated` policies anywhere in this
-- schema (see migration_support_agents.sql), so their side goes through
-- service-role server routes under /api/support/** and /api/admin/**, exactly
-- like every other agent/admin query.
--
-- `read_by_tenant_at` / `read_by_staff_at` are what drive the unread badge on
-- each side; a NULL means "not yet seen by that side".
-- =============================================================================

CREATE TABLE IF NOT EXISTS support_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL DEFAULT 'tenant' CHECK (kind IN ('tenant', 'agent')),

  -- Set for kind='tenant'. ON DELETE CASCADE: a deleted tenant's tickets have
  -- no meaning, and the admin console really does delete tenants.
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- The tenant user who opened the ticket; this is who gets notified when an
  -- answer arrives. SET NULL so removing an employee doesn't erase history.
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Recipient (kind='agent') or the tenant's assigned agent (kind='tenant').
  agent_id UUID REFERENCES support_agents(id) ON DELETE SET NULL,

  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),

  -- Denormalised so the thread lists can sort without touching messages.
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT support_threads_tenant_kind CHECK (
    (kind = 'tenant' AND tenant_id IS NOT NULL) OR
    (kind = 'agent'  AND tenant_id IS NULL AND agent_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,

  -- Copied from the thread so the tenant RLS policy below is a plain column
  -- comparison instead of a subquery back into support_threads.
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  sender_role TEXT NOT NULL CHECK (sender_role IN ('tenant', 'agent', 'admin')),
  sender_id UUID,
  -- Snapshotted: the sender may be deleted later, and a transcript that turns
  -- into "(unknown) said…" is worse than a stale name.
  sender_name TEXT NOT NULL,

  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),

  read_by_tenant_at TIMESTAMPTZ,
  read_by_staff_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_support_threads_updated_at ON support_threads;
CREATE TRIGGER update_support_threads_updated_at
  BEFORE UPDATE ON support_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Tenant-side RLS ────────────────────────────────────────────────────────
-- Scoped to the tenant, not to the individual author: a company's admin should
-- be able to read and continue a ticket a colleague opened. Agents and admins
-- deliberately get no policy here — they come in via service-role routes.
--
-- No set_tenant_id() trigger: agent and admin inserts run as service-role with
-- auth.uid() NULL, and for kind='agent' tenant_id must stay NULL. The tenant
-- INSERT path is pinned by the WITH CHECK below instead.

DO $$ BEGIN
  CREATE POLICY "tenant_read_own_support_threads" ON support_threads FOR SELECT TO authenticated
    USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_create_support_threads" ON support_threads FOR INSERT TO authenticated
    WITH CHECK (kind = 'tenant' AND tenant_id = get_my_tenant_id() AND created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_read_own_support_messages" ON support_messages FOR SELECT TO authenticated
    USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  -- sender_role is pinned to 'tenant': a tenant user must not be able to post
  -- a message that renders as though support or the vendor wrote it.
  CREATE POLICY "tenant_write_support_messages" ON support_messages FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_my_tenant_id() AND sender_role = 'tenant' AND sender_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  -- Only so the tenant can stamp replies as read. Column-level grants below
  -- keep this from reaching the message body or the staff-side read stamp.
  CREATE POLICY "tenant_mark_support_messages_read" ON support_messages FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

REVOKE UPDATE ON public.support_messages FROM authenticated;
GRANT UPDATE (read_by_tenant_at) ON public.support_messages TO authenticated;

CREATE INDEX IF NOT EXISTS idx_support_threads_tenant ON support_threads(tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_threads_agent ON support_threads(agent_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON support_messages(thread_id, created_at);
-- Powers the tenant's unread badge: "replies to me that I haven't read yet".
CREATE INDEX IF NOT EXISTS idx_support_messages_unread_tenant
  ON support_messages(tenant_id) WHERE read_by_tenant_at IS NULL;
