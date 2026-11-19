'use client'

import { useRouter } from 'next/navigation'
import { Pencil, Power, Route as RouteIcon, Trash2, Waypoints } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useCan } from '@/components/providers/permissions-provider'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { MobileChip, MobileThumb } from '@/components/shared/mobile-list'
import { PagedListCard, type PageInfo } from '@/components/shared/paged-list-card'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/shared/responsive-table'
import { RowActionsMenu } from '@/components/shared/row-actions-menu'
import { ActiveBadge, EmptyCatalog } from '@/components/inventory/catalog/catalog-parts'
import { WEEKDAY_KEYS } from '@/components/distribution/weekdays'
import { invalidateRoutes } from '@/lib/data/revalidate'
import { deleteOrArchive, setRowActive } from '@/lib/delete-or-archive'
import { useRowAction } from '@/lib/hooks/use-row-action'
import { isRoutePlanError, optimizeSavedRoute, routeHoursMinutes, routeKm, routePlanErrorMessage } from '@/lib/route-plan'
import { createClient } from '@/lib/supabase/client'

interface RouteRow {
  id: string
  name: string
  is_active: boolean
  weekday: number | null
  agent?: { full_name: string | null } | null
  stops?: { id: string }[] | null
  /** Set once the round is solved; blanked again whenever its stops change. */
  optimized_at?: string | null
  distance_m?: number | null
  duration_s?: number | null
}

interface RoutesTableProps extends PageInfo {
  routes: RouteRow[]
  lang: string
}

function useRouteActions() {
  const t = useTranslations()
  const [confirmDelete, confirmDialog] = useConfirmDelete()
  const { busyId, run } = useRowAction(invalidateRoutes)
  // Unlike the form's button this PERSISTS the new order and shape, through the server (the Mapbox token is server-only).
  const optimize = (route: RouteRow) =>
    run(route.id, async () => {
      const result = await optimizeSavedRoute(route.id)
      if (!isRoutePlanError(result)) return t('distribution.routeOptimized')
      toast.error(routePlanErrorMessage(t, result))
      return null
    })
  const toggle = (route: RouteRow) =>
    run(route.id, async () => {
      await setRowActive(createClient(), 'distribution_routes', route.id, !route.is_active)
      return t('common.success')
    })
  // A delivery still pointing at the route archives it instead.
  const remove = async (route: RouteRow) => {
    if (!(await confirmDelete({ name: route.name }))) return
    await run(route.id, async () => ((await deleteOrArchive(createClient(), 'distribution_routes', route.id)) === 'archived' ? t('distribution.routeInUse') : t('common.success')))
  }
  return { busyId, optimize, toggle, remove, confirmDialog }
}

function useRouteLabels() {
  const t = useTranslations('distribution')
  return {
    weekday: (route: RouteRow) => (route.weekday ? t(WEEKDAY_KEYS[route.weekday - 1]) : t('noWeekday')),
    agent: (route: RouteRow) => route.agent?.full_name || t('noAgent'),
    stops: (route: RouteRow) => t('routeStopsCount', { count: route.stops?.length ?? 0 }),
    summary: (route: RouteRow) =>
      route.optimized_at ? `${t('routeDistance', { km: routeKm(route.distance_m ?? 0) })} · ${t('routeDuration', routeHoursMinutes(route.duration_s ?? 0))}` : '—',
  }
}

/** Marshrutlar: paged and searched on the server, like every other list. */
export function RoutesTable({ routes, lang, ...pageInfo }: RoutesTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const canEdit = useCan('distribution', 'edit', 'routes')
  const canDelete = useCan('distribution', 'delete', 'routes')
  const actions = useRouteActions()
  const label = useRouteLabels()
  const editUrl = (route: RouteRow) => `/${lang}/distribution/routes/${route.id}/edit`
  const menu = (route: RouteRow) => {
    const busy = actions.busyId === route.id
    return (
      <RowActionsMenu
        actions={[
          { key: 'edit', label: t('common.edit'), icon: Pencil, href: editUrl(route), hidden: !canEdit },
          { key: 'optimize', label: t('distribution.optimize'), icon: Waypoints, onClick: () => actions.optimize(route), disabled: busy },
          { key: 'toggle', label: t(route.is_active ? 'common.inactive' : 'common.active'), icon: Power, onClick: () => actions.toggle(route), disabled: busy, hidden: !canEdit },
          { key: 'delete', label: t('common.delete'), icon: Trash2, onClick: () => actions.remove(route), disabled: busy, destructive: true, hidden: !canDelete },
        ]}
      />
    )
  }
  const columns: ResponsiveColumn<RouteRow>[] = [
    { key: 'name', header: t('distribution.routeName'), cell: (route) => <span className="font-medium text-foreground">{route.name}</span> },
    { key: 'agent', header: t('distribution.agent'), cell: (route) => <span className={route.agent?.full_name ? '' : 'text-muted-foreground'}>{label.agent(route)}</span> },
    { key: 'weekday', header: t('distribution.weekday'), cell: (route) => <span className="text-muted-foreground">{label.weekday(route)}</span> },
    { key: 'stops', header: t('distribution.stops'), cell: (route) => <span className="text-sm text-muted-foreground">{label.stops(route)}</span> },
    { key: 'summary', header: t('distribution.routeSummary'), className: 'max-lg:hidden', cell: (route) => <span className="text-xs text-muted-foreground">{label.summary(route)}</span> },
    { key: 'status', header: t('common.status'), cell: (route) => <ActiveBadge active={route.is_active} /> },
    { key: 'menu', header: '', className: 'w-12', isolated: true, cell: menu },
  ]
  return (
    <PagedListCard pageInfo={pageInfo}>
      <ResponsiveTable
        rows={routes}
        rowKey={(route) => route.id}
        columns={columns}
        indexOffset={(pageInfo.page - 1) * pageInfo.pageSize}
        onRowClick={(route) => router.push(editUrl(route))}
        empty={<EmptyCatalog icon={RouteIcon} />}
        card={(route) => ({
          leading: <MobileThumb fallback={<RouteIcon />} />,
          eyebrow: (
            <>
              <MobileChip>{label.weekday(route)}</MobileChip>
              <span className="truncate">{label.agent(route)}</span>
            </>
          ),
          title: route.name,
          status: <ActiveBadge active={route.is_active} />,
          menu: menu(route),
          stats: [
            { label: t('distribution.stops'), value: label.stops(route), tone: 'brand' },
            { label: t('distribution.routeSummary'), value: label.summary(route) },
          ],
        })}
      />
      {actions.confirmDialog}
    </PagedListCard>
  )
}
