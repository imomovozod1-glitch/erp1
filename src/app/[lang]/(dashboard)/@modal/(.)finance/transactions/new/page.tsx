import { RouteModal } from '@/components/shared/route-modal'
import CreatePage from '@/app/[lang]/(dashboard)/finance/transactions/new/page'

/**
 * Intercepts /finance/transactions/new so it opens as a dialog over the list it was
 * started from. The wrapped module is the real page — see RouteModal.
 */
export default function InterceptedCreatePage(props: any) {
  return (
    <RouteModal>
      <CreatePage {...props} />
    </RouteModal>
  )
}
