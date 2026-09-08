import { RouteModal } from '@/components/shared/route-modal'
import CreatePage from '@/app/[lang]/(dashboard)/procurement/purchase-orders/new/page'

/**
 * Intercepts /procurement/purchase-orders/new so it opens as a dialog over the list it was
 * started from. The wrapped module is the real page — see RouteModal.
 */
export default function InterceptedCreatePage(props: any) {
  return (
    <RouteModal>
      <CreatePage {...props} />
    </RouteModal>
  )
}
