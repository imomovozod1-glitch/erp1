import { redirect } from 'next/navigation'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
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

  // Profile is cached for 5 min per user id — only DB on first render.
  const profile = await getCachedProfile(user.id)

  return (
    <SidebarProvider>
      <AppSidebar lang={lang} profile={profile} />
      <SidebarInset>
        <AppHeader profile={profile} lang={lang} />
        <main className="flex-1 p-6 pt-22 bg-slate-50/50 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
