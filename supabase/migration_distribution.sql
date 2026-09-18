-- =============================================================================
-- DISTRIBUTION (Distributsiya): routes and deliveries
--
-- Run after: migration_multi_tenant.sql, migration_assignee_master_data.sql,
--            migration_business_rpc.sql
-- Safe to run multiple times.
--
-- MARSHRUT (distribution_routes + distribution_route_stops) — an agent's round:
-- which customers they visit, in what order, on which day of the week. Pure
-- reference data; writing one moves nothing.
--
-- YETKAZIB BERISH (deliveries) — getting one sale to the customer. A delivery
-- moves NO stock and NO money: `create_sale` already took the goods off the
-- shelf and recorded the payment or the debt when the sale was rung up. What a
-- delivery tracks is where the goods physically are, and who has them.
--
-- That is why only ONE function lives here. set_delivery_status() is a database
-- function not because it touches stock — it does not — but because it moves
-- the delivery AND the sale it belongs to together:
--
--   in_transit  → the sales order goes confirmed → shipped
--   delivered   → the sales order goes shipped  → delivered
--
-- Doing that from the browser would need two writes that can half-fail, and
-- would force every courier to hold `sales.edit` just to mark a parcel handed
-- over. Inside the function the caller needs `distribution.edit` only, and the
-- order move is attempted, not required: a sale that was cancelled or already
-- delivered simply keeps its status, and the result says so.
--
-- SECURITY INVOKER, so tenant RLS and the set_tenant_id() triggers apply, and
-- the RBAC matrix is checked with app_can() — see migration_business_rpc.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS distribution_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- The agent who works this round. A tenant member, not a separate identity:
  -- they log in, sell and get paid as staff already.
  agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- ISO weekday, 1 = Monday. NULL = the round has no fixed day.
  weekday SMALLINT CHECK (weekday IS NULL OR weekday BETWEEN 1 AND 7),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS distribution_route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES distribution_routes(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  -- Visit order along the round, 1-based.
  position INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A customer appears once on a round: twice is an editing mistake, never two
-- visits (that would be two rounds).
DO $$ BEGIN
  ALTER TABLE distribution_route_stops
    ADD CONSTRAINT distribution_route_stops_route_customer_key UNIQUE (route_id, customer_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('pending', 'in_transit', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  delivery_number TEXT NOT NULL,
  -- ON DELETE SET NULL, not CASCADE: a delivery that happened stays on the
  -- books even if the paperwork behind it is later removed.
  order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  route_id UUID REFERENCES distribution_routes(id) ON DELETE SET NULL,
  -- Who is carrying it. Often the route's agent, but a one-off delivery has a
  -- courier and no round at all, so this is its own column.
  agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status delivery_status NOT NULL DEFAULT 'pending',
  planned_date DATE,
  delivered_at DATE,
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE distribution_routes
    ADD CONSTRAINT distribution_routes_tenant_name_key UNIQUE (tenant_id, name);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE deliveries
    ADD CONSTRAINT deliveries_tenant_number_key UNIQUE (tenant_id, delivery_number);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

-- -----------------------------------------------------------------------------
-- 2. Multi-tenancy: the same six steps every business table gets
--    (see migration_multi_tenant.sql)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['distribution_routes', 'distribution_route_stops', 'deliveries']
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

CREATE INDEX IF NOT EXISTS idx_distribution_routes_agent ON distribution_routes(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_distribution_route_stops_route ON distribution_route_stops(route_id, position);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_agent ON deliveries(tenant_id, agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);

-- One sale, one live delivery. The "new delivery" picker already hides orders
-- that have one, but a picker is a convenience, not a rule: an edit that
-- re-points a delivery, or any direct write, could still put the same sale on
-- two rounds and have two couriers turn up. Cancelled deliveries are excluded
-- so a mistake can be cancelled and redone.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_deliveries_live_order
  ON deliveries(order_id)
  WHERE order_id IS NOT NULL AND status <> 'cancelled';

DROP TRIGGER IF EXISTS update_distribution_routes_updated_at ON distribution_routes;
CREATE TRIGGER update_distribution_routes_updated_at
  BEFORE UPDATE ON distribution_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE distribution_routes IS 'Marshrut: which customers an agent visits, in what order, on which weekday.';
COMMENT ON TABLE deliveries IS 'Yetkazib berish: where one sale physically is. Moves no stock — create_sale already did.';

-- -----------------------------------------------------------------------------
-- 3. set_delivery_status(delivery_id, status, today)
--
-- The delivery moves, and the sale it belongs to follows where that is legal.
--
-- Output: { ok: true, status, order_status }   -- order_status = NULL when the
--                                                 sale was left where it was
--         { ok: false, code: 'forbidden' | 'not_found' | 'invalid_transition' }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_delivery_status(p_delivery_id UUID, p_status TEXT, p_today DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_delivery     RECORD;
  v_order_status TEXT;
  v_want_order   TEXT;
  v_new_order    TEXT := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'set_delivery_status: not authenticated';
  END IF;
  IF NOT app_can('distribution', 'edit') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  IF p_status NOT IN ('pending', 'in_transit', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'set_delivery_status: unknown status %', p_status;
  END IF;

  SELECT id, status::text AS status, order_id, assigned_to
    INTO v_delivery
    FROM deliveries
   WHERE id = p_delivery_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF NOT app_owns('distribution', v_delivery.assigned_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  -- Mirrors DELIVERY_TRANSITIONS in src/lib/statuses.ts.
  IF NOT p_status = ANY (CASE v_delivery.status
      WHEN 'pending'    THEN ARRAY['in_transit', 'cancelled']
      WHEN 'in_transit' THEN ARRAY['delivered', 'cancelled']
      ELSE ARRAY[]::text[]
    END) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_transition');
  END IF;

  UPDATE deliveries
     SET status = p_status::delivery_status,
         delivered_at = CASE WHEN p_status = 'delivered' THEN COALESCE(p_today, CURRENT_DATE) END
   WHERE id = p_delivery_id;

  -- Carry the sale along, but only where ORDER_TRANSITIONS allows it. A sale
  -- that was cancelled, or delivered at the counter before the courier got
  -- round to the paperwork, keeps the status it has.
  IF v_delivery.order_id IS NOT NULL AND p_status IN ('in_transit', 'delivered') THEN
    v_want_order := CASE p_status WHEN 'in_transit' THEN 'shipped' ELSE 'delivered' END;

    SELECT status::text INTO v_order_status
      FROM sales_orders
     WHERE id = v_delivery.order_id
       FOR UPDATE;

    IF FOUND AND v_want_order = ANY (CASE v_order_status
        WHEN 'draft' THEN ARRAY['confirmed']
        WHEN 'pending' THEN ARRAY['confirmed']
        WHEN 'confirmed' THEN ARRAY['shipped']
        WHEN 'shipped' THEN ARRAY['delivered']
        ELSE ARRAY[]::text[]
      END) THEN
      UPDATE sales_orders SET status = v_want_order::order_status WHERE id = v_delivery.order_id;
      v_new_order := v_want_order;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', p_status, 'order_status', v_new_order);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Privileges: signed-in users only, same as the other business functions.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY['set_delivery_status(uuid, text, date)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- PostgREST caches the schema; make the new tables and function callable right away.
NOTIFY pgrst, 'reload schema';
