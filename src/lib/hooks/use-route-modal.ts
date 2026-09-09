'use client'

import { createContext, useCallback, useContext } from 'react'
import { useRouter } from 'next/navigation'

/** Set by `RouteModal`; false on the standalone `/new` (or `/edit`) page. */
export const RouteModalContext = createContext(false)

/** True when the tree is rendered inside the intercepted-route dialog rather than on its own page. */
export function useIsRouteModal() {
  return useContext(RouteModalContext)
}

/**
 * The "done with this form" navigation, for both places a create/edit form can
 * live. Inside the modal it pops the intercepted URL off the history stack —
 * that is what actually unmounts the `@modal` slot. A forward `router.push()`
 * does not: Next.js keeps an unmatched parallel-route slot rendering its last
 * active page on soft navigation, so the dialog would stay on screen on top of
 * the list the user was sent back to. On the standalone page it simply
 * navigates to `fallbackHref`.
 */
export function useRouteModalExit(fallbackHref: string) {
  const isModal = useIsRouteModal()
  const router = useRouter()

  return useCallback(() => {
    if (isModal) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }, [isModal, router, fallbackHref])
}
