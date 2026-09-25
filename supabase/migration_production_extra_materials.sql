-- =============================================================================
-- EXTRA MATERIALS: telling a run's recipe lines apart from its added ones
--
-- Run after: migration_production.sql
-- Safe to run multiple times.
--
-- A production run starts by copying a composition (tarkib), which fills its
-- component lines in, scaled to the batch. But a real run also eats things the
-- recipe never mentioned: a replacement for something that ran out, extra
-- packaging, a material added because this batch came out wrong. Those were
-- already addable — the form has always let a line be typed in by hand — but
-- once saved they were indistinguishable from the recipe's own lines.
--
-- `is_extra` records which is which. It changes NOTHING about how a run is
-- completed: complete_production_order() consumes every line the same way, out
-- of the same cost layers, into the same unit cost. This is a label on where
-- the line came from, so that:
--
--   * the form can group them and the user can see, at a glance, what the
--     recipe asked for versus what this particular run added;
--   * a recipe that keeps getting the same "extra" added to it is visible as
--     something to fix in the recipe itself.
--
-- Existing rows are false — every line saved before this migration came from
-- the composition or was typed in with no way to tell, and false ("part of the
-- recipe") is the reading that does not invent a distinction retroactively.
-- =============================================================================

ALTER TABLE production_order_items
  ADD COLUMN IF NOT EXISTS is_extra BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN production_order_items.is_extra IS
  'true = qo''shimcha xomashyo: added to this run by hand, not carried in from the composition. Informational only — completion consumes every line identically.';

-- -----------------------------------------------------------------------------
-- save_production_order: carry the flag through.
--
-- Restated verbatim from migration_production.sql with ONE change — the line
-- loop reads and writes is_extra. Every check it already made (permissions,
-- draft-only, non-empty items, positive quantities, no self-component, no
-- producing a service, tenant ownership of every referenced product, the
-- duplicate-number catch) is carried over unchanged; CREATE OR REPLACE cannot
-- patch a body in place, so the whole function has to be repeated.
--
-- The GROUP BY still collapses on component_id alone, exactly as before: the
-- forms refuse to list one component twice, so a group is a single line, and
-- grouping on the pair instead would let a duplicate through as two rows.
-- bool_or() then answers "was this component added by hand", which for a
-- single-row group is simply that row's flag.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION save_production_order(p_order JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_id       UUID := NULLIF(p_order ->> 'id', '')::uuid;
  v_assigned UUID := NULLIF(p_order ->> 'assigned_to', '')::uuid;
  v_existing RECORD;
  v_line     RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'save_production_order: not authenticated';
  END IF;

  IF v_id IS NULL THEN
    IF NOT (app_can('production', 'create') OR app_can('production', 'edit')) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  ELSE
    IF NOT app_can('production', 'edit') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  END IF;

  IF jsonb_typeof(p_order -> 'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_order -> 'items') = 0 THEN
    RAISE EXCEPTION 'save_production_order: a run needs at least one component';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_order -> 'items') l
     WHERE NULLIF(l ->> 'component_id', '') IS NULL
        OR COALESCE((l ->> 'quantity')::numeric, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'save_production_order: every component needs a product and a positive quantity';
  END IF;
  IF COALESCE((p_order ->> 'quantity')::numeric, 0) <= 0 THEN
    RAISE EXCEPTION 'save_production_order: the produced quantity must be positive';
  END IF;

  -- A product made out of itself would have complete_production_order consume
  -- and produce the same row in one pass, and the cost would fold back into
  -- its own average. The form blocks it; so does this, because the form is not
  -- the only thing that can call here.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_order -> 'items') l
     WHERE (l ->> 'component_id')::uuid = (p_order ->> 'product_id')::uuid
  ) THEN
    RAISE EXCEPTION 'save_production_order: a product cannot be a component of itself';
  END IF;

  -- A run puts its output on the shelf (complete_production_order does an
  -- unconditional `stock = stock + quantity`), and a service is pinned at zero
  -- by migration_services.sql. The form no longer offers one; this makes it a
  -- rule rather than a convention. Services stay legal as COMPONENTS.
  IF EXISTS (
    SELECT 1 FROM products
     WHERE id = (p_order ->> 'product_id')::uuid
       AND COALESCE(is_service, false)
  ) THEN
    RAISE EXCEPTION 'save_production_order: a service cannot be produced — it holds no stock';
  END IF;

  -- Foreign keys are checked with RLS bypassed, so a crafted call could point a
  -- run at another tenant's product even though it could never be read back.
  -- Refuse it here instead of storing a row nobody can use.
  IF EXISTS (
    SELECT 1
      FROM (
        SELECT (p_order ->> 'product_id')::uuid AS id
        UNION
        SELECT (l ->> 'component_id')::uuid FROM jsonb_array_elements(p_order -> 'items') l
      ) referenced
     WHERE NOT EXISTS (
       SELECT 1 FROM products p WHERE p.id = referenced.id AND p.tenant_id = get_my_tenant_id()
     )
  ) THEN
    RAISE EXCEPTION 'save_production_order: a referenced product does not belong to this tenant';
  END IF;

  v_assigned := COALESCE(v_assigned, v_uid);
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_assigned AND tenant_id = get_my_tenant_id()) THEN
    RAISE EXCEPTION 'save_production_order: assignee % is not a member of this tenant', v_assigned;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO production_orders (
      order_number, bom_id, product_id, quantity, status, planned_date,
      extra_cost, notes, created_by, assigned_to
    ) VALUES (
      p_order ->> 'order_number',
      NULLIF(p_order ->> 'bom_id', '')::uuid,
      (p_order ->> 'product_id')::uuid,
      (p_order ->> 'quantity')::numeric,
      'draft',
      NULLIF(p_order ->> 'planned_date', '')::date,
      COALESCE((p_order ->> 'extra_cost')::numeric, 0),
      NULLIF(p_order ->> 'notes', ''),
      v_uid, v_assigned
    )
    RETURNING id INTO v_id;
  ELSE
    SELECT id, status, assigned_to INTO v_existing
      FROM production_orders
     WHERE id = v_id
       FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    IF NOT app_owns('production', v_existing.assigned_to) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
    -- A finished run is a record of what happened; editing it would rewrite
    -- history that stock movements and cost layers already depend on.
    IF v_existing.status <> 'draft' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_draft');
    END IF;

    UPDATE production_orders
       SET order_number = COALESCE(NULLIF(p_order ->> 'order_number', ''), order_number),
           bom_id = NULLIF(p_order ->> 'bom_id', '')::uuid,
           product_id = (p_order ->> 'product_id')::uuid,
           quantity = (p_order ->> 'quantity')::numeric,
           planned_date = NULLIF(p_order ->> 'planned_date', '')::date,
           extra_cost = COALESCE((p_order ->> 'extra_cost')::numeric, 0),
           notes = NULLIF(p_order ->> 'notes', ''),
           assigned_to = v_assigned
     WHERE id = v_id;

    DELETE FROM production_order_items WHERE order_id = v_id;
  END IF;

  FOR v_line IN
    SELECT (l ->> 'component_id')::uuid AS component_id,
           SUM((l ->> 'quantity')::numeric) AS quantity,
           -- Absent or malformed reads as false: a caller that predates this
           -- migration is saying "recipe line", which is what it always meant.
           bool_or(COALESCE((l ->> 'is_extra')::boolean, false)) AS is_extra
      FROM jsonb_array_elements(p_order -> 'items') l
     GROUP BY 1
     ORDER BY 1
  LOOP
    INSERT INTO production_order_items (order_id, component_id, quantity, is_extra)
    VALUES (v_id, v_line.component_id, v_line.quantity, v_line.is_extra);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id);

-- production_orders_tenant_number_key. Reached both from the INSERT and the
-- UPDATE above, so it is caught once here rather than guarded with a SELECT
-- that another session could race past between the check and the write.
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'code', 'duplicate_number');
END;
$$;
