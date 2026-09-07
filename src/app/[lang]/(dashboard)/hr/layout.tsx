import { requireModuleView } from '@/lib/permissions-server'

/**
 * Permission gate for the whole /hr subtree.
 *
 * Living in the layout rather than in each page means every current page — and
 * any page added later — inherits the check without anyone having to remember
 * it. Previously the only thing between a user without this permission and the
 * module was the sidebar not rendering its link; typing the URL worked fine.
 */
export default async function HrModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireModuleView('hr', lang)
  return <>{children}</>
}
