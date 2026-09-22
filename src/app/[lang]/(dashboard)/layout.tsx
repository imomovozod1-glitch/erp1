import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { getCurrentTenantId, getCachedTenant } from '@/lib/tenant'
import { getStaffIdentity } from '@/lib/admin-auth'
import { servesTenantHosts } from '@/lib/tenant-host'
import { HANDOFF_SKIP_COOKIE } from '@/lib/tenant-handoff'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { OfflineBanner } from '@/components/shared/offline-banner'

export default async function DashboardLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode
  /** Parallel-route slot holding the intercepted "create" dialogs — see
   *  (dashboard)/@modal and src/components/shared/route-modal.tsx. */
  modal: React.ReactNode
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
  const requestHeaders = await headers()
  const requestedSubdomain = requestHeaders.get('x-tenant-subdomain')
  // SidebarProvider writes `sidebar_state` whenever the sidebar is toggled, but
  // nothing ever read it back — so every navigation re-mounted the provider at
  // its `defaultOpen = true` and the sidebar sprang open again a moment after
  // being closed. Seeding it from the cookie is what makes "closed" stick.
  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false'
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
  } else if (servesTenantHosts(requestHeaders.get('host') || '') && !cookieStore.get(HANDOFF_SKIP_COOKIE)) {
    // A session on a host that serves no company — the apex, or the bare host
    // the Capacitor shell and the Telegram Mini App open. The workspace is not
    // rendered here: the subscription gate in src/proxy.ts only runs on a
    // company host, so rendering here is how a lapsed company kept working.
    // The session is moved to the company's own address instead
    // (src/lib/tenant-handoff.ts), which is also where the gate lives.
    //
    // Staff never reach this line — they were redirected to their own consoles
    // above — and a deployment with no company hosts at all (a preview build)
    // falls through and renders as before, rather than looping on a redirect
    // to an address that does not exist. HANDOFF_SKIP_COOKIE is the same
    // protection for the case where the handoff itself cannot be minted.
    redirect('/api/auth/handoff')
  }

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar lang={lang} profile={profile} />
      <SidebarInset>
        <AppHeader profile={profile} lang={lang} />
        <main className="flex-1 p-6 pt-[calc(5.5rem+env(safe-area-inset-top))] bg-slate-50/50 dark:bg-slate-950 min-h-[calc(100vh-4rem)]">
          <OfflineBanner />
          {children}
          {modal}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
