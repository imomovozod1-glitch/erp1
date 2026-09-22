import { RouteModal } from '@/components/shared/route-modal'
import CreatePage from '@/app/admin/(protected)/tenants/new/page'

/**
 * Intercepts /admin/tenants/new so it opens as a dialog over the list it was
 * started from. The wrapped module is the real page — see RouteModal.
 *
 * flushFooter: this form carries its own sticky action bar (AdminFormActions),
 * which has to sit on the dialog's bottom border rather than above it.
 */
export default function InterceptedCreatePage(props: any) {
  return (
    <RouteModal flushFooter>
      <CreatePage {...props} />
    </RouteModal>
  )
}
