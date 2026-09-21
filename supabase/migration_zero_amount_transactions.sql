-- =============================================================================
-- Zero-amount transactions cleanup
--
-- Run after: migration_business_rpc.sql, migration_services.sql
--            (re-apply both first — they are what stops new 0 so'm rows being
--             written; this file only clears the ones already on file).
-- Re-runnable.
--
-- A transaction of 0 so'm records nothing: no cashbox moved, no debt settled,
-- no revenue earned. They were written by `create_sale` whenever a sale's
-- total came to zero — a product imported from Excel with an empty price
-- column, or a line discounted by 100% — and by `update_sale_lines` when an
-- edit emptied a sale. Both now skip the insert (and delete the row) instead,
-- so this is a one-off sweep of what those wrote before the fix.
--
-- Deleting them is safe for every balance in the system: the amount is zero,
-- so no cashbox, invoice, customer credit or report figure changes. Only
-- automatic rows are touched — a transaction typed in by hand cannot be 0
-- (the form requires at least 0.01, and save_transaction now refuses it).
-- =============================================================================

DO $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM transactions
   WHERE COALESCE(amount, 0) = 0
     -- Only rows the app generated on the back of another document. Anything
     -- without a reference was entered by a person and is left alone, however
     -- odd it looks, because deleting someone's own entry is not this file's
     -- job.
     AND reference_type IN ('sales_orders', 'invoices', 'invoice', 'cashbox');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'migration_zero_amount_transactions: % zero-amount transaction(s) removed', v_deleted;
END;
$$;
