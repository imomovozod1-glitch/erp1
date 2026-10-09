/**
 * The till's catalogue and customer list.
 *
 * Part of the query layer described in `./index.ts` — every function here is
 * `unstable_cache`-wrapped, tagged for invalidation, and MUST filter by
 * `tenant_id` explicitly: the service-role client it uses bypasses RLS.
 *
 * Narrower than getCachedProducts / getCachedCustomers on purpose: the POS
 * page ships its whole catalogue to the browser, so every column and every
 * inactive row read here is paid for in the page payload on each till load.
 * The column lists are exactly what src/components/pos/** reads (grid, cart,
 * checkout, low-stock warning) — widen them if a POS component starts reading
 * another field.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { CACHE_TAGS } from './cache-tags'

export const getPosProducts = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('products')
      .select('id, name, sku, price, stock, min_stock, unit, image_url, category_id, is_service')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['pos-products'],
  { tags: [CACHE_TAGS.products, CACHE_TAGS.categories], revalidate: 60 }
)

export const getPosCustomers = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['pos-customers'],
  { tags: [CACHE_TAGS.customers, CACHE_TAGS.invoices, CACHE_TAGS.customerCategories], revalidate: 60 }
)
