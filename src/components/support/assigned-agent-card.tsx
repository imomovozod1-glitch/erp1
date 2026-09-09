import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Headset, Phone, ArrowRight } from 'lucide-react'
import { getAssignedSupportAgent } from '@/lib/support-agent'
import { formatPhoneInput } from '@/lib/tenant-auth'
import { getInitials } from '@/lib/utils'

/**
 * "Your support manager" — who to call, shown wherever a user might need help.
 *
 * A server component so the lookup can use the service-role client: the tenant
 * side has no RLS access to `support_agents` (see src/lib/support-agent.ts).
 * Renders nothing at all when no agent is assigned, rather than an empty card.
 */
export async function AssignedAgentCard({
  tenantId,
  lang,
  /** `compact` is the dashboard strip; the full card is for the support page. */
  variant = 'full',
}: {
  tenantId: string | null
  lang: string
  variant?: 'full' | 'compact'
}) {
  if (!tenantId) return null
  const agent = await getAssignedSupportAgent(tenantId)
  if (!agent) return null

  const t = await getTranslations('support')
  const phoneHref = `tel:${agent.phone.replace(/[^\d+]/g, '')}`
  const initials = getInitials(agent.fullName) || '?'

  if (variant === 'compact') {
    return (
      <Link
        href={`/${lang}/support`}
        className="group flex items-center gap-3 rounded-xl border-0 shadow-sm bg-white dark:bg-slate-900 p-4 transition-shadow hover:shadow-md"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50 text-sm font-bold text-violet-700 dark:text-violet-400">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('yourAgent')}
          </p>
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {agent.fullName}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">{formatPhoneInput(agent.phone)}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
      </Link>
    )
  }

  return (
    <div className="rounded-2xl border border-violet-100 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-base font-bold text-white">
            {initials}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              <Headset className="h-3.5 w-3.5" />
              {t('yourAgent')}
            </p>
            <p className="text-base font-bold text-slate-800 dark:text-slate-100">{agent.fullName}</p>
            <p className="text-xs text-muted-foreground">{t('yourAgentHint')}</p>
          </div>
        </div>
        <a
          href={phoneHref}
          className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-violet-700 dark:text-violet-300 shadow-sm transition-shadow hover:shadow-md tabular-nums"
        >
          <Phone className="h-4 w-4" />
          {formatPhoneInput(agent.phone)}
        </a>
      </div>
    </div>
  )
}
