-- =============================================================================
-- Paying for a purchase, and cancelling one.
--
-- Runs after: migration_business_rpc.sql. Re-runnable.
--
-- Two things were missing from the procurement side that the sales side has
-- had all along. A purchase moved stock but never moved money: whether it had
-- been paid for was not recorded anywhere, so every purchase silently became a
-- debt to the supplier. And a purchase could not be undone at all — a
-- mistyped receipt stayed on the books, with its stock, its cost layers and
-- its debt.
--
-- Both live in the database for the reason every money-or-stock path in this
-- app does (CLAUDE.md → "Plain browser writes are not atomic"): each is one
-- transaction that locks what it reads, so a receipt cannot half-happen.
-- =============================================================================

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
  v_method    TEXT := NULLIF(p_purchase ->> 'payment_method', '');
  v_total     NUMERIC := COALESCE((p_purchase ->> 'total_amount')::numeric, 0);
  v_cashbox   UUID;
  v_cb_name   TEXT;
  v_cb_bal    NUMERIC;
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

  IF v_method IS NOT NULL AND v_method NOT IN ('cash', 'card', 'transfer') THEN
    RAISE EXCEPTION 'receive_purchase: unknown payment method %', v_method;
  END IF;

  SELECT name INTO v_supplier FROM suppliers WHERE id = NULLIF(p_purchase ->> 'supplier_id', '')::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'receive_purchase: supplier not found';
  END IF;

  -- Paying at the till: check the drawer BEFORE anything is written. A plpgsql
  -- RETURN does not roll back, so a refusal discovered after the stock had
  -- moved would leave the goods received and the money not taken. The row is
  -- locked here and debited at the end, so nothing can spend it in between.
  IF v_method IS NOT NULL THEN
    v_cashbox := pick_cashbox(v_method, true);
    IF v_cashbox IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'insufficient_cashbox',
        'cashbox_name', NULL, 'balance', 0, 'amount', v_total);
    END IF;
    SELECT name, balance INTO v_cb_name, v_cb_bal FROM cashboxes WHERE id = v_cashbox FOR UPDATE;
    IF v_cb_bal < v_total THEN
      RETURN jsonb_build_object('ok', false, 'code', 'insufficient_cashbox',
        'cashbox_name', v_cb_name, 'balance', v_cb_bal, 'amount', v_total);
    END IF;
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

  -- Paid now, or on account.
  --
  -- There is no `paid` column on purchase_orders, and there does not need to
  -- be one: what the company owes a supplier is the goods received minus the
  -- expense transactions tagged to that supplier (src/lib/supplier-debt.ts).
  -- So paying is simply that expense, recorded here — and NOT paying is the
  -- debt, with nothing to record. The supplier page, the dashboard's payables
  -- and the cashbox's "pay a supplier" dialog all read the same arithmetic, so
  -- a purchase paid here and one paid later from the cashbox are the same
  -- thing to every one of them.
  IF v_method IS NOT NULL THEN
    UPDATE cashboxes SET balance = balance - v_total WHERE id = v_cashbox;

    INSERT INTO transactions (
      type, amount, category, description, reference_type, reference_id,
      supplier_id, transaction_date, created_by
    ) VALUES (
      'expense', v_total, 'Xaridlar',
      trim('Xarid - ' || COALESCE(p_purchase ->> 'po_number', '')),
      'purchase_order', v_po_id,
      (p_purchase ->> 'supplier_id')::uuid,
      COALESCE(NULLIF(p_purchase ->> 'order_date', '')::date, CURRENT_DATE),
      v_uid
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_po_id,
    'paid', v_method IS NOT NULL,
    'cashbox_name', v_cb_name
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- cancel_purchase(po_id)
--
-- Undoes a received purchase: the goods leave the shelf again, the cost layers
-- it created are removed, the money paid for it comes back to the cashbox, and
-- the order is marked cancelled. The mirror image of cancel_sales_order.
--
-- Refused when the goods are no longer there to return — if any of this
-- purchase's cost layers has already been consumed by a sale, the stock on the
-- shelf is not this purchase's any more, and taking it back would make some
-- other sale's costing a fiction. The answer then is a stock adjustment or a
-- supplier return, not a cancellation.
--
-- Output:
--   { ok: true, refunded }
--   { ok: false, code: 'forbidden' | 'not_found' | 'already_cancelled' }
--   { ok: false, code: 'already_sold', product_name }
--   { ok: false, code: 'insufficient_stock', product_name, available, needed }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_purchase(p_po_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_po      RECORD;
  v_line    RECORD;
  v_stock   NUMERIC;
  v_name    TEXT;
  v_before  NUMERIC;
  v_after   NUMERIC;
  v_refund  NUMERIC := 0;
  v_cashbox JSONB;
BEGIN
  IF NOT app_can('procurement', 'edit') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT id, po_number, status, assigned_to INTO v_po
    FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF NOT app_owns('procurement', v_po.assigned_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  IF v_po.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_cancelled');
  END IF;

  -- ── Everything that can refuse, before anything is written ────────────────
  -- A RETURN does not roll back, so every check runs first and the writes
  -- follow only once none of them can fail.

  -- Has any of it been sold on? A layer whose remaining_qty is below the
  -- quantity it was created with has been drawn against by a sale.
  SELECT p.name INTO v_name
    FROM inventory_cost_layers l
    JOIN products p ON p.id = l.product_id
   WHERE l.source_type = 'purchase_order'
     AND l.source_id = p_po_id
     AND l.remaining_qty < l.quantity
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_sold', 'product_name', v_name);
  END IF;

  -- And is the stock still on the shelf? Lock in product-id order, the same
  -- order receive_purchase and create_sale take, so the three queue rather
  -- than deadlock.
  FOR v_line IN
    SELECT i.product_id, SUM(i.received_qty) AS qty
      FROM purchase_order_items i
     WHERE i.po_id = p_po_id AND i.received_qty > 0
     GROUP BY i.product_id
     ORDER BY i.product_id
  LOOP
    SELECT stock, name INTO v_stock, v_name
      FROM products WHERE id = v_line.product_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'insufficient_stock',
        'product_name', NULL, 'available', 0, 'needed', v_line.qty);
    END IF;
    IF v_stock < v_line.qty THEN
      RETURN jsonb_build_object('ok', false, 'code', 'insufficient_stock',
        'product_name', v_name, 'available', v_stock, 'needed', v_line.qty);
    END IF;
  END LOOP;

  -- ── From here on nothing can refuse ───────────────────────────────────────
  FOR v_line IN
    SELECT i.product_id, SUM(i.received_qty) AS qty
      FROM purchase_order_items i
     WHERE i.po_id = p_po_id AND i.received_qty > 0
     GROUP BY i.product_id
     ORDER BY i.product_id
  LOOP
    UPDATE products
       SET stock = stock - v_line.qty
     WHERE id = v_line.product_id
    RETURNING stock + v_line.qty, stock, name
      INTO v_before, v_after, v_name;

    INSERT INTO stock_movements (
      product_id, type, quantity, quantity_before, quantity_after,
      reference_type, reference_id, reason, created_by
    ) VALUES (
      v_line.product_id, 'out', v_line.qty, v_before, v_after,
      'purchase_order', p_po_id,
      trim('Cancelled purchase ' || COALESCE(v_po.po_number, '')), v_uid
    );
  END LOOP;

  -- The layers this purchase created go with it. None has been drawn against
  -- (checked above), so nothing else is costed from them.
  DELETE FROM inventory_cost_layers
   WHERE source_type = 'purchase_order' AND source_id = p_po_id;

  FOR v_line IN
    SELECT DISTINCT product_id FROM purchase_order_items WHERE po_id = p_po_id
  LOOP
    PERFORM sync_product_average_cost(v_line.product_id);
  END LOOP;

  -- Money back. Whatever was paid for this purchase — at the till when it was
  -- received, or later from the cashbox — is tagged to it, so the refund is
  -- the sum of those rows and they go with the cancellation.
  SELECT COALESCE(SUM(amount), 0) INTO v_refund
    FROM transactions
   WHERE reference_type = 'purchase_order' AND reference_id = p_po_id AND type = 'expense';

  IF v_refund > 0 THEN
    DELETE FROM transactions
     WHERE reference_type = 'purchase_order' AND reference_id = p_po_id AND type = 'expense';
    -- Positive amount: credit_cashbox cannot refuse, and creates a drawer only
    -- if the tenant somehow has none.
    v_cashbox := credit_cashbox(v_refund, NULL);
  END IF;

  UPDATE purchase_orders SET status = 'cancelled' WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'ok', true,
    'refunded', v_refund,
    'cashbox_name', v_cashbox ->> 'cashbox_name'
  );
END;
$$;
