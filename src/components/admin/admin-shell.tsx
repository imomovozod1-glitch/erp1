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
        <main className="flex-1 p-6 pt-22 bg-slate-50/50 dark:bg-slate-950/50 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
