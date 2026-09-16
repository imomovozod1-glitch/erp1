-- =============================================================================
-- MONEY & STOCK WRITES AS DATABASE FUNCTIONS
-- Safe to run multiple times.
-- Run after: migration_multi_tenant.sql, migration_fix_profiles_rls.sql,
--            migration_inventory_costing.sql, migration_customer_credit.sql,
--            migration_transaction_categories.sql, migration_fractional_quantities.sql,
--            migration_permissions.sql, migration_rbac_actions.sql,
--            migration_document_assignee.sql, migration_assignee_master_data.sql
--
-- Why: ringing up, editing and cancelling a sale, receiving a purchase, paying
-- an invoice and every cashbox movement used to be separate browser writes. A
-- failure half-way left the books partly written, and stock / cashbox balance / customer credit / cost layers were
-- read in the browser and written back, so two tills working at once could
-- overwrite each other. Each function below is ONE transaction: everything
-- happens together or not at all, the rows it depends on are locked while it
-- runs, and balances change as `col = col ± x`, never from an earlier read.
--
-- SECURITY INVOKER: both run as the calling user, so the tenant RLS policies
-- and the set_tenant_id() insert triggers apply exactly as they do to the
-- browser's own writes — another tenant's rows are simply not visible.
--
-- They also enforce the RBAC matrix (profiles.permissions), which RLS does not.
-- The rules mirror can() / dataScope() in src/lib/permissions.ts; "own" means
-- that with an 'own' data scope only a record assigned to the caller qualifies.
--   create_sale             POS: pos.view (what the till page requires);
--                           form: sales.create or sales.edit
--   update_sale_lines       sales.edit, own
--   cancel_sales_order      sales.edit, own
--   set_order_status        sales.edit, own
--   set_invoice_status      sales.edit, own
--   accept_invoice_payment  sales.edit, own
--   save_invoice            new: sales.create or sales.edit; existing: sales.edit, own
--   receive_purchase        procurement.create or procurement.edit
--   create_cashbox          finance.create or finance.edit
--   record_cashbox_movement finance.create or finance.edit
--   save_transaction        new: finance.create or finance.edit; existing: finance.edit, own
--
-- Business refusals are returned as { ok: false, code, ... } — nothing is
-- written in that case. Anything unexpected raises and rolls back.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permission helpers
-- -----------------------------------------------------------------------------

-- JavaScript truthiness for a JSON value (`!!value.edit` in permissions.ts).
CREATE OR REPLACE FUNCTION app_jsonb_truthy(v JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NOT NULL AND v NOT IN ('null'::jsonb, 'false'::jsonb, '0'::jsonb, '""'::jsonb)
$$;

-- May the caller do `p_action` in `p_module`? Admins always may; a deactivated
-- profile never may. Legacy `{view, edit}` entries are read the way
-- normaliseModulePermission reads them: edit => create + edit, nothing more.
-- SECURITY DEFINER only to read the caller's own profile row.
CREATE OR REPLACE FUNCTION app_can(p_module TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   TEXT;
  v_active BOOLEAN;
  v_perm   JSONB;
BEGIN
  SELECT role::text, is_active, permissions -> p_module
    INTO v_role, v_active, v_perm
    FROM profiles
   WHERE id = auth.uid();

  IF NOT FOUND OR v_active IS NOT TRUE THEN
    RETURN false;
  END IF;
  IF v_role = 'admin' THEN
    RETURN true;
  END IF;
  IF v_perm IS NULL OR jsonb_typeof(v_perm) <> 'object' THEN
    RETURN false;
  END IF;

  -- Legacy shape: neither `create` nor `delete` is present.
  IF NOT (v_perm ? 'create') AND NOT (v_perm ? 'delete') THEN
    RETURN CASE p_action
      WHEN 'view' THEN app_jsonb_truthy(v_perm -> 'view') OR app_jsonb_truthy(v_perm -> 'edit')
      WHEN 'create' THEN app_jsonb_truthy(v_perm -> 'edit')
      WHEN 'edit' THEN app_jsonb_truthy(v_perm -> 'edit')
      ELSE false
    END;
  END IF;

  -- Any other action implies being able to open the module.
  IF p_action = 'view' THEN
    RETURN app_jsonb_truthy(v_perm -> 'view')
        OR app_jsonb_truthy(v_perm -> 'create')
        OR app_jsonb_truthy(v_perm -> 'edit')
        OR app_jsonb_truthy(v_perm -> 'delete')
        OR app_jsonb_truthy(v_perm -> 'approve')
        OR app_jsonb_truthy(v_perm -> 'export');
  END IF;
  RETURN app_jsonb_truthy(v_perm -> p_action);
END;
$$;

-- 'all' or 'own' — which records the caller may act on in `p_module`.
CREATE OR REPLACE FUNCTION app_data_scope(p_module TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_perm JSONB;
BEGIN
  SELECT role::text, permissions -> p_module
    INTO v_role, v_perm
    FROM profiles
   WHERE id = auth.uid();

  IF v_role = 'admin' OR v_perm IS NULL OR jsonb_typeof(v_perm) <> 'object' THEN
    RETURN 'all';
  END IF;
  IF NOT (v_perm ? 'create') AND NOT (v_perm ? 'delete') THEN
    RETURN 'all'; -- legacy entries had no scope
  END IF;
  RETURN CASE WHEN v_perm ->> 'scope' = 'own' THEN 'own' ELSE 'all' END;
END;
$$;

-- May the caller act on a record assigned to `p_assigned_to` in `p_module`?
CREATE OR REPLACE FUNCTION app_owns(p_module TEXT, p_assigned_to UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT app_data_scope(p_module) = 'all' OR p_assigned_to IS NOT DISTINCT FROM auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- Inventory costing (src/lib/inventory-costing.ts)
-- -----------------------------------------------------------------------------

-- products.cost_price = weighted average of the layers still in stock. Left
-- untouched when nothing remains (a stale number beats a misleading zero).
CREATE OR REPLACE FUNCTION sync_product_average_cost(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC;
BEGIN
  SELECT SUM(remaining_qty * unit_cost) / NULLIF(SUM(remaining_qty), 0)
    INTO v_avg
    FROM inventory_cost_layers
   WHERE product_id = p_product_id
     AND remaining_qty > 0;

  IF v_avg IS NOT NULL THEN
    UPDATE products SET cost_price = round(v_avg, 2) WHERE id = p_product_id;
  END IF;
END;
$$;

-- Draws `p_quantity` out of a product's cost layers and returns the unit cost
-- to charge for it (consumeCostLayers). FIFO walks oldest-first, LIFO
-- newest-first, and both charge each layer's own cost. AVECO charges the
-- average of what remains and depletes oldest-first. Units no layer covers
-- (overselling) are charged at the product's last known average cost.
-- The layers are locked, so two sales can never draw the same units.
CREATE OR REPLACE FUNCTION consume_cost_layers(p_product_id UUID, p_quantity NUMERIC, p_method TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_layer    RECORD;
  v_need     NUMERIC := p_quantity;
  v_take     NUMERIC;
  v_total    NUMERIC := 0;
  v_avg      NUMERIC;
  v_fallback NUMERIC;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(cost_price, 0) INTO v_fallback FROM products WHERE id = p_product_id;
  v_fallback := COALESCE(v_fallback, 0);

  IF p_method = 'aveco' THEN
    SELECT SUM(remaining_qty * unit_cost) / NULLIF(SUM(remaining_qty), 0)
      INTO v_avg
      FROM inventory_cost_layers
     WHERE product_id = p_product_id
       AND remaining_qty > 0;
    v_total := p_quantity * COALESCE(v_avg, v_fallback);
  END IF;

  FOR v_layer IN
    SELECT id, remaining_qty, unit_cost
      FROM inventory_cost_layers
     WHERE product_id = p_product_id
       AND remaining_qty > 0
     ORDER BY CASE WHEN p_method = 'lifo' THEN received_at END DESC,
              received_at ASC,
              created_at ASC,
              id
       FOR UPDATE
  LOOP
    EXIT WHEN v_need <= 0;
    v_take := LEAST(v_layer.remaining_qty, v_need);
    UPDATE inventory_cost_layers SET remaining_qty = remaining_qty - v_take WHERE id = v_layer.id;
    IF p_method <> 'aveco' THEN
      v_total := v_total + v_take * v_layer.unit_cost;
    END IF;
    v_need := v_need - v_take;
  END LOOP;

  IF p_method <> 'aveco' AND v_need > 0 THEN
    v_total := v_total + v_need * v_fallback;
  END IF;

  PERFORM sync_product_average_cost(p_product_id);

  RETURN v_total / p_quantity;
END;
$$;

-- Puts sold lines of a sale back on the shelf: stock goes up, each line is
-- logged as an `in` movement, and its units go back into a `sale_cancellation`
-- cost layer at the cost the sale was charged (returnLinesToStock).
-- `p_item_ids` NULL = every line of the order.
CREATE OR REPLACE FUNCTION return_sale_lines_to_stock(p_order_id UUID, p_item_ids UUID[], p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_line   RECORD;
  v_before NUMERIC;
  v_after  NUMERIC;
BEGIN
  FOR v_line IN
    SELECT product_id, quantity, unit_cost
      FROM sales_order_items
     WHERE order_id = p_order_id
       AND (p_item_ids IS NULL OR id = ANY (p_item_ids))
     ORDER BY product_id, created_at, id
  LOOP
    UPDATE products
       SET stock = stock + COALESCE(v_line.quantity, 0)
     WHERE id = v_line.product_id
    RETURNING stock - COALESCE(v_line.quantity, 0), stock
      INTO v_before, v_after;

    CONTINUE WHEN NOT FOUND; -- product deleted since the sale

    INSERT INTO stock_movements (
      product_id, type, quantity, quantity_before, quantity_after,
      reference_type, reference_id, reason, unit_cost, total_cost, created_by
    ) VALUES (
      v_line.product_id, 'in', COALESCE(v_line.quantity, 0), v_before, v_after,
      'sales_orders', p_order_id, p_reason,
      v_line.unit_cost,
      v_line.unit_cost * COALESCE(v_line.quantity, 0),
      auth.uid()
    );

    IF v_line.unit_cost IS NOT NULL AND COALESCE(v_line.quantity, 0) > 0 THEN
      INSERT INTO inventory_cost_layers (
        product_id, quantity, remaining_qty, unit_cost, source_type, source_id
      ) VALUES (
        v_line.product_id, v_line.quantity, v_line.quantity, v_line.unit_cost,
        'sale_cancellation', p_order_id
      );
      PERFORM sync_product_average_cost(v_line.product_id);
    END IF;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Cashbox pick (pickTargetCashbox in src/lib/finance-helpers.ts)
-- -----------------------------------------------------------------------------

-- Among the cashboxes of `p_type`, one named as the main one (newest such
-- first), otherwise the oldest. With `p_any_fallback`, all cashboxes are
-- considered when none has that type (or `p_type` is NULL). NULL = none.
-- The chosen row is locked.
CREATE OR REPLACE FUNCTION pick_cashbox(p_type TEXT, p_any_fallback BOOLEAN)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_by_type BOOLEAN := p_type IS NOT NULL
    AND EXISTS (SELECT 1 FROM cashboxes WHERE type::text = p_type);
BEGIN
  IF NOT v_by_type AND NOT p_any_fallback THEN
    RETURN NULL;
  END IF;

  SELECT id
    INTO v_id
    FROM cashboxes
   WHERE NOT v_by_type OR type::text = p_type
   ORDER BY (lower(name) LIKE '%asosiy%' OR lower(name) LIKE '%main%' OR lower(name) LIKE '%основн%') DESC,
            CASE WHEN lower(name) LIKE '%asosiy%' OR lower(name) LIKE '%main%' OR lower(name) LIKE '%основн%'
                 THEN created_at END DESC,
            created_at ASC
   LIMIT 1
     FOR UPDATE;

  RETURN v_id;
END;
$$;

-- Adds `p_amount` to `p_cashbox_id`, or — when that is NULL — to the tenant's
-- main cashbox (adjustCashboxBalance with no type). A negative amount is a
-- withdrawal and is refused when the drawer holds less. With no cashbox at
-- all, income opens a cash drawer.
-- Returns { ok: true, cashbox_id, cashbox_name } or
--         { ok: false, code: 'insufficient_cashbox', cashbox_name, balance, amount }.
CREATE OR REPLACE FUNCTION credit_cashbox(p_amount NUMERIC, p_cashbox_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id      UUID := p_cashbox_id;
  v_name    TEXT;
  v_balance NUMERIC;
BEGIN
  IF v_id IS NOT NULL THEN
    PERFORM 1 FROM cashboxes WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      v_id := NULL;
    END IF;
  END IF;
  IF v_id IS NULL THEN
    v_id := pick_cashbox(NULL, true);
  END IF;

  IF v_id IS NULL THEN
    IF p_amount < 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'insufficient_cashbox',
        'cashbox_name', NULL, 'balance', 0, 'amount', -p_amount);
    END IF;
    INSERT INTO cashboxes (name, type, balance, description)
    VALUES ('Naqd kassa', 'cash', p_amount, 'Sotuvlar va tolovlar uchun avtomatik yaratilgan kassa')
    RETURNING id, name INTO v_id, v_name;
    RETURN jsonb_build_object('ok', true, 'cashbox_id', v_id, 'cashbox_name', v_name);
  END IF;

  SELECT name, balance INTO v_name, v_balance FROM cashboxes WHERE id = v_id;
  IF p_amount < 0 AND v_balance < -p_amount THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_cashbox',
      'cashbox_name', v_name, 'balance', v_balance, 'amount', -p_amount);
  END IF;

  UPDATE cashboxes SET balance = balance + p_amount WHERE id = v_id;
  RETURN jsonb_build_object('ok', true, 'cashbox_id', v_id, 'cashbox_name', v_name);
END;
$$;

-- -----------------------------------------------------------------------------
-- create_sale(sale)
--
-- Input (JSON):
--   channel         'pos' | 'form'
--   order_number    generated by the caller (the POS receipt shows it at once)
--   invoice_number  generated by the caller
--   customer_id     uuid | null — required for a debt sale
--   payment_method  'cash' | 'card' | 'transfer' | 'debt'
--   assigned_to     uuid | null — form only; defaults to the caller
--   total_amount, discount_amount, tax_amount
--   order_date, due_date   'YYYY-MM-DD' in the caller's local time
--   items           [{ product_id, quantity, unit_price, discount_percent, total_price }]
--
-- Output:
--   { ok: true, order_id, invoice_number, applied_credit, stock_before: { product_id: stock } }
--   { ok: false, code: 'forbidden' | 'customer_required' }
--   { ok: false, code: 'insufficient_stock', product_id, product_name, available }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_sale(p_sale JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid            UUID := auth.uid();
  v_channel        TEXT := COALESCE(p_sale ->> 'channel', 'form');
  v_method         TEXT := p_sale ->> 'payment_method';
  v_order_number   TEXT := NULLIF(p_sale ->> 'order_number', '');
  v_invoice_number TEXT := NULLIF(p_sale ->> 'invoice_number', '');
  v_customer_id    UUID := NULLIF(p_sale ->> 'customer_id', '')::uuid;
  v_assigned_to    UUID := NULLIF(p_sale ->> 'assigned_to', '')::uuid;
  v_total          NUMERIC := COALESCE((p_sale ->> 'total_amount')::numeric, 0);
  v_discount       NUMERIC := COALESCE((p_sale ->> 'discount_amount')::numeric, 0);
  v_tax            NUMERIC := COALESCE((p_sale ->> 'tax_amount')::numeric, 0);
  v_order_date     DATE := COALESCE((p_sale ->> 'order_date')::date, CURRENT_DATE);
  v_due_date       DATE;
  v_is_pos         BOOLEAN;
  v_is_debt        BOOLEAN;
  v_costing        TEXT;
  v_group          RECORD;
  v_line           RECORD;
  v_name           TEXT;
  v_stock          NUMERIC;
  v_stock_before   JSONB := '{}'::jsonb;
  v_costs          JSONB := '{}'::jsonb;
  v_unit_cost      NUMERIC;
  v_before         NUMERIC;
  v_after          NUMERIC;
  v_order_id       UUID;
  v_credit         NUMERIC;
  v_applied        NUMERIC := 0;
  v_fully_paid     BOOLEAN;
  v_cashbox_id     UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'create_sale: not authenticated';
  END IF;
  IF v_channel NOT IN ('pos', 'form') THEN
    RAISE EXCEPTION 'create_sale: unknown channel %', v_channel;
  END IF;
  IF v_method IS NULL OR v_method NOT IN ('cash', 'card', 'transfer', 'debt') THEN
    RAISE EXCEPTION 'create_sale: unknown payment method %', v_method;
  END IF;
  IF v_order_number IS NULL OR v_invoice_number IS NULL THEN
    RAISE EXCEPTION 'create_sale: order_number and invoice_number are required';
  END IF;
  IF jsonb_typeof(p_sale -> 'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_sale -> 'items') = 0 THEN
    RAISE EXCEPTION 'create_sale: a sale needs at least one line';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_sale -> 'items') l
     WHERE NULLIF(l ->> 'product_id', '') IS NULL
        OR COALESCE((l ->> 'quantity')::numeric, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'create_sale: every line needs a product and a positive quantity';
  END IF;

  v_is_pos := v_channel = 'pos';
  v_is_debt := v_method = 'debt';
  v_due_date := COALESCE((p_sale ->> 'due_date')::date, v_order_date);

  IF v_is_pos THEN
    IF NOT app_can('pos', 'view') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
    -- A POS sale belongs to the cashier who rang it up.
    v_assigned_to := v_uid;
  ELSE
    IF NOT (app_can('sales', 'create') OR app_can('sales', 'edit')) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
    v_assigned_to := COALESCE(v_assigned_to, v_uid);
    -- The responsible person must be a member of this tenant.
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_assigned_to AND tenant_id = get_my_tenant_id()) THEN
      RAISE EXCEPTION 'create_sale: assignee % is not a member of this tenant', v_assigned_to;
    END IF;
  END IF;

  IF v_is_debt AND v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'customer_required');
  END IF;

  -- Stock check against the TOTAL each product is sold in this sale (a product
  -- may sit on two lines). The rows are locked in a fixed order so two tills
  -- selling the same goods queue up instead of deadlocking.
  FOR v_group IN
    SELECT (l ->> 'product_id')::uuid AS product_id, SUM((l ->> 'quantity')::numeric) AS quantity
      FROM jsonb_array_elements(p_sale -> 'items') l
     GROUP BY 1
     ORDER BY 1
  LOOP
    v_name := NULL;
    v_stock := NULL;
    SELECT name, stock INTO v_name, v_stock FROM products WHERE id = v_group.product_id FOR UPDATE;
    IF v_stock IS NULL OR v_stock < v_group.quantity THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'insufficient_stock',
        'product_id', v_group.product_id,
        'product_name', v_name,
        'available', COALESCE(v_stock, 0)
      );
    END IF;
    v_stock_before := v_stock_before || jsonb_build_object(v_group.product_id::text, v_stock);
  END LOOP;

  SELECT costing_method::text INTO v_costing FROM tenants WHERE id = get_my_tenant_id();
  v_costing := COALESCE(v_costing, 'fifo');

  INSERT INTO sales_orders (
    order_number, customer_id, status, total_amount, discount_amount, tax_amount,
    notes, created_by, assigned_to, order_date
  ) VALUES (
    v_order_number, v_customer_id,
    -- A counter sale is finished the moment it is rung up.
    CASE WHEN v_is_pos THEN 'delivered' ELSE 'confirmed' END::order_status,
    v_total, v_discount, v_tax,
    -- salePaymentMethod() reads the POS payment method back from here.
    CASE WHEN v_is_pos THEN 'POS Sale - Paid via ' || upper(v_method) END,
    v_uid, v_assigned_to, v_order_date
  )
  RETURNING id INTO v_order_id;

  -- Cost each product once (the layers are shared, so two lines of the same
  -- product must not walk them twice).
  FOR v_group IN
    SELECT (l ->> 'product_id')::uuid AS product_id, SUM((l ->> 'quantity')::numeric) AS quantity
      FROM jsonb_array_elements(p_sale -> 'items') l
     GROUP BY 1
     ORDER BY 1
  LOOP
    v_unit_cost := consume_cost_layers(v_group.product_id, v_group.quantity, v_costing);
    v_costs := v_costs || jsonb_build_object(v_group.product_id::text, v_unit_cost);
  END LOOP;

  -- Lines, stock and one movement per line.
  FOR v_line IN
    SELECT (l ->> 'product_id')::uuid AS product_id,
           (l ->> 'quantity')::numeric AS quantity,
           COALESCE((l ->> 'unit_price')::numeric, 0) AS unit_price,
           COALESCE((l ->> 'discount_percent')::numeric, 0) AS discount_percent,
           COALESCE((l ->> 'total_price')::numeric, 0) AS total_price
      FROM jsonb_array_elements(p_sale -> 'items') WITH ORDINALITY AS x(l, ord)
     ORDER BY ord
  LOOP
    v_unit_cost := (v_costs ->> v_line.product_id::text)::numeric;

    INSERT INTO sales_order_items (
      order_id, product_id, quantity, unit_price, unit_cost, discount_percent, total_price
    ) VALUES (
      v_order_id, v_line.product_id, v_line.quantity, v_line.unit_price, v_unit_cost,
      v_line.discount_percent, v_line.total_price
    );

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
      'sales_orders', v_order_id,
      CASE WHEN v_is_pos THEN 'POS Sale' ELSE 'Sale ' || v_order_number END,
      v_unit_cost, v_unit_cost * v_line.quantity, v_uid
    );
  END LOOP;

  IF v_is_debt THEN
    -- Credit (haqdorlik) the customer already has is spent on this purchase
    -- first, so they never show a credit and a fresh debt for the same money.
    SELECT credit_balance INTO v_credit FROM customers WHERE id = v_customer_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'create_sale: customer % not found', v_customer_id;
    END IF;
    v_applied := LEAST(GREATEST(COALESCE(v_credit, 0), 0), v_total);
    IF v_applied > 0 THEN
      UPDATE customers SET credit_balance = credit_balance - v_applied WHERE id = v_customer_id;
    END IF;
  ELSE
    -- Cash-basis income only when money changed hands; a debt sale's income is
    -- recorded when the debt is collected.
    INSERT INTO transactions (
      type, amount, category, description, reference_type, reference_id,
      transaction_date, created_by
    ) VALUES (
      'income', v_total, 'Sales',
      CASE WHEN v_is_pos THEN 'POS Sale - Order #' ELSE 'Sale - Order #' END || v_order_number,
      'sales_orders', v_order_id, v_order_date, v_uid
    );

    -- Into the cashbox of that payment method; one is created when the tenant
    -- has none of that type yet, rather than crediting an unrelated drawer.
    v_cashbox_id := pick_cashbox(v_method, false);
    IF v_cashbox_id IS NULL THEN
      INSERT INTO cashboxes (name, type, balance, description)
      VALUES (
        CASE v_method WHEN 'cash' THEN 'Naqd kassa' WHEN 'card' THEN 'Karta kassasi' ELSE 'O''tkazma kassasi' END,
        v_method::cashbox_type,
        v_total,
        'Sotuvlar va tolovlar uchun avtomatik yaratilgan kassa'
      );
    ELSE
      UPDATE cashboxes SET balance = balance + v_total WHERE id = v_cashbox_id;
    END IF;
  END IF;

  v_fully_paid := v_is_debt AND v_applied >= v_total;

  -- Always an invoice: paid at once for cash/card/transfer, open (the debt)
  -- for a debt sale unless credit covered all of it.
  INSERT INTO invoices (
    invoice_number, order_id, customer_id, status, total_amount, paid_amount,
    issued_at, due_at, paid_at, notes, created_by, assigned_to
  ) VALUES (
    v_invoice_number, v_order_id, v_customer_id,
    CASE WHEN NOT v_is_debt OR v_fully_paid THEN 'paid' ELSE 'sent' END::invoice_status,
    v_total,
    CASE WHEN v_is_debt THEN v_applied ELSE v_total END,
    v_order_date,
    CASE WHEN v_is_debt THEN v_due_date ELSE v_order_date END,
    CASE WHEN NOT v_is_debt OR v_fully_paid THEN v_order_date END,
    CASE
      WHEN v_is_debt THEN
        'Qarzga sotildi - ' || CASE WHEN v_is_pos THEN 'POS Order #' ELSE 'Order #' END || v_order_number
        || CASE WHEN v_applied > 0
             -- formatCurrency(): whole sum, space-grouped, " soʻm"
             THEN ' (' || replace(to_char(round(v_applied), 'FM999,999,999,999,990'), ',', ' ')
                  || ' soʻm haqdorlikdan to''landi)'
             ELSE ''
           END
      WHEN v_is_pos THEN 'Paid instantly on POS via ' || v_method
      ELSE 'Paid via ' || v_method
    END,
    v_uid, v_assigned_to
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'invoice_number', v_invoice_number,
    'applied_credit', v_applied,
    'stock_before', v_stock_before
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- cancel_sales_order(order_id)
--
-- Reverses everything a sale did:
--   - goods go back into stock, each logged as an `in` movement, and the units
--     go back into a `sale_cancellation` cost layer at the cost the sale was
--     charged; `products.cost_price` is re-synced;
--   - money a cash/card/transfer sale put into a cashbox is withdrawn from the
--     cashbox of the payment method named in the order/invoice notes, and the
--     sale's income transactions are deleted;
--   - whatever the customer paid on the invoice beyond that (spent credit,
--     collected debt) goes back to `customers.credit_balance`;
--   - the invoices are cancelled, which removes a debt sale's debt.
--
-- Output:
--   { ok: true, refunded, cashbox_name, credit_restored }
--   { ok: false, code: 'forbidden' | 'not_found' | 'already_cancelled' }
--   { ok: false, code: 'insufficient_cashbox', cashbox_name, balance, amount }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_sales_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order        RECORD;
  v_refund       NUMERIC := 0;
  v_paid         NUMERIC := 0;
  v_credit       NUMERIC := 0;
  v_method       TEXT;
  -- Scalars, not a RECORD: a debt sale never picks a cashbox, and reading an
  -- unassigned RECORD's fields raises an error.
  v_cashbox_id   UUID;
  v_cashbox_name TEXT;
  v_balance      NUMERIC;
BEGIN
  IF NOT app_can('sales', 'edit') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  -- Lock the order: a second cancel of the same sale waits here, then sees
  -- `cancelled` and stops, so nothing is ever reversed twice.
  SELECT id, order_number, status, notes, customer_id, assigned_to
    INTO v_order
    FROM sales_orders
   WHERE id = p_order_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF NOT app_owns('sales', v_order.assigned_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_cancelled');
  END IF;

  -- Only a cash/card/transfer sale writes an income transaction, and its
  -- amount is exactly what went into the cashbox. A debt sale has none.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_refund
    FROM transactions
   WHERE reference_type = 'sales_orders'
     AND reference_id = p_order_id
     AND type = 'income';

  -- Anything paid on the invoices beyond that came from the customer's credit
  -- or from debt collected later.
  SELECT COALESCE(SUM(paid_amount), 0)
    INTO v_paid
    FROM invoices
   WHERE order_id = p_order_id
     AND status <> 'cancelled';

  IF v_order.customer_id IS NOT NULL THEN
    v_credit := GREATEST(0, v_paid - v_refund);
  END IF;

  IF v_refund > 0 THEN
    -- Payment method: POS writes "POS Sale - Paid via CARD" into the order
    -- notes, the sale form "Paid via card" into the invoice notes
    -- (salePaymentMethod in src/lib/status-actions.ts). NULL = primary cashbox.
    SELECT m[1]
      INTO v_method
      FROM (
        SELECT regexp_match(lower(t.note), 'paid (?:instantly on pos )?via (cash|card|transfer)\M') AS m, t.ord
          FROM (
            SELECT v_order.notes AS note, 0 AS ord
            UNION ALL
            SELECT notes, 1
              FROM invoices
             WHERE order_id = p_order_id
               AND status <> 'cancelled'
          ) t
      ) matches
     WHERE m IS NOT NULL
     ORDER BY ord
     LIMIT 1;

    -- The drawer the sale paid into, or the main one when none of that type
    -- exists (findSaleCashbox). Locked, so its balance cannot move under us.
    v_cashbox_id := pick_cashbox(v_method, true);
    IF v_cashbox_id IS NOT NULL THEN
      SELECT name, balance INTO v_cashbox_name, v_balance FROM cashboxes WHERE id = v_cashbox_id;
    END IF;

    IF v_cashbox_id IS NULL OR v_balance < v_refund THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'insufficient_cashbox',
        'cashbox_name', v_cashbox_name,
        'balance', COALESCE(v_balance, 0),
        'amount', v_refund
      );
    END IF;

    UPDATE cashboxes SET balance = balance - v_refund WHERE id = v_cashbox_id;

    DELETE FROM transactions
     WHERE reference_type = 'sales_orders'
       AND reference_id = p_order_id
       AND type = 'income';
  END IF;

  UPDATE sales_orders SET status = 'cancelled' WHERE id = p_order_id;

  -- Goods back on the shelf, one movement per line.
  PERFORM return_sale_lines_to_stock(
    p_order_id, NULL, trim('Cancelled order ' || COALESCE(v_order.order_number, ''))
  );

  IF v_credit > 0 THEN
    UPDATE customers
       SET credit_balance = credit_balance + v_credit
     WHERE id = v_order.customer_id;
  END IF;

  UPDATE invoices
     SET status = 'cancelled'
   WHERE order_id = p_order_id
     AND status <> 'cancelled';

  RETURN jsonb_build_object(
    'ok', true,
    'refunded', v_refund,
    'cashbox_name', v_cashbox_name,
    'credit_restored', v_credit
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- update_sale_lines(order_id, edits, today)
--
-- Reprices and removes lines of a sale that already happened (sale-edits.ts):
--   - a removed line goes back into stock and is deleted;
--   - a new price rewrites the line total, and the order total is recomputed
--     the way the till computes it (lines − order discount + tax);
--   - the difference moves money: a cash/card/transfer sale gets it added to /
--     taken out of its cashbox and its income transaction corrected; a debt
--     sale gets its invoice total changed — and anything already paid beyond
--     the new total becomes customer credit.
--
-- `p_edits`: [{ id, unit_price, remove }]. `p_today`: the caller's local date,
-- stamped as paid_at when a debt invoice becomes fully paid.
-- Output: { ok: true, changed, new_total, cashbox_delta, cashbox_name, credit_added }
--         { ok: false, code: 'forbidden' | 'not_found' | 'order_cancelled' | 'no_lines_left' }
--         { ok: false, code: 'insufficient_cashbox', cashbox_name, balance, amount }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_sale_lines(p_order_id UUID, p_edits JSONB, p_today DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order       RECORD;
  v_invoice     RECORD;
  v_row         RECORD;
  v_edit        JSONB;
  v_price       NUMERIC;
  v_subtotal    NUMERIC := 0;
  v_kept        INT := 0;
  v_removed     UUID[] := ARRAY[]::uuid[];
  v_changed     BOOLEAN := false;
  v_discount    NUMERIC;
  v_new_total   NUMERIC;
  v_delta       NUMERIC;
  v_tx_id       UUID;
  v_method      TEXT;
  v_cashbox_id  UUID;
  v_cashbox     TEXT;
  v_balance     NUMERIC;
  v_paid        NUMERIC;
  v_credit      NUMERIC := 0;
  v_fully_paid  BOOLEAN;
BEGIN
  IF NOT app_can('sales', 'edit') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT id, order_number, status, notes, customer_id, total_amount,
         discount_amount, tax_amount, assigned_to
    INTO v_order
    FROM sales_orders
   WHERE id = p_order_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF NOT app_owns('sales', v_order.assigned_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'order_cancelled');
  END IF;

  -- Work out the new lines in memory first.
  FOR v_row IN
    SELECT id, quantity, unit_price, discount_percent
      FROM sales_order_items
     WHERE order_id = p_order_id
       FOR UPDATE
  LOOP
    SELECT e INTO v_edit
      FROM jsonb_array_elements(COALESCE(p_edits, '[]'::jsonb)) e
     WHERE e ->> 'id' = v_row.id::text
     LIMIT 1;

    IF v_edit IS NOT NULL AND app_jsonb_truthy(v_edit -> 'remove') THEN
      v_removed := v_removed || v_row.id;
      v_changed := true;
      CONTINUE;
    END IF;

    v_price := COALESCE(v_row.unit_price, 0);
    IF v_edit IS NOT NULL AND (v_edit ->> 'unit_price') IS NOT NULL THEN
      v_price := GREATEST(0, (v_edit ->> 'unit_price')::numeric);
      IF v_price <> COALESCE(v_row.unit_price, 0) THEN
        v_changed := true;
      END IF;
    END IF;

    v_kept := v_kept + 1;
    v_subtotal := v_subtotal
      + round(v_price * COALESCE(v_row.quantity, 0) * (1 - COALESCE(v_row.discount_percent, 0) / 100), 2);
  END LOOP;

  IF NOT v_changed THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'new_total', v_order.total_amount,
      'cashbox_delta', 0, 'cashbox_name', NULL, 'credit_added', 0);
  END IF;
  -- Removing every line is a cancellation, which has its own flow.
  IF v_kept = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_lines_left');
  END IF;

  -- saleOrderTotal(): the flat order discount never exceeds the lines.
  v_discount := LEAST(GREATEST(COALESCE(v_order.discount_amount, 0), 0), v_subtotal);
  v_new_total := round(v_subtotal - v_discount + COALESCE(v_order.tax_amount, 0), 2);
  v_delta := round(v_new_total - COALESCE(v_order.total_amount, 0), 2);

  -- Only a cash/card/transfer sale writes an income transaction.
  SELECT id INTO v_tx_id
    FROM transactions
   WHERE reference_type = 'sales_orders'
     AND reference_id = p_order_id
     AND type = 'income'
   ORDER BY created_at, id
   LIMIT 1
     FOR UPDATE;

  SELECT id, status, paid_amount, paid_at
    INTO v_invoice
    FROM invoices
   WHERE order_id = p_order_id
     AND status <> 'cancelled'
   ORDER BY created_at, id
   LIMIT 1
     FOR UPDATE;

  -- What can refuse — the drawer no longer holding the refund — is checked
  -- before the first write.
  IF v_tx_id IS NOT NULL AND v_delta <> 0 THEN
    SELECT m[1]
      INTO v_method
      FROM (
        SELECT regexp_match(lower(t.note), 'paid (?:instantly on pos )?via (cash|card|transfer)\M') AS m, t.ord
          FROM (
            SELECT v_order.notes AS note, 0 AS ord
            UNION ALL
            SELECT notes, 1 FROM invoices WHERE order_id = p_order_id AND status <> 'cancelled'
          ) t
      ) matches
     WHERE m IS NOT NULL
     ORDER BY ord
     LIMIT 1;

    v_cashbox_id := pick_cashbox(v_method, true);
    IF v_cashbox_id IS NOT NULL THEN
      SELECT name, balance INTO v_cashbox, v_balance FROM cashboxes WHERE id = v_cashbox_id;
    END IF;
    IF v_cashbox_id IS NULL OR (v_delta < 0 AND v_balance < -v_delta) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'insufficient_cashbox',
        'cashbox_name', v_cashbox, 'balance', COALESCE(v_balance, 0), 'amount', -v_delta);
    END IF;
  END IF;

  -- Lines.
  FOR v_row IN
    SELECT i.id, i.quantity, i.discount_percent, GREATEST(0, (e ->> 'unit_price')::numeric) AS price
      FROM sales_order_items i
      JOIN jsonb_array_elements(COALESCE(p_edits, '[]'::jsonb)) e ON e ->> 'id' = i.id::text
     WHERE i.order_id = p_order_id
       AND NOT app_jsonb_truthy(e -> 'remove')
       AND (e ->> 'unit_price') IS NOT NULL
  LOOP
    UPDATE sales_order_items
       SET unit_price = v_row.price,
           total_price = round(v_row.price * COALESCE(v_row.quantity, 0) * (1 - COALESCE(v_row.discount_percent, 0) / 100), 2)
     WHERE id = v_row.id;
  END LOOP;

  IF array_length(v_removed, 1) > 0 THEN
    PERFORM return_sale_lines_to_stock(
      p_order_id, v_removed, trim('Removed from order ' || COALESCE(v_order.order_number, ''))
    );
    DELETE FROM sales_order_items WHERE id = ANY (v_removed);
  END IF;

  UPDATE sales_orders
     SET total_amount = v_new_total, discount_amount = round(v_discount, 2)
   WHERE id = p_order_id;

  IF v_tx_id IS NOT NULL THEN
    IF v_delta <> 0 THEN
      UPDATE cashboxes SET balance = balance + v_delta WHERE id = v_cashbox_id;
      -- The sale's income is the sum of its transactions; correct the first.
      UPDATE transactions SET amount = round(amount + v_delta, 2) WHERE id = v_tx_id;
    END IF;
    IF v_invoice.id IS NOT NULL THEN
      UPDATE invoices SET total_amount = v_new_total, paid_amount = v_new_total WHERE id = v_invoice.id;
    END IF;
  ELSIF v_invoice.id IS NOT NULL THEN
    -- Debt sale: the debt is total − paid on this invoice.
    v_paid := COALESCE(v_invoice.paid_amount, 0);
    IF v_paid > v_new_total THEN
      v_credit := round(v_paid - v_new_total, 2);
      v_paid := v_new_total;
    END IF;
    v_fully_paid := v_paid >= v_new_total;

    UPDATE invoices
       SET total_amount = v_new_total,
           paid_amount = v_paid,
           status = CASE
             WHEN v_fully_paid THEN 'paid'
             WHEN v_invoice.status = 'paid' THEN 'sent'
             ELSE v_invoice.status
           END,
           paid_at = CASE WHEN v_fully_paid THEN COALESCE(v_invoice.paid_at, p_today) END
     WHERE id = v_invoice.id;

    IF v_credit > 0 AND v_order.customer_id IS NOT NULL THEN
      UPDATE customers SET credit_balance = credit_balance + v_credit WHERE id = v_order.customer_id;
    ELSE
      v_credit := 0;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'changed', true,
    'new_total', v_new_total,
    'cashbox_delta', CASE WHEN v_tx_id IS NOT NULL THEN v_delta ELSE 0 END,
    'cashbox_name', v_cashbox,
    'credit_added', v_credit
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- set_order_status(order_id, status) / set_invoice_status(invoice_id, status)
--
-- Plain status moves with no stock or money consequences, allowed only along
-- ORDER_TRANSITIONS / INVOICE_TRANSITIONS (src/lib/statuses.ts). Cancelling a
-- sale is cancel_sales_order; marking an invoice paid is accept_invoice_payment
-- or a cashbox receipt, because money has to land somewhere.
-- Output: { ok: true } | { ok: false, code: 'forbidden' | 'not_found' | 'invalid_transition' }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_order_status(p_order_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status      TEXT;
  v_assigned_to UUID;
BEGIN
  IF NOT app_can('sales', 'edit') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT status::text, assigned_to INTO v_status, v_assigned_to
    FROM sales_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF NOT app_owns('sales', v_assigned_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF p_status = 'cancelled' OR NOT p_status = ANY (CASE v_status
      WHEN 'draft' THEN ARRAY['confirmed']
      WHEN 'pending' THEN ARRAY['confirmed']
      WHEN 'confirmed' THEN ARRAY['shipped']
      WHEN 'shipped' THEN ARRAY['delivered']
      ELSE ARRAY[]::text[]
    END) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_transition');
  END IF;

  UPDATE sales_orders SET status = p_status::order_status WHERE id = p_order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION set_invoice_status(p_invoice_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status      TEXT;
  v_assigned_to UUID;
BEGIN
  IF NOT app_can('sales', 'edit') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT status::text, assigned_to INTO v_status, v_assigned_to
    FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF NOT app_owns('sales', v_assigned_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF NOT p_status = ANY (CASE v_status
      WHEN 'draft' THEN ARRAY['sent', 'cancelled']
      WHEN 'sent' THEN ARRAY['cancelled']
      WHEN 'overdue' THEN ARRAY['cancelled']
      ELSE ARRAY[]::text[]
    END) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_transition');
  END IF;

  UPDATE invoices SET status = p_status::invoice_status WHERE id = p_invoice_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- accept_invoice_payment(invoice_id, paid_at)
--
-- "Accept payment" on the invoice page: what is still owed is received in
-- full — the invoice is marked paid, an income transaction is recorded, and
-- the money goes into the main cashbox (before this it was only logged as a
-- transaction and never reached any cashbox balance).
-- Output: { ok: true, amount, cashbox_name }
--         { ok: false, code: 'forbidden' | 'not_found' | 'invoice_cancelled' }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION accept_invoice_payment(p_invoice_id UUID, p_paid_at DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_amount  NUMERIC;
  v_cashbox JSONB;
BEGIN
  IF NOT app_can('sales', 'edit') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT id, invoice_number, status, total_amount, paid_amount, customer_id, assigned_to
    INTO v_invoice
    FROM invoices
   WHERE id = p_invoice_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF NOT app_owns('sales', v_invoice.assigned_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invoice_cancelled');
  END IF;

  v_amount := COALESCE(v_invoice.total_amount, 0) - COALESCE(v_invoice.paid_amount, 0);

  UPDATE invoices
     SET paid_amount = total_amount,
         status = 'paid',
         paid_at = COALESCE(p_paid_at, CURRENT_DATE)
   WHERE id = p_invoice_id;

  IF v_amount > 0 THEN
    v_cashbox := credit_cashbox(v_amount, NULL);
    INSERT INTO transactions (
      type, amount, category, description, reference_type, reference_id,
      customer_id, transaction_date, created_by
    ) VALUES (
      'income', v_amount, 'sales',
      v_invoice.invoice_number || ' uchun tezkor to''lov',
      'invoice', p_invoice_id, v_invoice.customer_id,
      COALESCE(p_paid_at, CURRENT_DATE), auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'amount', GREATEST(v_amount, 0),
    'cashbox_name', v_cashbox ->> 'cashbox_name'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- save_invoice(invoice)
--
-- The invoice form (create or edit). A change in the paid amount is money
-- received or given back, so it moves the main cashbox and is logged as a
-- transaction — refused when the drawer cannot cover a refund. The status is
-- reconciled with what is paid (reconcileInvoiceStatus).
--
-- Input: { id?, invoice_number, customer_id, order_id, status, total_amount,
--          paid_amount, issued_at, due_at, paid_at, notes, assigned_to,
--          payment_label }   -- payment_label: localized transaction category
-- Output: { ok: true, id } | { ok: false, code: 'forbidden' | 'not_found' }
--         { ok: false, code: 'insufficient_cashbox', cashbox_name, balance, amount }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION save_invoice(p_invoice JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_id        UUID := NULLIF(p_invoice ->> 'id', '')::uuid;
  v_old       RECORD;
  v_total     NUMERIC := COALESCE((p_invoice ->> 'total_amount')::numeric, 0);
  v_paid      NUMERIC := COALESCE((p_invoice ->> 'paid_amount')::numeric, 0);
  v_chosen    TEXT := COALESCE(NULLIF(p_invoice ->> 'status', ''), 'draft');
  v_status    TEXT;
  v_assigned  UUID := NULLIF(p_invoice ->> 'assigned_to', '')::uuid;
  v_diff      NUMERIC;
  v_cashbox   JSONB;
  v_label     TEXT := COALESCE(NULLIF(p_invoice ->> 'payment_label', ''), 'Invoice Payment');
BEGIN
  IF v_id IS NULL THEN
    IF NOT (app_can('sales', 'create') OR app_can('sales', 'edit')) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
    v_diff := v_paid;
  ELSE
    IF NOT app_can('sales', 'edit') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
    SELECT id, paid_amount, assigned_to, created_by INTO v_old
      FROM invoices WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    IF NOT app_owns('sales', v_old.assigned_to) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
    v_diff := v_paid - COALESCE(v_old.paid_amount, 0);
    v_assigned := COALESCE(v_assigned, v_old.assigned_to);
  END IF;
  v_assigned := COALESCE(v_assigned, v_uid);

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_assigned AND tenant_id = get_my_tenant_id()) THEN
    RAISE EXCEPTION 'save_invoice: assignee % is not a member of this tenant', v_assigned;
  END IF;

  -- reconcileInvoiceStatus()
  v_status := CASE
    WHEN v_chosen = 'cancelled' THEN 'cancelled'
    WHEN v_total > 0 AND v_paid >= v_total THEN 'paid'
    WHEN v_chosen IN ('paid', 'overdue') THEN 'sent'
    ELSE v_chosen
  END;

  -- Money first: a refund the drawer cannot cover refuses the whole save.
  IF v_diff <> 0 THEN
    v_cashbox := credit_cashbox(v_diff, NULL);
    IF NOT (v_cashbox ->> 'ok')::boolean THEN
      RETURN v_cashbox;
    END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO invoices (
      invoice_number, customer_id, order_id, status, total_amount, paid_amount,
      issued_at, due_at, paid_at, notes, created_by, assigned_to
    ) VALUES (
      p_invoice ->> 'invoice_number',
      NULLIF(p_invoice ->> 'customer_id', '')::uuid,
      NULLIF(p_invoice ->> 'order_id', '')::uuid,
      v_status::invoice_status, v_total, v_paid,
      COALESCE(NULLIF(p_invoice ->> 'issued_at', '')::date, CURRENT_DATE),
      NULLIF(p_invoice ->> 'due_at', '')::date,
      NULLIF(p_invoice ->> 'paid_at', '')::date,
      NULLIF(p_invoice ->> 'notes', ''),
      v_uid, v_assigned
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE invoices
       SET invoice_number = p_invoice ->> 'invoice_number',
           customer_id = NULLIF(p_invoice ->> 'customer_id', '')::uuid,
           order_id = NULLIF(p_invoice ->> 'order_id', '')::uuid,
           status = v_status::invoice_status,
           total_amount = v_total,
           paid_amount = v_paid,
           issued_at = COALESCE(NULLIF(p_invoice ->> 'issued_at', '')::date, issued_at),
           due_at = NULLIF(p_invoice ->> 'due_at', '')::date,
           paid_at = NULLIF(p_invoice ->> 'paid_at', '')::date,
           notes = NULLIF(p_invoice ->> 'notes', ''),
           assigned_to = v_assigned
     WHERE id = v_id;
  END IF;

  IF v_diff <> 0 THEN
    INSERT INTO transactions (
      type, amount, category, description, reference_type, reference_id,
      customer_id, transaction_date, created_by
    ) VALUES (
      CASE WHEN v_diff > 0 THEN 'income' ELSE 'expense' END::transaction_type,
      abs(v_diff), v_label,
      v_label || ' #' || (p_invoice ->> 'invoice_number'),
      'invoices', v_id,
      NULLIF(p_invoice ->> 'customer_id', '')::uuid,
      COALESCE(NULLIF(p_invoice ->> 'paid_at', '')::date, NULLIF(p_invoice ->> 'issued_at', '')::date, CURRENT_DATE),
      v_uid
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- receive_purchase(purchase)
--
-- A purchase received in full (purchase-order-form.tsx): the order, its lines,
-- stock up with an `in` movement per line, and a cost layer per line at the
-- price paid, so FIFO/LIFO/AVECO have real data for later sales.
--
-- Input: { po_number, supplier_id, total_amount, notes, assigned_to, order_date,
--          items: [{ product_id, quantity, unit_cost, total_cost }] }
-- Output: { ok: true, id } | { ok: false, code: 'forbidden' }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION receive_purchase(p_purchase JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_po_id     UUID;
  v_assigned  UUID := COALESCE(NULLIF(p_purchase ->> 'assigned_to', '')::uuid, auth.uid());
  v_supplier  TEXT;
  v_line      RECORD;
  v_before    NUMERIC;
  v_after     NUMERIC;
BEGIN
  IF NOT (app_can('procurement', 'create') OR app_can('procurement', 'edit')) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  IF jsonb_typeof(p_purchase -> 'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_purchase -> 'items') = 0 THEN
    RAISE EXCEPTION 'receive_purchase: a purchase needs at least one line';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_purchase -> 'items') l
     WHERE NULLIF(l ->> 'product_id', '') IS NULL
        OR COALESCE((l ->> 'quantity')::numeric, 0) <= 0
        OR COALESCE((l ->> 'unit_cost')::numeric, 0) < 0
  ) THEN
    RAISE EXCEPTION 'receive_purchase: every line needs a product, a positive quantity and a cost';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_assigned AND tenant_id = get_my_tenant_id()) THEN
    RAISE EXCEPTION 'receive_purchase: assignee % is not a member of this tenant', v_assigned;
  END IF;

  SELECT name INTO v_supplier FROM suppliers WHERE id = NULLIF(p_purchase ->> 'supplier_id', '')::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'receive_purchase: supplier not found';
  END IF;

  -- Fixed lock order, so concurrent receipts and sales queue instead of deadlocking.
  PERFORM 1
     FROM products
    WHERE id IN (SELECT (l ->> 'product_id')::uuid FROM jsonb_array_elements(p_purchase -> 'items') l)
    ORDER BY id
      FOR UPDATE;

  INSERT INTO purchase_orders (
    po_number, supplier_id, status, total_amount, notes, created_by, assigned_to, order_date
  ) VALUES (
    p_purchase ->> 'po_number',
    (p_purchase ->> 'supplier_id')::uuid,
    'received',
    COALESCE((p_purchase ->> 'total_amount')::numeric, 0),
    NULLIF(p_purchase ->> 'notes', ''),
    v_uid, v_assigned,
    COALESCE(NULLIF(p_purchase ->> 'order_date', '')::date, CURRENT_DATE)
  )
  RETURNING id INTO v_po_id;

  FOR v_line IN
    SELECT (l ->> 'product_id')::uuid AS product_id,
           (l ->> 'quantity')::numeric AS quantity,
           COALESCE((l ->> 'unit_cost')::numeric, 0) AS unit_cost,
           COALESCE((l ->> 'total_cost')::numeric, (l ->> 'quantity')::numeric * COALESCE((l ->> 'unit_cost')::numeric, 0)) AS total_cost
      FROM jsonb_array_elements(p_purchase -> 'items') WITH ORDINALITY AS x(l, ord)
     ORDER BY ord
  LOOP
    INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_cost, received_qty, total_cost)
    VALUES (v_po_id, v_line.product_id, v_line.quantity, v_line.unit_cost, v_line.quantity, v_line.total_cost);

    UPDATE products
       SET stock = stock + v_line.quantity
     WHERE id = v_line.product_id
    RETURNING stock - v_line.quantity, stock
      INTO v_before, v_after;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'receive_purchase: product % not found', v_line.product_id;
    END IF;

    INSERT INTO stock_movements (
      product_id, type, quantity, quantity_before, quantity_after,
      reference_type, reference_id, reason, unit_cost, total_cost, created_by
    ) VALUES (
      v_line.product_id, 'in', v_line.quantity, v_before, v_after,
      'purchase_order', v_po_id, 'Purchase from ' || COALESCE(v_supplier, 'supplier'),
      v_line.unit_cost, v_line.total_cost, v_uid
    );

    INSERT INTO inventory_cost_layers (product_id, quantity, remaining_qty, unit_cost, source_type, source_id)
    VALUES (v_line.product_id, v_line.quantity, v_line.quantity, v_line.unit_cost, 'purchase_order', v_po_id);
    PERFORM sync_product_average_cost(v_line.product_id);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_po_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- create_cashbox(cashbox)
--
-- A new cashbox, with its opening balance logged as an income transaction so
-- the balance has an audit trail from day one.
-- Input: { name, type, description, initial_balance, initial_label, date }
-- Output: { ok: true, id } | { ok: false, code: 'forbidden' }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_cashbox(p_cashbox JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id      UUID;
  v_name    TEXT := NULLIF(trim(p_cashbox ->> 'name'), '');
  v_balance NUMERIC := GREATEST(COALESCE((p_cashbox ->> 'initial_balance')::numeric, 0), 0);
  v_label   TEXT := COALESCE(NULLIF(p_cashbox ->> 'initial_label', ''), 'Initial balance');
BEGIN
  IF NOT (app_can('finance', 'create') OR app_can('finance', 'edit')) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'create_cashbox: a name is required';
  END IF;

  INSERT INTO cashboxes (name, type, balance, description)
  VALUES (
    v_name,
    COALESCE(NULLIF(p_cashbox ->> 'type', ''), 'cash')::cashbox_type,
    v_balance,
    NULLIF(p_cashbox ->> 'description', '')
  )
  RETURNING id INTO v_id;

  IF v_balance > 0 THEN
    INSERT INTO transactions (
      type, amount, category, description, reference_type, reference_id,
      transaction_date, created_by
    ) VALUES (
      'income', v_balance, v_label, v_label || ' - ' || v_name, 'cashbox', v_id,
      COALESCE(NULLIF(p_cashbox ->> 'date', '')::date, CURRENT_DATE), auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- record_cashbox_movement(movement)
--
-- A kirim/chiqim on one cashbox (cashbox-operations.ts). Income received from
-- a customer first pays down their unpaid invoices, oldest due date first, and
-- whatever is left becomes credit (haqdorlik) on their account. An expense
-- larger than what the drawer holds is refused.
--
-- Input: { cashbox_id, type, amount, category, description,
--          person_type ('employee'|'supplier'|'customer'|'none'), person_id, date }
-- Output: { ok: true, balance, settled, credit_added }
--         { ok: false, code: 'forbidden' | 'not_found' }
--         { ok: false, code: 'insufficient_cashbox', cashbox_name, balance, amount }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_cashbox_movement(p_movement JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cashbox_id  UUID := NULLIF(p_movement ->> 'cashbox_id', '')::uuid;
  v_type        TEXT := p_movement ->> 'type';
  v_amount      NUMERIC := COALESCE((p_movement ->> 'amount')::numeric, 0);
  v_person_type TEXT := COALESCE(NULLIF(p_movement ->> 'person_type', ''), 'none');
  v_person_id   UUID := NULLIF(p_movement ->> 'person_id', '')::uuid;
  v_date        DATE := COALESCE(NULLIF(p_movement ->> 'date', '')::date, CURRENT_DATE);
  v_name        TEXT;
  v_balance     NUMERIC;
  v_remaining   NUMERIC;
  v_settled     NUMERIC := 0;
  v_credit      NUMERIC := 0;
  v_invoice     RECORD;
  v_outstanding NUMERIC;
BEGIN
  IF NOT (app_can('finance', 'create') OR app_can('finance', 'edit')) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  IF v_type IS NULL OR v_type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'record_cashbox_movement: unknown type %', v_type;
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'record_cashbox_movement: the amount must be positive';
  END IF;
  IF v_person_type NOT IN ('employee', 'supplier', 'customer', 'none') THEN
    RAISE EXCEPTION 'record_cashbox_movement: unknown person type %', v_person_type;
  END IF;

  SELECT name, balance INTO v_name, v_balance FROM cashboxes WHERE id = v_cashbox_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF v_type = 'expense' AND v_balance < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_cashbox',
      'cashbox_name', v_name, 'balance', v_balance, 'amount', v_amount);
  END IF;

  IF v_type = 'income' AND v_person_type = 'customer' AND v_person_id IS NOT NULL THEN
    v_remaining := v_amount;
    FOR v_invoice IN
      SELECT id, total_amount, paid_amount
        FROM invoices
       WHERE customer_id = v_person_id
         AND status NOT IN ('paid', 'cancelled')
       ORDER BY due_at, created_at, id
         FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_outstanding := COALESCE(v_invoice.total_amount, 0) - COALESCE(v_invoice.paid_amount, 0);
      CONTINUE WHEN v_outstanding <= 0;
      IF v_remaining >= v_outstanding THEN
        UPDATE invoices
           SET paid_amount = total_amount, status = 'paid', paid_at = v_date
         WHERE id = v_invoice.id;
        v_remaining := v_remaining - v_outstanding;
        v_settled := v_settled + v_outstanding;
      ELSE
        UPDATE invoices SET paid_amount = COALESCE(paid_amount, 0) + v_remaining WHERE id = v_invoice.id;
        v_settled := v_settled + v_remaining;
        v_remaining := 0;
      END IF;
    END LOOP;

    IF v_remaining > 0 THEN
      UPDATE customers SET credit_balance = credit_balance + v_remaining WHERE id = v_person_id;
      IF FOUND THEN
        v_credit := v_remaining;
      END IF;
    END IF;
  END IF;

  UPDATE cashboxes
     SET balance = balance + CASE WHEN v_type = 'income' THEN v_amount ELSE -v_amount END
   WHERE id = v_cashbox_id
  RETURNING balance INTO v_balance;

  INSERT INTO transactions (
    type, amount, category, description, reference_type, reference_id,
    employee_id, supplier_id, customer_id, transaction_date, created_by
  ) VALUES (
    v_type::transaction_type, v_amount,
    COALESCE(NULLIF(p_movement ->> 'category', ''), v_type),
    NULLIF(p_movement ->> 'description', ''),
    'cashbox', v_cashbox_id,
    CASE WHEN v_person_type = 'employee' THEN v_person_id END,
    CASE WHEN v_person_type = 'supplier' THEN v_person_id END,
    CASE WHEN v_person_type = 'customer' THEN v_person_id END,
    v_date, auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'balance', v_balance, 'settled', v_settled, 'credit_added', v_credit);
END;
$$;

-- -----------------------------------------------------------------------------
-- save_transaction(transaction)
--
-- The finance transaction form (create or edit). The change in the signed
-- amount moves a cashbox: the one the transaction is recorded against when it
-- belongs to a cashbox, otherwise the main one. A withdrawal the drawer cannot
-- cover refuses the whole save.
--
-- Input: { id?, type, amount, category, transaction_date, description,
--          reference_type, reference_id, assigned_to }
-- Output: { ok: true, id } | { ok: false, code: 'forbidden' | 'not_found' }
--         { ok: false, code: 'insufficient_cashbox', cashbox_name, balance, amount }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION save_transaction(p_tx JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_id         UUID := NULLIF(p_tx ->> 'id', '')::uuid;
  v_old        RECORD;
  v_type       TEXT := p_tx ->> 'type';
  v_amount     NUMERIC := COALESCE((p_tx ->> 'amount')::numeric, 0);
  v_ref_type   TEXT := NULLIF(p_tx ->> 'reference_type', '');
  v_ref_id     UUID := NULLIF(p_tx ->> 'reference_id', '')::uuid;
  v_assigned   UUID := NULLIF(p_tx ->> 'assigned_to', '')::uuid;
  v_old_change NUMERIC := 0;
  v_diff       NUMERIC;
  v_cashbox    JSONB;
BEGIN
  IF v_type IS NULL OR v_type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'save_transaction: unknown type %', v_type;
  END IF;
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'save_transaction: the amount cannot be negative';
  END IF;

  IF v_id IS NULL THEN
    IF NOT (app_can('finance', 'create') OR app_can('finance', 'edit')) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  ELSE
    IF NOT app_can('finance', 'edit') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
    SELECT id, type::text AS type, amount, assigned_to INTO v_old
      FROM transactions WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    IF NOT app_owns('finance', v_old.assigned_to) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
    v_old_change := CASE WHEN v_old.type = 'income' THEN v_old.amount ELSE -v_old.amount END;
    v_assigned := COALESCE(v_assigned, v_old.assigned_to);
  END IF;
  v_assigned := COALESCE(v_assigned, v_uid);

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_assigned AND tenant_id = get_my_tenant_id()) THEN
    RAISE EXCEPTION 'save_transaction: assignee % is not a member of this tenant', v_assigned;
  END IF;

  v_diff := CASE WHEN v_type = 'income' THEN v_amount ELSE -v_amount END - v_old_change;
  IF v_diff <> 0 THEN
    v_cashbox := credit_cashbox(v_diff, CASE WHEN v_ref_type = 'cashbox' THEN v_ref_id END);
    IF NOT (v_cashbox ->> 'ok')::boolean THEN
      RETURN v_cashbox;
    END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO transactions (
      type, amount, category, description, reference_type, reference_id,
      transaction_date, created_by, assigned_to
    ) VALUES (
      v_type::transaction_type, v_amount, COALESCE(p_tx ->> 'category', ''),
      NULLIF(p_tx ->> 'description', ''), v_ref_type, v_ref_id,
      COALESCE(NULLIF(p_tx ->> 'transaction_date', '')::date, CURRENT_DATE),
      v_uid, v_assigned
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE transactions
       SET type = v_type::transaction_type,
           amount = v_amount,
           category = COALESCE(p_tx ->> 'category', category),
           description = NULLIF(p_tx ->> 'description', ''),
           reference_type = v_ref_type,
           reference_id = v_ref_id,
           transaction_date = COALESCE(NULLIF(p_tx ->> 'transaction_date', '')::date, transaction_date),
           assigned_to = v_assigned
     WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- Privileges: signed-in users only. The helpers are granted too because the
-- entry points run as the caller and call them.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'app_jsonb_truthy(jsonb)',
    'app_can(text, text)',
    'app_data_scope(text)',
    'app_owns(text, uuid)',
    'sync_product_average_cost(uuid)',
    'consume_cost_layers(uuid, numeric, text)',
    'return_sale_lines_to_stock(uuid, uuid[], text)',
    'pick_cashbox(text, boolean)',
    'credit_cashbox(numeric, uuid)',
    'create_sale(jsonb)',
    'update_sale_lines(uuid, jsonb, date)',
    'cancel_sales_order(uuid)',
    'set_order_status(uuid, text)',
    'set_invoice_status(uuid, text)',
    'accept_invoice_payment(uuid, date)',
    'save_invoice(jsonb)',
    'receive_purchase(jsonb)',
    'create_cashbox(jsonb)',
    'record_cashbox_movement(jsonb)',
    'save_transaction(jsonb)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- PostgREST caches the schema; make the new functions callable right away.
NOTIFY pgrst, 'reload schema';
