'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * The signed-in user's id, from the browser Supabase client.
 *
 * Every create/edit form already resolves this at submit time so it can stamp
 * `created_by` / `assigned_to`, but each one did it differently and none of
 * them had the id available while *rendering* — which is why the "responsible
 * person" picker showed "Unassigned" on forms that were, in fact, about to
 * save the document to the current user. This hook exists so a component can
 * know who the user is before the submit handler runs.
 *
 * Returns null until the session resolves; callers treat that as "unknown"
 * rather than "nobody".
 */
export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data?.user?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return userId
}
