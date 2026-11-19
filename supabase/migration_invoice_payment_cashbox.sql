-- =============================================================================
-- Invoice payments in the cashbox history
--
-- Run after: migration_business_rpc.sql, migration_services.sql
--            (re-apply both first: `accept_invoice_payment` and `save_invoice`
--             now book the money against the cashbox it went into; this file
--             only moves the rows those two wrote before the fix).
-- Re-runnable.
--
-- "Tezkor to'lov" on an invoice, and a paid amount changed in the invoice form,
-- always added the money to the main cashbox — but the transaction was filed
-- under the invoice (`reference_type` 'invoice' / 'invoices'). A cashbox's
-- history lists the rows filed under that cashbox, so the balance went up with
-- no line explaining why. Nothing else reads those two reference types.
--
-- The money went to the tenant's main cashbox, picked the way `pick_cashbox`
-- picks it with no type: a name meaning "main", else the oldest. The same rule
-- re-files each old row. A tenant with no cashbox at all keeps its rows as they
-- are (there is nowhere to file them).
-- =============================================================================

DO $$
DECLARE
  v_moved INTEGER;
BEGIN
  UPDATE transactions t
     SET reference_type = 'cashbox',
         reference_id = (
           SELECT c.id
             FROM cashboxes c
            WHERE c.tenant_id = t.tenant_id
            ORDER BY (lower(c.name) LIKE '%asosiy%' OR lower(c.name) LIKE '%main%' OR lower(c.name) LIKE '%основн%') DESC,
                     CASE WHEN lower(c.name) LIKE '%asosiy%' OR lower(c.name) LIKE '%main%' OR lower(c.name) LIKE '%основн%'
                          THEN c.created_at END DESC,
                     c.created_at ASC
            LIMIT 1
         )
   WHERE t.reference_type IN ('invoice', 'invoices')
     AND EXISTS (SELECT 1 FROM cashboxes c WHERE c.tenant_id = t.tenant_id);

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Invoice payments re-filed under their cashbox: %', v_moved;
END;
$$;
