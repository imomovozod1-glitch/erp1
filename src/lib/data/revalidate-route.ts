import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from './queries'

/**
 * Cache invalidation for Route Handlers.
 *
 * `updateTag` (src/lib/data/revalidate.ts) throws outside a Server Action, so an
 * API route that called `invalidate*()` saved the row, answered 500 and left the
 * old value in the cache. `expire: 0` is the Route Handler's way of expiring a
 * tag immediately.
 */
export function expireProfile(userId: string) {
  revalidateTag(`profile:${userId}`, { expire: 0 })
}

export function expireRoleTemplates() {
  revalidateTag(CACHE_TAGS.roleTemplates, { expire: 0 })
}
