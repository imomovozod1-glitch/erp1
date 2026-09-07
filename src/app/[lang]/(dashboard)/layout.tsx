import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { getCurrentTenantId, getCachedTenant } from '@/lib/tenant'
import { isSuperAdmin, isSupportAgent } from '@/lib/admin-auth'
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

  // Super-admin and tenant sessions share the same auth cookies — a
  // super-admin who is logged into /admin must never render the tenant
  // dashboard using their own stray profile (see src/lib/admin-auth.ts).
  if (await isSuperAdmin(user.id)) {
    redirect('/admin/tenants')
  }

  // Support agents share the same auth cookies too — same reasoning as the
  // super-admin check above (src/lib/admin-auth.ts).
  if (await isSupportAgent(user.id)) {
    redirect('/support')
  }

  // The subdomain the browser actually asked for (set by src/proxy.ts) has to
  // match the tenant this session belongs to. The middleware's tenant gate only
  // ever validates the *subdomain's* tenant — it never checks who is logged in,
  // and every read below resolves its tenant from the profile instead. So a
  // user whose own tenant was blocked or whose subscription lapsed could just
  // visit any other active tenant's subdomain and get their full dashboard,
  // with their own data, straight past the gate.
  const requestedSubdomain = (await headers()).get('x-tenant-subdomain')
  if (requestedSubdomain) {
    const tenantId = await getCurrentTenantId()
    const tenant = tenantId ? await getCachedTenant(tenantId) : null
    if (!tenant || (tenant as { subdomain?: string }).subdomain !== requestedSubdomain) {
      redirect(`/${lang}/tenant-status?reason=wrong-tenant`)
    }
  }

  // Profile is cached for 5 min per user id — only DB on first render.
  const profile = await getCachedProfile(user.id)

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
