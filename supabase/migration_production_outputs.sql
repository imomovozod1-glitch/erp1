-- =============================================================================
-- PRODUCTION OUTPUTS: several finished products per composition and per run,
-- and raw materials that do not scale with the batch
--
-- Run after: migration_production.sql, migration_production_extra_materials.sql
-- Safe to run multiple times.
--
-- Until now a composition (tarkib) made exactly one product
-- (product_boms.product_id × output_quantity), and every component scaled with
-- the size of the run. Real recipes do neither: cutting a carcass yields
-- several cuts, a dough batch yields bread and crumbs, and some materials are
-- used once per run whatever its size (a mould, a cleaning dose).
--
--   product_bom_items.consumption        'variable' scales with the run,
--                                        'fixed' is the same for any run size
--   product_bom_outputs                  what one batch yields — one row per
--                                        finished product, with an optional
--                                        cost share in percent
--   production_orders.batches            how many batches the run is
--   production_order_items.is_fixed      copied from the recipe line
--   production_order_outputs             what the run yields, and at completion
--                                        what each output was costed at
--
-- product_boms.product_id / output_quantity and production_orders.product_id /
-- quantity stay, as a mirror of the FIRST output: lists, the product page and
-- every reader written before this file keep working unchanged.
--
-- Cost of a run is split over its outputs by cost_share when the outputs carry
-- one (they must then add up to 100), otherwise in proportion to quantity — so
-- a single output gets the whole cost, as before.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columns and tables
-- -----------------------------------------------------------------------------

ALTER TABLE product_bom_items
  ADD COLUMN IF NOT EXISTS consumption TEXT NOT NULL DEFAULT 'variable';
DO $$ BEGIN
  ALTER TABLE product_bom_items
    ADD CONSTRAINT product_bom_items_consumption_check CHECK (consumption IN ('variable', 'fixed'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS batches NUMERIC(12, 3);
ALTER TABLE production_order_items ADD COLUMN IF NOT EXISTS is_fixed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS product_bom_outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bom_id UUID NOT NULL REFERENCES product_boms(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  cost_share NUMERIC(6, 3) CHECK (cost_share >= 0 AND cost_share <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_order_outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  cost_share NUMERIC(6, 3) CHECK (cost_share >= 0 AND cost_share <= 100),
  is_extra BOOLEAN NOT NULL DEFAULT false,
  -- Filled in by complete_production_order.
  unit_cost NUMERIC(12, 2),
  total_cost NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE product_bom_outputs ADD CONSTRAINT product_bom_outputs_bom_product_key UNIQUE (bom_id, product_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE production_order_outputs ADD CONSTRAINT production_order_outputs_order_product_key UNIQUE (order_id, product_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

-- -----------------------------------------------------------------------------
-- 2. Backfill: every existing composition and run gets its one output row.
--    The tenant trigger is dropped first — it stamps tenant_id from the caller's
--    profile, and the SQL editor has none — and recreated in step 3.
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS product_bom_outputs_set_tenant_id ON product_bom_outputs;
DROP TRIGGER IF EXISTS production_order_outputs_set_tenant_id ON production_order_outputs;

INSERT INTO product_bom_outputs (tenant_id, bom_id, product_id, quantity, cost_share)
SELECT b.tenant_id, b.id, b.product_id, b.output_quantity, NULL
  FROM product_boms b
 WHERE NOT EXISTS (SELECT 1 FROM product_bom_outputs o WHERE o.bom_id = b.id);

INSERT INTO production_order_outputs (tenant_id, order_id, product_id, quantity, cost_share, unit_cost, total_cost)
SELECT o.tenant_id, o.id, o.product_id, o.quantity, NULL,
       CASE WHEN o.status = 'completed' THEN o.unit_cost END,
       CASE WHEN o.status = 'completed' THEN o.total_cost END
  FROM production_orders o
 WHERE NOT EXISTS (SELECT 1 FROM production_order_outputs x WHERE x.order_id = o.id);

-- -----------------------------------------------------------------------------
-- 3. Multi-tenancy, the same steps migration_production.sql gives its tables
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['product_bom_outputs', 'production_order_outputs']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', tbl || '_set_tenant_id', tbl);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_tenant_id()',
      tbl || '_set_tenant_id', tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'tenant_isolation_' || tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated '
      'USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())) '
      'WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))',
      'tenant_isolation_' || tbl, tbl
    );

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(tenant_id)', 'idx_' || tbl || '_tenant', tbl);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_bom_outputs_bom ON product_bom_outputs(bom_id);
CREATE INDEX IF NOT EXISTS idx_product_bom_outputs_product ON product_bom_outputs(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_production_order_outputs_order ON production_order_outputs(order_id);

COMMENT ON TABLE product_bom_outputs IS 'Tarkib: what one batch yields. product_boms.product_id mirrors the first row.';
COMMENT ON TABLE production_order_outputs IS 'Ishlab chiqarish: what one run yields, and what each output was costed at.';

-- -----------------------------------------------------------------------------
-- 4. save_production_order(order) — create or edit a DRAFT.
--
-- `p_order`: { id?, order_number, bom_id?, batches?, planned_date?, notes?,
--              assigned_to?,
--              items:   [{ component_id, quantity, is_extra?, is_fixed? }],
--              outputs: [{ product_id, quantity, cost_share?, is_extra? }] }
-- A caller from before this file sends product_id + quantity instead of
-- `outputs`; that is read as a single output.
-- Output: { ok: true, id }
--         { ok: false, code: 'forbidden' | 'not_found' | 'not_draft' | 'duplicate_number' | 'cost_share_sum' }
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
  v_outputs  JSONB := p_order -> 'outputs';
  v_existing RECORD;
  v_line     RECORD;
  v_first    RECORD;
  v_shares   INT;
  v_count    INT;
  v_sum      NUMERIC;
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

  IF jsonb_typeof(v_outputs) IS DISTINCT FROM 'array' OR jsonb_array_length(v_outputs) = 0 THEN
    v_outputs := jsonb_build_array(jsonb_build_object(
      'product_id', p_order ->> 'product_id',
      'quantity', p_order -> 'quantity'
    ));
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
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_outputs) o
     WHERE NULLIF(o ->> 'product_id', '') IS NULL
        OR COALESCE((o ->> 'quantity')::numeric, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'save_production_order: every output needs a product and a positive quantity';
  END IF;

  -- A product made out of itself would be consumed and produced in one pass,
  -- its cost folding back into its own average.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_order -> 'items') l
      JOIN jsonb_array_elements(v_outputs) o ON (o ->> 'product_id') = (l ->> 'component_id')
  ) THEN
    RAISE EXCEPTION 'save_production_order: a product cannot be a component of itself';
  END IF;

  -- An output goes onto the shelf, and a service is pinned at zero stock.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_outputs) o
      JOIN products p ON p.id = (o ->> 'product_id')::uuid
     WHERE COALESCE(p.is_service, false)
  ) THEN
    RAISE EXCEPTION 'save_production_order: a service cannot be produced — it holds no stock';
  END IF;

  -- Foreign keys are checked with RLS bypassed: refuse another tenant's product.
  IF EXISTS (
    SELECT 1
      FROM (
        SELECT (o ->> 'product_id')::uuid AS id FROM jsonb_array_elements(v_outputs) o
        UNION
        SELECT (l ->> 'component_id')::uuid FROM jsonb_array_elements(p_order -> 'items') l
      ) referenced
     WHERE NOT EXISTS (
       SELECT 1 FROM products p WHERE p.id = referenced.id AND p.tenant_id = get_my_tenant_id()
     )
  ) THEN
    RAISE EXCEPTION 'save_production_order: a referenced product does not belong to this tenant';
  END IF;

  -- Cost shares are all-or-nothing and must add up to 100.
  SELECT count(*), count(NULLIF(o ->> 'cost_share', '')), COALESCE(sum(NULLIF(o ->> 'cost_share', '')::numeric), 0)
    INTO v_count, v_shares, v_sum
    FROM jsonb_array_elements(v_outputs) o;
  IF v_shares > 0 AND (v_shares <> v_count OR abs(v_sum - 100) > 0.01) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'cost_share_sum');
  END IF;

  SELECT (o ->> 'product_id')::uuid AS product_id, (o ->> 'quantity')::numeric AS quantity
    INTO v_first
    FROM jsonb_array_elements(v_outputs) WITH ORDINALITY AS t(o, n)
   ORDER BY n
   LIMIT 1;

  v_assigned := COALESCE(v_assigned, v_uid);
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_assigned AND tenant_id = get_my_tenant_id()) THEN
    RAISE EXCEPTION 'save_production_order: assignee % is not a member of this tenant', v_assigned;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO production_orders (
      order_number, bom_id, batches, product_id, quantity, status, planned_date,
      extra_cost, notes, created_by, assigned_to
    ) VALUES (
      p_order ->> 'order_number',
      NULLIF(p_order ->> 'bom_id', '')::uuid,
      NULLIF(p_order ->> 'batches', '')::numeric,
      v_first.product_id,
      v_first.quantity,
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
    IF v_existing.status <> 'draft' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_draft');
    END IF;

    UPDATE production_orders
       SET order_number = COALESCE(NULLIF(p_order ->> 'order_number', ''), order_number),
           bom_id = NULLIF(p_order ->> 'bom_id', '')::uuid,
           batches = NULLIF(p_order ->> 'batches', '')::numeric,
           product_id = v_first.product_id,
           quantity = v_first.quantity,
           planned_date = NULLIF(p_order ->> 'planned_date', '')::date,
           extra_cost = COALESCE((p_order ->> 'extra_cost')::numeric, 0),
           notes = NULLIF(p_order ->> 'notes', ''),
           assigned_to = v_assigned
     WHERE id = v_id;

    DELETE FROM production_order_items WHERE order_id = v_id;
    DELETE FROM production_order_outputs WHERE order_id = v_id;
  END IF;

  FOR v_line IN
    SELECT (l ->> 'component_id')::uuid AS component_id,
           SUM((l ->> 'quantity')::numeric) AS quantity,
           bool_or(COALESCE((l ->> 'is_extra')::boolean, false)) AS is_extra,
           bool_and(COALESCE((l ->> 'is_fixed')::boolean, false)) AS is_fixed
      FROM jsonb_array_elements(p_order -> 'items') l
     GROUP BY 1
     ORDER BY 1
  LOOP
    INSERT INTO production_order_items (order_id, component_id, quantity, is_extra, is_fixed)
    VALUES (v_id, v_line.component_id, v_line.quantity, v_line.is_extra, v_line.is_fixed);
  END LOOP;

  -- Inserted in the order given, so the first output stays first on screen.
  FOR v_line IN
    SELECT (o ->> 'product_id')::uuid AS product_id,
           SUM((o ->> 'quantity')::numeric) AS quantity,
           MAX(NULLIF(o ->> 'cost_share', '')::numeric) AS cost_share,
           bool_or(COALESCE((o ->> 'is_extra')::boolean, false)) AS is_extra,
           MIN(n) AS position
      FROM jsonb_array_elements(v_outputs) WITH ORDINALITY AS t(o, n)
     GROUP BY 1
     ORDER BY position
  LOOP
    INSERT INTO production_order_outputs (order_id, product_id, quantity, cost_share, is_extra, created_at)
    VALUES (v_id, v_line.product_id, v_line.quantity, v_line.cost_share, v_line.is_extra,
            clock_timestamp());
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id);

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'code', 'duplicate_number');
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. complete_production_order(order_id, today) — the run happens.
--
--   * every component is checked against stock, then drawn out of its cost
--     layers under the tenant's costing method;
--   * each output enters stock with an `in` movement and its own cost layer,
--     at its share of (components + extra_cost) divided by its quantity.
--
-- Output: { ok: true, total_cost, unit_cost }   (unit_cost of the first output)
--         { ok: false, code: 'forbidden' | 'not_found' | 'not_draft' }
--         { ok: false, code: 'insufficient_stock', product_id, product_name, available, required }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_production_order(p_order_id UUID, p_today DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_order      RECORD;
  v_line       RECORD;
  v_costing    TEXT;
  v_stock      NUMERIC;
  v_name       TEXT;
  v_service    BOOLEAN;
  v_unit_cost  NUMERIC;
  v_before     NUMERIC;
  v_after      NUMERIC;
  v_total      NUMERIC := 0;
  v_use_shares BOOLEAN;
  v_out_qty    NUMERIC;
  v_out_total  NUMERIC;
  v_out_unit   NUMERIC;
  v_first_unit NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'complete_production_order: not authenticated';
  END IF;
  IF NOT app_can('production', 'edit') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT id, order_number, product_id, quantity, status, extra_cost, assigned_to
    INTO v_order
    FROM production_orders
   WHERE id = p_order_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF NOT app_owns('production', v_order.assigned_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  IF v_order.status <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_draft');
  END IF;

  -- A run saved by the older function has no output rows yet.
  IF NOT EXISTS (SELECT 1 FROM production_order_outputs WHERE order_id = p_order_id) THEN
    INSERT INTO production_order_outputs (order_id, product_id, quantity)
    VALUES (p_order_id, v_order.product_id, v_order.quantity);
  END IF;

  SELECT costing_method::text INTO v_costing FROM tenants WHERE id = get_my_tenant_id();
  v_costing := COALESCE(v_costing, 'fifo');

  -- Every product the run touches is locked in one fixed order, so two runs
  -- sharing a material queue up instead of deadlocking.
  PERFORM 1
     FROM products
    WHERE id IN (
      SELECT component_id FROM production_order_items WHERE order_id = p_order_id
      UNION
      SELECT product_id FROM production_order_outputs WHERE order_id = p_order_id
    )
    ORDER BY id
      FOR UPDATE;

  FOR v_line IN
    SELECT component_id, SUM(quantity) AS quantity
      FROM production_order_items
     WHERE order_id = p_order_id
     GROUP BY 1
     ORDER BY 1
  LOOP
    SELECT name, stock, COALESCE(is_service, false)
      INTO v_name, v_stock, v_service
      FROM products
     WHERE id = v_line.component_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'complete_production_order: component % not found', v_line.component_id;
    END IF;
    IF NOT v_service AND v_stock < v_line.quantity THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'insufficient_stock',
        'product_id', v_line.component_id,
        'product_name', v_name,
        'available', COALESCE(v_stock, 0),
        'required', v_line.quantity
      );
    END IF;
  END LOOP;

  FOR v_line IN
    SELECT id, component_id, quantity
      FROM production_order_items
     WHERE order_id = p_order_id
     ORDER BY component_id, created_at, id
  LOOP
    v_unit_cost := consume_cost_layers(v_line.component_id, v_line.quantity, v_costing);
    v_total := v_total + v_unit_cost * v_line.quantity;

    UPDATE production_order_items
       SET unit_cost = round(v_unit_cost, 2),
           total_cost = round(v_unit_cost * v_line.quantity, 2)
     WHERE id = v_line.id;

    SELECT COALESCE(is_service, false) INTO v_service FROM products WHERE id = v_line.component_id;
    IF NOT v_service THEN
      UPDATE products
         SET stock = stock - v_line.quantity
       WHERE id = v_line.component_id
      RETURNING stock + v_line.quantity, stock
        INTO v_before, v_after;

      INSERT INTO stock_movements (
        product_id, type, quantity, quantity_before, quantity_after,
        reference_type, reference_id, reason, unit_cost, total_cost, created_by
      ) VALUES (
        v_line.component_id, 'out', v_line.quantity, v_before, v_after,
        'production_orders', p_order_id,
        'Production ' || COALESCE(v_order.order_number, ''),
        round(v_unit_cost, 2), round(v_unit_cost * v_line.quantity, 2), v_uid
      );
    END IF;
  END LOOP;

  v_total := v_total + COALESCE(v_order.extra_cost, 0);

  SELECT bool_and(cost_share IS NOT NULL), SUM(quantity)
    INTO v_use_shares, v_out_qty
    FROM production_order_outputs
   WHERE order_id = p_order_id;

  FOR v_line IN
    SELECT id, product_id, quantity, cost_share
      FROM production_order_outputs
     WHERE order_id = p_order_id
     ORDER BY created_at, id
  LOOP
    v_out_total := CASE
      WHEN v_use_shares THEN v_total * v_line.cost_share / 100
      ELSE v_total * v_line.quantity / NULLIF(v_out_qty, 0)
    END;
    v_out_unit := COALESCE(v_out_total, 0) / v_line.quantity;
    v_first_unit := COALESCE(v_first_unit, v_out_unit);

    UPDATE products
       SET stock = stock + v_line.quantity
     WHERE id = v_line.product_id
    RETURNING stock - v_line.quantity, stock
      INTO v_before, v_after;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'complete_production_order: product % not found', v_line.product_id;
    END IF;

    INSERT INTO stock_movements (
      product_id, type, quantity, quantity_before, quantity_after,
      reference_type, reference_id, reason, unit_cost, total_cost, created_by
    ) VALUES (
      v_line.product_id, 'in', v_line.quantity, v_before, v_after,
      'production_orders', p_order_id,
      'Production ' || COALESCE(v_order.order_number, ''),
      round(v_out_unit, 2), round(COALESCE(v_out_total, 0), 2), v_uid
    );

    INSERT INTO inventory_cost_layers (product_id, quantity, remaining_qty, unit_cost, source_type, source_id)
    VALUES (v_line.product_id, v_line.quantity, v_line.quantity, round(v_out_unit, 2), 'production', p_order_id);
    PERFORM sync_product_average_cost(v_line.product_id);

    UPDATE production_order_outputs
       SET unit_cost = round(v_out_unit, 2),
           total_cost = round(COALESCE(v_out_total, 0), 2)
     WHERE id = v_line.id;
  END LOOP;

  UPDATE production_orders
     SET status = 'completed',
         completed_at = COALESCE(p_today, CURRENT_DATE),
         total_cost = round(v_total, 2),
         unit_cost = round(COALESCE(v_first_unit, 0), 2)
   WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'total_cost', round(v_total, 2), 'unit_cost', round(COALESCE(v_first_unit, 0), 2));
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. cancel_production_order(order_id) — undo a run, or drop a draft.
--
-- Every output comes back OUT of stock (refused if any of it has been sold
-- since), then every component goes back IN at the cost the run charged it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_production_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_order   RECORD;
  v_line    RECORD;
  v_layer   RECORD;
  v_costing TEXT;
  v_cost    NUMERIC;
  v_need    NUMERIC;
  v_take    NUMERIC;
  v_total   NUMERIC;
  v_before  NUMERIC;
  v_after   NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'cancel_production_order: not authenticated';
  END IF;
  IF NOT app_can('production', 'edit') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT id, order_number, product_id, quantity, status, assigned_to
    INTO v_order
    FROM production_orders
   WHERE id = p_order_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF NOT app_owns('production', v_order.assigned_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_cancelled');
  END IF;

  IF v_order.status = 'draft' THEN
    UPDATE production_orders SET status = 'cancelled' WHERE id = p_order_id;
    RETURN jsonb_build_object('ok', true, 'reversed', false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM production_order_outputs WHERE order_id = p_order_id) THEN
    INSERT INTO production_order_outputs (order_id, product_id, quantity)
    VALUES (p_order_id, v_order.product_id, v_order.quantity);
  END IF;

  SELECT costing_method::text INTO v_costing FROM tenants WHERE id = get_my_tenant_id();
  v_costing := COALESCE(v_costing, 'fifo');

  PERFORM 1
     FROM products
    WHERE id IN (
      SELECT component_id FROM production_order_items WHERE order_id = p_order_id
      UNION
      SELECT product_id FROM production_order_outputs WHERE order_id = p_order_id
    )
    ORDER BY id
      FOR UPDATE;

  -- Every output must still be on the shelf before anything is reversed.
  FOR v_line IN
    SELECT o.product_id, SUM(o.quantity) AS quantity, MAX(p.name) AS name, MAX(p.stock) AS stock
      FROM production_order_outputs o
      LEFT JOIN products p ON p.id = o.product_id
     WHERE o.order_id = p_order_id
     GROUP BY o.product_id
  LOOP
    IF v_line.stock IS NULL THEN
      RAISE EXCEPTION 'cancel_production_order: product % not found', v_line.product_id;
    END IF;
    IF v_line.stock < v_line.quantity THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'insufficient_stock',
        'product_id', v_line.product_id,
        'product_name', v_line.name,
        'available', COALESCE(v_line.stock, 0),
        'required', v_line.quantity
      );
    END IF;
  END LOOP;

  FOR v_line IN
    SELECT product_id, quantity
      FROM production_order_outputs
     WHERE order_id = p_order_id
     ORDER BY created_at, id
  LOOP
    -- Unmaking a run takes back the units THIS run put on the shelf: its own
    -- cost layer first. Going through consume_cost_layers alone drew the
    -- oldest layers under FIFO instead, so the run's (often dearer) layer
    -- stayed behind and the product's average cost was left inflated. Only
    -- what the run's layer no longer holds — sold since, under another
    -- method's order — falls back to the tenant's method.
    v_need := v_line.quantity;
    v_total := 0;
    FOR v_layer IN
      SELECT id, remaining_qty, unit_cost
        FROM inventory_cost_layers
       WHERE product_id = v_line.product_id
         AND source_type = 'production'
         AND source_id = p_order_id
         AND remaining_qty > 0
       ORDER BY received_at, created_at, id
         FOR UPDATE
    LOOP
      EXIT WHEN v_need <= 0;
      v_take := LEAST(v_layer.remaining_qty, v_need);
      UPDATE inventory_cost_layers SET remaining_qty = remaining_qty - v_take WHERE id = v_layer.id;
      v_total := v_total + v_take * v_layer.unit_cost;
      v_need := v_need - v_take;
    END LOOP;
    IF v_need > 0 THEN
      v_total := v_total + consume_cost_layers(v_line.product_id, v_need, v_costing) * v_need;
    END IF;
    v_cost := v_total / v_line.quantity;

    UPDATE products
       SET stock = stock - v_line.quantity
     WHERE id = v_line.product_id
    RETURNING stock + v_line.quantity, stock
      INTO v_before, v_after;

    INSERT INTO stock_movements (
      product_id, type, quantity, quantity_before, quantity_after,
      reference_type, reference_id, reason, unit_cost, total_cost, created_by
    ) VALUES (
      v_line.product_id, 'out', v_line.quantity, v_before, v_after,
      'production_orders', p_order_id,
      'Production cancelled ' || COALESCE(v_order.order_number, ''),
      round(v_cost, 2), round(v_cost * v_line.quantity, 2), v_uid
    );

    PERFORM sync_product_average_cost(v_line.product_id);
  END LOOP;

  FOR v_line IN
    SELECT i.component_id, i.quantity, COALESCE(i.unit_cost, 0) AS unit_cost,
           COALESCE(p.is_service, false) AS is_service
      FROM production_order_items i
      LEFT JOIN products p ON p.id = i.component_id
     WHERE i.order_id = p_order_id
     ORDER BY i.component_id, i.created_at, i.id
  LOOP
    CONTINUE WHEN v_line.is_service;

    UPDATE products
       SET stock = stock + v_line.quantity
     WHERE id = v_line.component_id
    RETURNING stock - v_line.quantity, stock
      INTO v_before, v_after;

    CONTINUE WHEN NOT FOUND;

    INSERT INTO stock_movements (
      product_id, type, quantity, quantity_before, quantity_after,
      reference_type, reference_id, reason, unit_cost, total_cost, created_by
    ) VALUES (
      v_line.component_id, 'in', v_line.quantity, v_before, v_after,
      'production_orders', p_order_id,
      'Production cancelled ' || COALESCE(v_order.order_number, ''),
      v_line.unit_cost, v_line.unit_cost * v_line.quantity, v_uid
    );

    IF v_line.unit_cost > 0 THEN
      INSERT INTO inventory_cost_layers (product_id, quantity, remaining_qty, unit_cost, source_type, source_id)
      VALUES (v_line.component_id, v_line.quantity, v_line.quantity, v_line.unit_cost, 'production_cancellation', p_order_id);
      PERFORM sync_product_average_cost(v_line.component_id);
    END IF;
  END LOOP;

  UPDATE production_orders SET status = 'cancelled' WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'reversed', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Privileges: signed-in users only.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'save_production_order(jsonb)',
    'complete_production_order(uuid, date)',
    'cancel_production_order(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
