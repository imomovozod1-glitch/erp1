import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Route as RouteIcon, Truck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatDate } from '@/lib/utils'
import { DELIVERY_STATUS_TONES, type DeliveryStatus } from '@/lib/statuses'
import { WEEKDAY_KEYS } from '@/components/distribution/weekdays'

interface CustomerRoutesCardProps {
  stops: any[]
  deliveries: any[]
  lang: string
}

/**
 * "Which rounds is this customer on, and what is on its way to them" — shown on
 * the customer's own page.
 *
 * Without it a route is write-only: you can plan a round and nothing anywhere
 * else ever mentions it, which is how a planning screen quietly stops being
 * used. Rendered on the server; it is a list of links.
 */
export async function CustomerRoutesCard({ stops, deliveries, lang }: CustomerRoutesCardProps) {
  const [t, tCommon] = await Promise.all([
    getTranslations('distribution'),
    getTranslations('common'),
  ])

  if (stops.length === 0 && deliveries.length === 0) return null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {stops.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b p-4">
              <RouteIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('routes')}</h2>
            </div>
            <ul className="divide-y">
              {stops.map((stop) => (
                <li key={stop.id}>
                  <Link
                    href={`/${lang}/distribution/routes/${stop.route?.id}/edit`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/80"
                  >
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {stop.route?.name ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stop.route?.agent?.full_name || t('noAgent')}
                        {' · '}
                        {t('visitOrder')} {stop.position}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {stop.route?.weekday ? t(WEEKDAY_KEYS[stop.route.weekday - 1]) : t('noWeekday')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {deliveries.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b p-4">
              <Truck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('deliveries')}</h2>
            </div>
            <ul className="divide-y">
              {deliveries.map((delivery) => (
                <li key={delivery.id}>
                  <Link
                    href={`/${lang}/distribution/deliveries/${delivery.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/80"
                  >
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {delivery.delivery_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.agent?.full_name || tCommon('unassigned')}
                        {delivery.planned_date ? ` · ${formatDate(delivery.planned_date)}` : ''}
                      </p>
                    </div>
                    <StatusBadge
                      tone={DELIVERY_STATUS_TONES[delivery.status as DeliveryStatus] ?? 'slate'}
                      label={t(`status_${delivery.status}`)}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
