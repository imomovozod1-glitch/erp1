-- =============================================================================
-- SUPPORT MESSAGES: pin tenant inserts to the tenant's own thread
-- Safe to run multiple times. Run AFTER migration_support_messaging.sql.
--
-- "tenant_write_support_messages" only checked the message's own tenant_id,
-- never which thread it points at. thread_id is a plain FK, so a tenant user
-- with a known thread id could append a message to another tenant's ticket or
-- to an admin → agent thread (kind='agent'), which the support portal then
-- renders as part of that conversation. The message's tenant_id is copied
-- from the thread by design (see migration_support_messaging.sql), so the
-- check below requires the two to agree and the thread to be a tenant ticket.
-- =============================================================================

DROP POLICY IF EXISTS "tenant_write_support_messages" ON support_messages;

CREATE POLICY "tenant_write_support_messages" ON support_messages FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_my_tenant_id()
    AND sender_role = 'tenant'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_threads t
      WHERE t.id = support_messages.thread_id
        AND t.kind = 'tenant'
        AND t.tenant_id = support_messages.tenant_id
    )
  );
