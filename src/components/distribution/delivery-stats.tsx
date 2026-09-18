import { getTranslations } from 'next-intl/server'
import { Truck, PackageCheck, Clock, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StatsCard } from '@/components/shared/stats-card'
import { formatNumber } from '@/lib/utils'

interface DeliveryStatsProps {
  stats: {
    total: number
    byStatus: Record<string, number>
    agents: { id: string | null; name: string | null; open: number; delivered: number }[]
  }
}

/**
 * The distribution report, such as it is: how many parcels are waiting, on the
 * road and handed over, and how that splits across agents.
 *
 * Counted on the server over EVERY delivery, not over the page of rows on
 * screen — a per-agent total worked out from ten of five hundred rows would
 * simply be wrong, and wrong quietly.
 *
 * Deliberately two components rather than one block: the four tiles read at a
 * glance and belong above the list, but the agent table grows with the number
 * of agents and would push the list itself off the screen. The list is what
 * people came for, so the breakdown sits under it.
 */
export async function DeliveryStats({ stats }: DeliveryStatsProps) {
  const t = await getTranslations('distribution')

  const open = (stats.byStatus.pending ?? 0) + (stats.byStatus.in_transit ?? 0)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatsCard
        title={t('openOrders')}
        value={formatNumber(open)}
        icon={Clock}
        iconClassName="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
      />
      <StatsCard
        title={t('status_in_transit')}
        value={formatNumber(stats.byStatus.in_transit ?? 0)}
        icon={Truck}
        iconClassName="p-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
      />
      <StatsCard
        title={t('status_delivered')}
        value={formatNumber(stats.byStatus.delivered ?? 0)}
        icon={PackageCheck}
        iconClassName="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
      />
      <StatsCard
        title={t('agentBreakdown')}
        value={formatNumber(stats.agents.length)}
        icon={Users}
        iconClassName="p-2 rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
      />
    </div>
  )
}

export async function DeliveryAgentBreakdown({ stats }: DeliveryStatsProps) {
  const [t, tCommon] = await Promise.all([
    getTranslations('distribution'),
    getTranslations('common'),
  ])

  if (stats.agents.length === 0) return null

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="border-b p-4">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('agentBreakdown')}</h2>
        </div>
        <ul className="divide-y">
          {stats.agents.map((agent) => (
            <li
              key={agent.id ?? 'none'}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <span className={agent.name ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-muted-foreground'}>
                {agent.name || tCommon('unassigned')}
              </span>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="block text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {t('inHand')}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatNumber(agent.open)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {t('handedOver')}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatNumber(agent.delivered)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
