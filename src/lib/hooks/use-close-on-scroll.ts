'use client'

import { useEffect } from 'react'

/**
 * Dismisses an anchored popup when the page scrolls underneath it.
 *
 * Base UI keeps a popover glued to its anchor, so scrolling the field out of
 * view drags the panel along with it — straight over the app's fixed header,
 * which sits at a lower z-index and cannot simply be raised above it because
 * the header carries its own dropdown menu. `collisionPadding` on
 * PopoverContent keeps a panel clear of the header where it opens; this covers
 * the other half, when the anchor itself scrolls away.
 *
 * Closing rather than pinning the panel in place: a calendar left floating at
 * the top of the screen, detached from the field it belongs to, is its own
 * kind of broken. Dismissing on scroll is what date pickers conventionally do.
 *
 * Only page-level scrolling counts — scroll events on inner elements (the
 * month list, the hour column) never reach `window`, so operating the panel
 * cannot dismiss it.
 */
export function useCloseOnScroll(open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return
    const handle = () => close()
    window.addEventListener('scroll', handle, { passive: true })
    return () => window.removeEventListener('scroll', handle)
  }, [open, close])
}
