'use client'

import { useTranslations } from 'next-intl'
import { RouteMap } from '@/components/distribution/route-map'
import { routeHoursMinutes, routeKm } from '@/lib/route-plan'
import type { RoutePlan } from './route-model'
import type { RouteStops } from './use-route-stops'

// Above 12 stops the order comes from our own straight-line pass, so it says it is approximate.
function PlanSummary({ plan }: { plan: RoutePlan }) {
  const t = useTranslations('distribution')
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-3.5 py-2.5 text-xs">
      <span className="font-bold tracking-wider text-muted-foreground uppercase">{t('routeSummary')}</span>
      <span className="font-semibold text-foreground">{t('routeDistance', { km: routeKm(plan.distanceM) })}</span>
      <span className="font-semibold text-foreground">{t('routeDuration', routeHoursMinutes(plan.durationS))}</span>
      {plan.solver === 'local' && <span className="text-amber-600 dark:text-amber-400">{t('routeApproximate')}</span>}
    </div>
  )
}

export function RoutePlanPanel({ state }: { state: RouteStops }) {
  const t = useTranslations('distribution')
  const unlocated = state.stops.length - state.located.length
  if (state.located.length === 0) return null
  return (
    <div className="space-y-2">
      {state.plan && <PlanSummary plan={state.plan} />}
      {unlocated > 0 && <p className="text-xs text-amber-600 dark:text-amber-400">{t('routeUnlocated', { count: unlocated })}</p>}
      <RouteMap
        stops={state.located.map((stop) => ({ id: stop.customerId, name: stop.name, address: stop.address, latitude: stop.latitude ?? null, longitude: stop.longitude ?? null }))}
        geometry={state.plan?.geometry ?? null}
        className="h-72 w-full md:h-96"
      />
    </div>
  )
}
