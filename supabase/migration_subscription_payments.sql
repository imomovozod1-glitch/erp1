-- =============================================================================
-- What each subscription payment actually bought.
--
-- Runs after: migration_admin_enhancements.sql (which creates tenant_payments).
-- Re-runnable.
--
-- tenant_payments recorded an amount and a date and nothing else, so the only
-- record of a term was `tenants.license_months` — a single column that the NEXT
-- payment overwrites. Nobody could answer "what period did this payment cover",
-- which is the first question asked when a company disputes being blocked, and
-- the numbers on the tenant row could not be rebuilt from history.
--
-- The columns are nullable on purpose: payments recorded before this migration
-- genuinely have no term attached, and inventing one for them would be worse
-- than leaving it blank. The console shows a dash for those.
-- =============================================================================

ALTER TABLE tenant_payments ADD COLUMN IF NOT EXISTS license_months INTEGER;
ALTER TABLE tenant_payments ADD COLUMN IF NOT EXISTS license_count INTEGER;

-- The stretch of subscription this payment paid for. period_start is the day
-- the new term began (the old end date when renewing early, today when the
-- subscription had already lapsed) and period_end is the new, INCLUSIVE end
-- date — the same value written to tenants.subscription_ends_at.
ALTER TABLE tenant_payments ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE tenant_payments ADD COLUMN IF NOT EXISTS period_end DATE;

-- Newest-first per tenant is the only way this table is ever read
-- (the tenant detail page, and the payment insert's own history).
CREATE INDEX IF NOT EXISTS idx_tenant_payments_tenant_paid
  ON tenant_payments(tenant_id, paid_at DESC);

-- =============================================================================
-- The day the company was last warned that its subscription is ending.
--
-- There is no scheduler in this deployment (see src/lib/tenant-status.ts for
-- the same reasoning applied to the block itself), so the warning is sent when
-- someone opens the dashboard in the last week of the subscription. Every
-- staff member opening it would otherwise send one, so the sender CLAIMS the
-- day with a conditional update on this column and only sends if the claim
-- matched a row.
--
-- Nullable: a company that has never been warned has never been close to
-- expiring. Cleared implicitly by the date moving on, so a renewal needs no
-- reset — the next warning window is a different set of days.
-- =============================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_notified_on DATE;
