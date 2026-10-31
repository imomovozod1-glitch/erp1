-- ===================================================================
-- PERMISSION LEVELS: "by department" for the money and stock functions
-- ===================================================================
-- Run after migration_business_rpc.sql. Safe to run again.
--
-- The new permissions editor stores per-section levels in
-- profiles.permissions -> <module> -> levels, and summarises them in the flags
-- app_can and app_data_scope already read, so neither needs to change. The one
-- thing the summary cannot say to them is "by department": it is stored as
-- scope = 'own' plus department = true, which an older app_owns reads as plain
-- 'own' (stricter, never wider). This file teaches app_owns the rest.
--
-- Only app_owns is replaced. Do NOT re-run migration_business_rpc.sql for it:
-- that takes create_sale and others back to their older versions.

-- Is `p_assigned_to` in the caller's department, for a module on department
-- level? SECURITY DEFINER only to read the caller's own profile, like app_can.
CREATE OR REPLACE FUNCTION app_same_department(p_module TEXT, p_assigned_to UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM profiles me
      JOIN profiles them
        ON them.tenant_id = me.tenant_id
       AND them.department_id = me.department_id
     WHERE me.id = auth.uid()
       AND them.id = p_assigned_to
       AND (me.permissions -> p_module ->> 'department') = 'true'
  )
$$;

CREATE OR REPLACE FUNCTION app_owns(p_module TEXT, p_assigned_to UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT app_data_scope(p_module) = 'all'
      OR p_assigned_to IS NOT DISTINCT FROM auth.uid()
      OR app_same_department(p_module, p_assigned_to)
$$;

REVOKE ALL ON FUNCTION app_same_department(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_same_department(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION app_same_department(TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
