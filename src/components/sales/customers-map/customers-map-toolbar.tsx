'use client'

import { Loader2, LocateFixed, Navigation, Waypoints, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { routeHoursMinutes, routeKm } from '@/lib/route-plan'
import { MAX_ROUTE_STOPS, type RoundPlan, type RoundPlanner } from './use-round-plan'

interface ToolbarProps {
  onlyMine: boolean
  onScopeChange: (onlyMine: boolean) => void
  canFilterMine: boolean
  mineCount: number
  allCount: number
  shown: number
  visible: number
  located: boolean
  onLocate: () => void
  planner: RoundPlanner
  onPlan: () => void
  stopCount: number
}

export function CustomersMapToolbar(props: ToolbarProps) {
  const t = useTranslations()
  const missing = props.visible - props.shown
  const tooMany = props.stopCount > MAX_ROUTE_STOPS
  const LocateIcon = props.located ? LocateFixed : Navigation
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label={t('sales.customersMapAll')}
          value={props.onlyMine ? 'mine' : 'all'}
          onChange={(scope) => props.onScopeChange(scope === 'mine')}
          disabled={!props.canFilterMine}
          options={[
            { value: 'mine', label: `${t('sales.customersMapMine')} (${props.mineCount})` },
            { value: 'all', label: `${t('sales.customersMapAll')} (${props.allCount})` },
          ]}
        />
        <span className="text-sm text-muted-foreground">{t('sales.customersMapCount', { shown: props.shown, total: props.visible })}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {missing > 0 && (
          <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
            {t('sales.customersMapMissing', { count: missing })}
          </span>
        )}
        <Button type="button" variant="outline" size="sm" onClick={props.onLocate} className="gap-1.5 text-xs">
          <LocateIcon className={props.located ? 'size-3.5 text-sky-600' : 'size-3.5'} />
          {t('sales.locationPicker.locateMe')}
        </Button>
        {props.planner.plan ? (
          <Button type="button" variant="outline" size="sm" onClick={props.planner.clear} className="gap-1.5 text-xs">
            <X className="size-3.5" />
            {t('sales.customersMapClearRoute')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={props.onPlan}
            disabled={props.planner.planning || props.stopCount < 2 || tooMany}
            title={tooMany ? t('sales.customersMapRouteTooMany', { max: MAX_ROUTE_STOPS }) : undefined}
            className="gap-1.5 border-violet-200 bg-brand-subtle text-xs text-violet-700 dark:border-violet-900/60 dark:text-violet-300"
          >
            {props.planner.planning ? <Loader2 className="size-3.5 animate-spin" /> : <Waypoints className="size-3.5" />}
            {t('sales.customersMapPlanRoute')}
          </Button>
        )}
      </div>
    </div>
  )
}

export function RoundSummary({ plan }: { plan: RoundPlan }) {
  const t = useTranslations()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-violet-50/60 px-4 py-2 text-xs dark:bg-violet-950/20">
      <span className="font-bold tracking-wider text-violet-700 uppercase dark:text-violet-300">{t('sales.customersMapRoute')}</span>
      <span className="font-semibold text-foreground">{t('sales.customersMapRouteStops', { count: plan.stops.length })}</span>
      <span className="font-semibold text-foreground">{t('distribution.routeDistance', { km: routeKm(plan.distanceM) })}</span>
      <span className="font-semibold text-foreground">{t('distribution.routeDuration', routeHoursMinutes(plan.durationS))}</span>
      {plan.solver === 'local' && <span className="text-amber-600 dark:text-amber-400">{t('distribution.routeApproximate')}</span>}
    </div>
  )
}
