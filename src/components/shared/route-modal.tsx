'use client'

import { usePathname, useRouter } from 'next/navigation'
import { RouteModalContext } from '@/lib/hooks/use-route-modal'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Shell for the "create" routes that are intercepted into a dialog
 * (`(dashboard)/@modal/(.)…/new`). The page it wraps is the very same server
 * component the standalone `/new` URL renders, so permission checks, data
 * fetching and the form itself behave identically whether the record is created
 * in the modal or on its own page (a hard load / refresh of the URL still gets
 * the full page — interception only applies to client-side navigation).
 *
 * Dismissal is deliberately restricted to the X button and to the form's own
 * Cancel/Save buttons (which go through `useRouteModalExit`, so they pop this
 * URL off the history stack instead of pushing the list on top of it). A stray
 * click on the backdrop or an Escape keypress must NOT discard a half-filled
 * form.
 */
export function RouteModal({
  children,
  flushFooter = false,
}: {
  children: React.ReactNode
  /**
   * The wrapped form ends in its own action bar pinned to the bottom of its
   * card (AdminFormActions — the super-admin forms). Drops the dialog's bottom
   * padding so that bar lands on the dialog's own border.
   *
   * With the padding in place it cannot: a sticky element is confined to its
   * containing block, so the bar stops at the end of its card, and the card
   * stops 24px short of the dialog edge. That gap is what it looked like — an
   * action bar floating above the bottom border instead of sitting on it.
   *
   * Off by default, because every other form here ends in ordinary buttons
   * that need that padding as breathing room.
   */
  flushFooter?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()

  // Safety net: every intercepted route in this app is a `.../new` create page,
  // so any other URL means this slot is showing content Next.js kept mounted
  // after a forward navigation. Render nothing rather than leave a dead dialog
  // sitting on top of the page the user just landed on.
  if (!pathname.endsWith('/new')) {
    return null
  }

  return (
    <RouteModalContext.Provider value={true}>
      <Dialog
        open
        // Blocks backdrop/outside clicks from closing the dialog.
        disablePointerDismissal
        onOpenChange={(open, details) => {
          if (open) return
          // Everything except the X button (Escape, focus leaving the dialog, …)
          // is cancelled, so it never closes behind the user's back.
          if (details.reason !== 'close-press') {
            details.cancel()
            return
          }
          router.back()
        }}
      >
        <DialogContent
          className={cn(
            'sm:max-w-5xl max-h-[90vh] overflow-y-auto pt-10 gap-0',
            // Same surface colour as the card it now sits flush against
            // (AdminFormShell): light mode already matches (--popover is
            // white), dark mode does not — #171520 against slate-900 — and the
            // difference would show through the card's rounded bottom corners.
            flushFooter ? 'px-6 pb-0 bg-white dark:bg-slate-900' : 'p-6'
          )}
        >
          {children}
        </DialogContent>
      </Dialog>
    </RouteModalContext.Provider>
  )
}
