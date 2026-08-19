import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ShieldCheck } from 'lucide-react'
import { AdminLogoutButton } from '@/components/admin/admin-logout-button'
import { AdminLocaleSwitcher } from '@/components/admin/admin-locale-switcher'

export async function AdminShell({
  adminName,
  children,
}: {
  adminName: string
  children: React.ReactNode
}) {
  const t = await getTranslations('admin.shell')

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-950">
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/admin/tenants" className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950 rounded-lg text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">ERP Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <AdminLocaleSwitcher />
            <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">{adminName}</span>
            <AdminLogoutButton label={t('logout')} />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
