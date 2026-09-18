-- =============================================================================
-- PRODUCTION (Ishlab chiqarish): compositions and production orders
--
-- Run after: migration_multi_tenant.sql, migration_inventory_costing.sql,
--            migration_assignee_master_data.sql, migration_business_rpc.sql
-- Safe to run multiple times.
--
-- Two ideas, in the order the screens use them:
--
--   TARKIB (product_boms + product_bom_items) — the recipe. "One batch of this
--   finished product is made from these components in these quantities." It is
--   reference data: writing one moves nothing.
--
--   ISHLAB CHIQARISH (production_orders + production_order_items) — one actual
--   run of a recipe. A draft reserves nothing; COMPLETING it is the event that
--   moves goods: the components leave stock, the finished product enters it,
--   and the cost of what was consumed (plus the run's extra costs — wages,
--   power, packaging) becomes the finished product's cost layer.
--
-- Because that is stock and cost changing together, it lives in the database
-- as one transaction, exactly like create_sale and receive_purchase — see the
-- header of migration_business_rpc.sql for why. The three entry points are
-- SECURITY INVOKER, so tenant RLS and the set_tenant_id() triggers apply, and
-- they check the RBAC matrix themselves through app_can():
--
--   save_production_order       production.create or production.edit
--   complete_production_order   production.edit, own
--   cancel_production_order     production.edit, own
--
-- A refusal comes back as { ok: false, code, ... } and nothing is written.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

-- The recipe header. `output_quantity` is what ONE batch yields, so a recipe
-- can be written the way it is actually worked ("this mix makes 40 loaves")
-- instead of being forced down to a per-unit fiction.
CREATE TABLE IF NOT EXISTS product_boms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  output_quantity NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (output_quantity > 0),
  -- Everything the batch costs that is not a component: wages, power, packaging.
  extra_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (extra_cost >= 0),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_bom_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bom_id UUID NOT NULL REFERENCES product_boms(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One component cannot be listed twice in the same recipe: two rows for the
-- same thing are an editing mistake, never a quantity of two.
DO $$ BEGIN
  ALTER TABLE product_bom_items ADD CONSTRAINT product_bom_items_bom_component_key UNIQUE (bom_id, component_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE production_status AS ENUM ('draft', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS production_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  -- The recipe this run was started from, kept for reference only: the lines
  -- below are the authority, because the recipe may be edited afterwards and
  -- must not retroactively change what a finished run consumed.
  bom_id UUID REFERENCES product_boms(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  status production_status NOT NULL DEFAULT 'draft',
  planned_date DATE,
  completed_at DATE,
  extra_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (extra_cost >= 0),
  -- Written by complete_production_order: components consumed + extra_cost,
  -- and that divided by `quantity`.
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  -- Already scaled to the run: the recipe's per-batch figure times how many
  -- batches this order is, and editable before it is completed.
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  -- Filled in at completion, from the cost layers actually drawn down.
  unit_cost NUMERIC(12, 2),
  total_cost NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE production_orders ADD CONSTRAINT production_orders_tenant_number_key UNIQUE (tenant_id, order_number);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

-- -----------------------------------------------------------------------------
-- 2. Multi-tenancy: the same six steps every business table gets
--    (see migration_multi_tenant.sql)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['product_boms', 'product_bom_items', 'production_orders', 'production_order_items']
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

CREATE INDEX IF NOT EXISTS idx_product_boms_product ON product_boms(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_bom_items_bom ON product_bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_orders_assigned ON production_orders(tenant_id, assigned_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_order_items_order ON production_order_items(order_id);

DROP TRIGGER IF EXISTS update_product_boms_updated_at ON product_boms;
CREATE TRIGGER update_product_boms_updated_at
  BEFORE UPDATE ON product_boms FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_production_orders_updated_at ON production_orders;
CREATE TRIGGER update_production_orders_updated_at
  BEFORE UPDATE ON production_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE product_boms IS 'Tarkib: what one batch of a finished product is made from. Reference data — writing one moves no stock.';
COMMENT ON TABLE production_orders IS 'Ishlab chiqarish: one run of a recipe. Only complete_production_order() moves stock.';

-- -----------------------------------------------------------------------------
-- 3. save_production_order(order) — create or edit a DRAFT, header and lines
--    together. Moves nothing; it exists so a run and its component list can
--    never be half-written.
--
-- `p_order`: { id?, order_number, bom_id?, product_id, quantity, planned_date?,
--              extra_cost?, notes?, assigned_to?,
--              items: [{ component_id, quantity }] }
-- Output: { ok: true, id }
--         { ok: false, code: 'forbidden' | 'not_found' | 'not_draft' | 'duplicate_number' }
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
           SUM((l ->> 'quantity')::numeric) AS quantity
      FROM jsonb_array_elements(p_order -> 'items') l
     GROUP BY 1
     ORDER BY 1
  LOOP
    INSERT INTO production_order_items (order_id, component_id, quantity)
    VALUES (v_id, v_line.component_id, v_line.quantity);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id);

-- production_orders_tenant_number_key. Reached both from the INSERT and the
-- UPDATE above, so it is caught once here rather than guarded with a SELECT
-- that another session could race past between the check and the write.
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'code', 'duplicate_number');
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. complete_production_order(order_id, today) — the run actually happens.
--
--   * every component is checked against stock, then drawn out of its cost
--     layers under the tenant's costing method — so what the run cost is what
--     the goods it ate were really carried at, not a list price;
--   * each component leaves stock with an `out` movement;
--   * the finished product enters stock with an `in` movement and ONE cost
--     layer at (components + extra_cost) / quantity, which is what every later
--     sale of it will be costed from.
--
-- Output: { ok: true, total_cost, unit_cost }
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
  v_uid       UUID := auth.uid();
  v_order     RECORD;
  v_line      RECORD;
  v_costing   TEXT;
  v_stock     NUMERIC;
  v_name      TEXT;
  v_service   BOOLEAN;
  v_unit_cost NUMERIC;
  v_before    NUMERIC;
  v_after     NUMERIC;
  v_total     NUMERIC := 0;
  v_per_unit  NUMERIC;
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

  SELECT costing_method::text INTO v_costing FROM tenants WHERE id = get_my_tenant_id();
  v_costing := COALESCE(v_costing, 'fifo');

  -- Everything is checked before anything is written, and the rows are locked
  -- in a fixed order so two runs eating the same flour queue up instead of
  -- deadlocking. A service among the components is skipped, not refused: it
  -- holds no stock (migration_services.sql) and costs what its card says.
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
     WHERE id = v_line.component_id
       FOR UPDATE;
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

  -- The finished product is locked too, after the components, in case a recipe
  -- ever lists something made of itself.
  PERFORM 1 FROM products WHERE id = v_order.product_id FOR UPDATE;

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
        'Ishlab chiqarish ' || COALESCE(v_order.order_number, ''),
        round(v_unit_cost, 2), round(v_unit_cost * v_line.quantity, 2), v_uid
      );
    END IF;
  END LOOP;

  v_total := v_total + COALESCE(v_order.extra_cost, 0);
  v_per_unit := v_total / v_order.quantity;

  UPDATE products
     SET stock = stock + v_order.quantity
   WHERE id = v_order.product_id
  RETURNING stock - v_order.quantity, stock
    INTO v_before, v_after;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'complete_production_order: product % not found', v_order.product_id;
  END IF;

  INSERT INTO stock_movements (
    product_id, type, quantity, quantity_before, quantity_after,
    reference_type, reference_id, reason, unit_cost, total_cost, created_by
  ) VALUES (
    v_order.product_id, 'in', v_order.quantity, v_before, v_after,
    'production_orders', p_order_id,
    'Ishlab chiqarish ' || COALESCE(v_order.order_number, ''),
    round(v_per_unit, 2), round(v_total, 2), v_uid
  );

  INSERT INTO inventory_cost_layers (product_id, quantity, remaining_qty, unit_cost, source_type, source_id)
  VALUES (v_order.product_id, v_order.quantity, v_order.quantity, round(v_per_unit, 2), 'production', p_order_id);
  PERFORM sync_product_average_cost(v_order.product_id);

  UPDATE production_orders
     SET status = 'completed',
         completed_at = COALESCE(p_today, CURRENT_DATE),
         total_cost = round(v_total, 2),
         unit_cost = round(v_per_unit, 2)
   WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'total_cost', round(v_total, 2), 'unit_cost', round(v_per_unit, 2));
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. cancel_production_order(order_id) — undo a run, or drop a draft.
--
-- A draft just becomes cancelled. A completed run is reversed: the finished
-- units come back OUT of stock (refused if they are no longer there — they
-- have been sold, and unmaking them would invent goods), and every component
-- goes back IN at the cost the run charged it, as a `production_cancellation`
-- layer.
--
-- Output: { ok: true, reversed }
--         { ok: false, code: 'forbidden' | 'not_found' | 'already_cancelled' }
--         { ok: false, code: 'insufficient_stock', product_id, product_name, available, required }
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
  v_costing TEXT;
  v_stock   NUMERIC;
  v_name    TEXT;
  v_service BOOLEAN;
  v_cost    NUMERIC;
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

  SELECT costing_method::text INTO v_costing FROM tenants WHERE id = get_my_tenant_id();
  v_costing := COALESCE(v_costing, 'fifo');

  SELECT name, stock INTO v_name, v_stock
    FROM products
   WHERE id = v_order.product_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancel_production_order: product % not found', v_order.product_id;
  END IF;
  IF v_stock < v_order.quantity THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'insufficient_stock',
      'product_id', v_order.product_id,
      'product_name', v_name,
      'available', COALESCE(v_stock, 0),
      'required', v_order.quantity
    );
  END IF;

  -- Unmake the output: take the units back out, drawing down the layers so the
  -- run's own cost layer is the one that disappears.
  v_cost := consume_cost_layers(v_order.product_id, v_order.quantity, v_costing);

  UPDATE products
     SET stock = stock - v_order.quantity
   WHERE id = v_order.product_id
  RETURNING stock + v_order.quantity, stock
    INTO v_before, v_after;

  INSERT INTO stock_movements (
    product_id, type, quantity, quantity_before, quantity_after,
    reference_type, reference_id, reason, unit_cost, total_cost, created_by
  ) VALUES (
    v_order.product_id, 'out', v_order.quantity, v_before, v_after,
    'production_orders', p_order_id,
    'Ishlab chiqarish bekor qilindi ' || COALESCE(v_order.order_number, ''),
    round(v_cost, 2), round(v_cost * v_order.quantity, 2), v_uid
  );

  -- Put every component back at what the run charged it.
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

    CONTINUE WHEN NOT FOUND; -- component deleted since the run

    INSERT INTO stock_movements (
      product_id, type, quantity, quantity_before, quantity_after,
      reference_type, reference_id, reason, unit_cost, total_cost, created_by
    ) VALUES (
      v_line.component_id, 'in', v_line.quantity, v_before, v_after,
      'production_orders', p_order_id,
      'Ishlab chiqarish bekor qilindi ' || COALESCE(v_order.order_number, ''),
      v_line.unit_cost, v_line.unit_cost * v_line.quantity, v_uid
    );

    IF v_line.unit_cost > 0 THEN
      INSERT INTO inventory_cost_layers (product_id, quantity, remaining_qty, unit_cost, source_type, source_id)
      VALUES (v_line.component_id, v_line.quantity, v_line.quantity, v_line.unit_cost, 'production_cancellation', p_order_id);
      PERFORM sync_product_average_cost(v_line.component_id);
    END IF;
  END LOOP;

  PERFORM sync_product_average_cost(v_order.product_id);

  UPDATE production_orders SET status = 'cancelled' WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'reversed', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Privileges: signed-in users only, same as the other business functions.
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

-- PostgREST caches the schema; make the new tables and functions callable right away.
NOTIFY pgrst, 'reload schema';
