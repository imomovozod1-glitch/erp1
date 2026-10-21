import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminHeader } from '@/components/admin/admin-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export function AdminShell({
  adminName,
  adminEmail,
  children,
}: {
  adminName: string
  adminEmail: string
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AdminSidebar adminName={adminName} adminEmail={adminEmail} />
      <SidebarInset>
        <AdminHeader />
        <main className="min-w-0 flex-1 p-4 pt-20 md:p-6 md:pt-22 bg-slate-50/50 dark:bg-slate-950/50 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
