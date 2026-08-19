/**
 * Lazy subscription enforcement — the pattern most SaaS platforms use instead
 * of a separate scheduled job: a tenant stays "active" in the database until
 * something actually reads it past its `subscription_ends_at` with no
 * renewal, at which point it's treated (and persisted) as "blocked" right
 * then. Checked on every gate-relevant read (src/proxy.ts) and opportunistically
 * corrected wherever the admin panel reads a tenant list/detail, so the stored
 * value converges without needing pg_cron or an external scheduler.
 */
export function computeEffectiveStatus(status: string, subscriptionEndsAt: string | null): string {
  if (status === 'active' && subscriptionEndsAt && new Date(subscriptionEndsAt).getTime() < Date.now()) {
    return 'blocked'
  }
  return status
}
