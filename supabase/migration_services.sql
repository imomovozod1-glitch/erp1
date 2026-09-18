-- =============================================================================
-- Services (xizmatlar)
--
-- Run after: migration_multi_tenant.sql, migration_inventory_costing.sql,
--            migration_business_rpc.sql
-- Re-runnable.
--
-- A service — delivery, installation, repair, consulting — is sold and costed
-- exactly like a product, but it is never counted, received or moved. Rather
-- than a second table that every sale, invoice, POS receipt and report would
-- have to learn about, a service IS a product row carrying `is_service = true`:
-- sales_order_items.product_id keeps pointing at one place, and margin,
-- revenue and profit reporting work unchanged.
--
-- What the flag turns off, in the three functions re-emitted below:
--   * the stock check in create_sale — a service is never "out of stock";
--   * the products.stock decrement and its stock_movements row;
--   * cost layers — a service is charged at the cost_price on its card, so
--     consume_cost_layers returns that instead of walking FIFO/LIFO layers;
--   * putting units back when a sale is cancelled or a line removed.
--
-- The UI keeps the two apart: Ombor > Mahsulotlar lists products, Ombor >
-- Xizmatlar lists services, and the purchase-order, stock-movement and
-- AI-scanner pickers offer products only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The flag
-- -----------------------------------------------------------------------------

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_service BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN products.is_service IS
  'true = a service (Ombor > Xizmatlar): sold and costed like a product, but holds no stock and writes no stock movements or cost layers.';

-- Both list pages filter on it, so it belongs in the same index as tenant_id.
CREATE INDEX IF NOT EXISTS idx_products_tenant_service
  ON products(tenant_id, is_service, created_at DESC);

-- A service that somehow carries stock would show up in stock value and
-- low-stock reports; keep the columns pinned at zero at the source.
UPDATE products SET stock = 0, min_stock = 0, max_stock = NULL
 WHERE is_service AND (stock <> 0 OR min_stock <> 0 OR max_stock IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 2. Costing: a service is charged at its own cost price
-- -----------------------------------------------------------------------------

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
  v_service  BOOLEAN;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(cost_price, 0), COALESCE(is_service, false)
    INTO v_fallback, v_service
    FROM products
   WHERE id = p_product_id;
  v_fallback := COALESCE(v_fallback, 0);

  -- A service keeps no stock and therefore has no cost layers: it is always
  -- charged at the cost price entered on its card.
  IF COALESCE(v_service, false) THEN
    RETURN v_fallback;
  END IF;

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

-- -----------------------------------------------------------------------------
-- 3. Cancelling / editing a sale: service lines have nothing to put back
-- -----------------------------------------------------------------------------

-- Puts sold lines of a sale back on the shelf: stock goes up, each line is
-- logged as an `in` movement, and its units go back into a `sale_cancellation`
-- cost layer at the cost the sale was charged (returnLinesToStock).
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
    SELECT i.product_id, i.quantity, i.unit_cost, COALESCE(p.is_service, false) AS is_service
      FROM sales_order_items i
      LEFT JOIN products p ON p.id = i.product_id
     WHERE i.order_id = p_order_id
       AND (p_item_ids IS NULL OR i.id = ANY (p_item_ids))
     ORDER BY i.product_id, i.created_at, i.id
  LOOP
    -- A service line holds no stock: there is nothing to put back, and a
    -- movement or cost layer for it would be a fiction.
    CONTINUE WHEN v_line.is_service;

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
-- 4. Selling: no stock check, no decrement, no movement for a service
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
  v_service        BOOLEAN;
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
    v_service := NULL;
    SELECT name, stock, COALESCE(is_service, false)
      INTO v_name, v_stock, v_service
      FROM products
     WHERE id = v_group.product_id
       FOR UPDATE;
    -- A service is never out of stock because it holds none. A product that
    -- does not exist at all still falls through to the check below.
    CONTINUE WHEN v_service;
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

    SELECT COALESCE(is_service, false) INTO v_service FROM products WHERE id = v_line.product_id;

    -- Selling a service moves no stock, so it writes no movement either.
    IF NOT COALESCE(v_service, false) THEN
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
    END IF;
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

