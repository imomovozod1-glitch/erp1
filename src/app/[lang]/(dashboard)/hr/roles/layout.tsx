import { requireTenantAdmin } from '@/lib/permissions-server'

/**
 * Role templates are privilege-bearing: whoever can author one can decide what
 * its holders may see and do. Editing them is therefore restricted to tenant
 * admins, not merely to anyone with HR edit rights — otherwise a manager could
 * create a role granting every module and hand it out.
 */
export default async function RolesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireTenantAdmin(lang)
  return <>{children}</>
}
