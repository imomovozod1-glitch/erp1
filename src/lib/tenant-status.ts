/**
 * Lazy subscription enforcement — the pattern most SaaS platforms use instead
 * of a separate scheduled job: a tenant stays "active" in the database until
 * something actually reads it past its `subscription_ends_at` with no
 * renewal, at which point it's treated (and persisted) as "blocked" right
 * then. Checked on every gate-relevant read (src/proxy.ts) and opportunistically
 * corrected wherever the admin panel reads a tenant list/detail, so the stored
 * value converges without needing pg_cron or an external scheduler.
 *
 * The end date is inclusive — see isSubscriptionExpired in
 * src/lib/subscription.ts. Comparing `new Date(ends_at)` against the clock, as
 * this did, blocked the company at UTC midnight ON the day their subscription
 * ran to, taking away a day they had paid for.
 */
import { isSubscriptionExpired } from '@/lib/subscription'

export function computeEffectiveStatus(status: string, subscriptionEndsAt: string | null): string {
  if (status === 'active' && isSubscriptionExpired(subscriptionEndsAt)) {
    return 'blocked'
  }
  return status
}
