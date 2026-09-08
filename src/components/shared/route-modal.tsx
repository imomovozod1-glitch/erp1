'use client'

import { useRouter } from 'next/navigation'
import { Dialog, DialogContent } from '@/components/ui/dialog'

/**
 * Shell for the "create" routes that are intercepted into a dialog
 * (`(dashboard)/@modal/(.)…/new`). The page it wraps is the very same server
 * component the standalone `/new` URL renders, so permission checks, data
 * fetching and the form itself behave identically whether the record is created
 * in the modal or on its own page (a hard load / refresh of the URL still gets
 * the full page — interception only applies to client-side navigation).
 *
 * Dismissal is deliberately restricted to the X button and to the form's own
 * Cancel/Save buttons (both of which navigate back to the list, which unmounts
 * this slot). A stray click on the backdrop or an Escape keypress must NOT
 * discard a half-filled form.
 */
export function RouteModal({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
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
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-6 pt-10 gap-0">
        {children}
      </DialogContent>
    </Dialog>
  )
}
