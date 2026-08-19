import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Ban, Clock, SearchX } from 'lucide-react'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('tenantStatus')
  return { title: t('notFoundTitle') }
}

type Reason = 'not-found' | 'blocked' | 'inactive'

const ICONS: Record<Reason, typeof Ban> = {
  'not-found': SearchX,
  blocked: Ban,
  inactive: Clock,
}

export default async function TenantStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const t = await getTranslations('tenantStatus')

  const resolvedReason: Reason =
    reason === 'blocked' || reason === 'inactive' ? reason : 'not-found'

  const Icon = ICONS[resolvedReason]
  const title = t(
    resolvedReason === 'blocked'
      ? 'blockedTitle'
      : resolvedReason === 'inactive'
        ? 'inactiveTitle'
        : 'notFoundTitle'
  )
  const message = t(
    resolvedReason === 'blocked'
      ? 'blockedMessage'
      : resolvedReason === 'inactive'
        ? 'inactiveMessage'
        : 'notFoundMessage'
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-sm p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
          <Icon className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      </div>
    </div>
  )
}
