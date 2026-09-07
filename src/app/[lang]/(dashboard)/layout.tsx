import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { getCurrentTenantId, getCachedTenant } from '@/lib/tenant'
import { getStaffIdentity } from '@/lib/admin-auth'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  // getSession() reads the JWT locally — NO network call (~0 ms).
  // Security: middleware (middleware.ts) already called getUser() on every request
  // and redirects unauthenticated users before reaching this layout.
  const user = await getSessionUser()

  if (!user) {
    redirect(`/${lang}/login`)
  }

  // Everything this layout needs is fetched CONCURRENTLY. It previously
  // awaited each step in turn — staff check, then a second staff check, then
  // the tenant, then the profile — so the page could not start rendering until
  // four sequential Supabase round trips had completed, one after another,
  // even though none of them depends on the result of the others.
  const requestedSubdomain = (await headers()).get('x-tenant-subdomain')
  const [staffIdentity, profile, tenant] = await Promise.all([
    // Super-admin and support-agent sessions share the same auth cookies as
    // tenant users, so a staff session must never render the tenant dashboard
    // using its own stray `profiles` row (see src/lib/admin-auth.ts).
    getStaffIdentity(user.id),
    getCachedProfile(user.id),
    // Only needed when a tenant subdomain is in play; resolving it here keeps
    // it off the critical path when it is.
    requestedSubdomain
      ? getCurrentTenantId().then((id) => (id ? getCachedTenant(id) : null))
      : Promise.resolve(null),
  ])

  if (staffIdentity === 'super_admin') {
    redirect('/admin/tenants')
  }
  if (staffIdentity === 'support_agent') {
    redirect('/support')
  }

  // The subdomain the browser actually asked for has to match the tenant this
  // session belongs to. The middleware's tenant gate only ever validates the
  // *subdomain's* tenant — it never checks who is logged in — so without this
  // a user whose own tenant was blocked could visit any other active tenant's
  // subdomain and get their full dashboard, straight past the gate.
  if (requestedSubdomain) {
    if (!tenant || (tenant as { subdomain?: string }).subdomain !== requestedSubdomain) {
      redirect(`/${lang}/tenant-status?reason=wrong-tenant`)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar lang={lang} profile={profile} />
      <SidebarInset>
        <AppHeader profile={profile} lang={lang} />
        <main className="flex-1 p-6 pt-[calc(5.5rem+env(safe-area-inset-top))] bg-slate-50/50 dark:bg-slate-950 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
