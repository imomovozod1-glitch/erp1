import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSupportAgentSession } from '@/lib/admin-auth'
import { SupportLogoutButton } from '@/components/support-portal/support-logout-button'
import { LifeBuoy } from 'lucide-react'

export default async function SupportProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSupportAgentSession()
  if (!session) redirect('/support/login')

  const t = await getTranslations('supportPortal')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center justify-between border-b bg-white dark:bg-slate-900 dark:border-slate-800 px-4 sm:px-6 h-14">
        <div className="flex items-center gap-2">
          <div className="flex aspect-square size-7 items-center justify-center rounded-lg bg-violet-600 text-white">
            <LifeBuoy className="size-4" />
          </div>
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{t('brandTitle')}</span>
          <span className="text-xs text-muted-foreground">· {session.fullName}</span>
        </div>
        <SupportLogoutButton label={t('logout')} />
      </header>
      <main className="p-4 sm:p-6">{children}</main>
    </div>
  )
}
