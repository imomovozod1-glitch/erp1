'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Power, Search, Route as RouteIcon, Waypoints } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateRoutes } from '@/lib/data/revalidate'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { WEEKDAY_KEYS } from '@/components/distribution/weekdays'
import {
  isRoutePlanError,
  optimizeSavedRoute,
  routeHoursMinutes,
  routeKm,
  routePlanErrorMessage,
} from '@/lib/route-plan'

interface RouteRow {
  id: string
  name: string
  is_active: boolean
  weekday: number | null
  agent?: { full_name: string | null } | null
  stops?: { id: string }[] | null
  // Set once the round has been solved (migration_route_geometry.sql). Null on
  // a route nobody has optimised, and blanked again whenever its stops change.
  optimized_at?: string | null
  distance_m?: number | null
  duration_s?: number | null
}

interface RoutesTableProps {
  routes: RouteRow[]
  lang: string
}

/**
 * Marshrutlar — the routes list.
 *
 * Built like the compositions and role-templates lists rather than the sales
 * tables: a route is reference data a tenant has a handful of, so the whole
 * list arrives at once and the search runs in the browser.
 */
export function RoutesTable({ routes, lang }: RoutesTableProps) {
  const tCommon = useTranslations('common')
  const tRoot = useTranslations()
  const t = useTranslations('distribution')
  const [confirmDelete, confirmDialog] = useConfirmDelete()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null)
  const [isOptimizing, setIsOptimizing] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [search])

  const filtered = routes.filter((r) => {
    const needle = search.toLowerCase()
    return (
      r.name.toLowerCase().includes(needle) ||
      (r.agent?.full_name ?? '').toLowerCase().includes(needle)
    )
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  /**
   * Re-plans a saved marshrut without opening it.
   *
   * Unlike the same button inside the route form, this one PERSISTS: the API
   * route rewrites distribution_route_stops.position and stores the shape, so
   * the round is re-ordered for whoever opens it next. That is also why it is
   * a server call rather than a browser write — the Mapbox token is
   * server-only (src/lib/mapbox.ts).
   */
  const handleOptimize = async (id: string) => {
    setIsOptimizing(id)
    try {
      const result = await optimizeSavedRoute(id)
      if (isRoutePlanError(result)) {
        toast.error(routePlanErrorMessage(tRoot, result))
        return
      }
      toast.success(t('routeOptimized'))
      await invalidateRoutes()
    } finally {
      setIsOptimizing(null)
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setIsUpdatingStatus(id)
    const supabase = createClient() as any
    const { error } = await supabase.from('distribution_routes').update({ is_active: !currentStatus }).eq('id', id)
    if (error) {
      toast.error(error.message || tCommon('error'))
    } else {
      toast.success(tCommon('success'))
      await invalidateRoutes()
    }
    setIsUpdatingStatus(null)
  }

  const handleDelete = async (id: string) => {
    const route = routes.find((r) => r.id === id)
    if (!(await confirmDelete({ name: route?.name }))) return

    setIsDeleting(id)
    const supabase = createClient() as any
    const { error } = await supabase.from('distribution_routes').delete().eq('id', id)
    if (error) {
      if (error.code === '23503') {
        // A delivery still points at it (deliveries.route_id), so the route is
        // archived rather than removed.
        const { error: updateError } = await supabase
          .from('distribution_routes')
          .update({ is_active: false })
          .eq('id', id)
        if (updateError) {
          toast.error(tCommon('error'))
        } else {
          toast.success(t('routeInUse'))
          await invalidateRoutes()
        }
      } else {
        toast.error(error.message || tCommon('error'))
      }
    } else {
      toast.success(tCommon('success'))
      await invalidateRoutes()
    }
    setIsDeleting(null)
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${tCommon('search')}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} {tCommon('rows')}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-10 text-center font-semibold text-slate-500 dark:text-slate-400">#</TableHead>
              <TableHead className="font-semibold">{t('routeName')}</TableHead>
              <TableHead>{t('agent')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('weekday')}</TableHead>
              <TableHead>{t('stops')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('routeSummary')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12.5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <RouteIcon className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((route, index) => (
                <TableRow
                  key={route.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${lang}/distribution/routes/${route.id}/edit`)}
                >
                  <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{route.name}</p>
                  </TableCell>
                  <TableCell className={route.agent?.full_name ? '' : 'text-muted-foreground'}>
                    {route.agent?.full_name || t('noAgent')}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {route.weekday ? t(WEEKDAY_KEYS[route.weekday - 1]) : t('noWeekday')}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {t('routeStopsCount', { count: route.stops?.length ?? 0 })}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {route.optimized_at ? (
                      <span className="text-xs">
                        {t('routeDistance', { km: routeKm(route.distance_m ?? 0) })} ·{' '}
                        {t('routeDuration', routeHoursMinutes(route.duration_s ?? 0))}
                      </span>
                    ) : (
                      <span className="text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      tone={route.is_active ? 'emerald' : 'slate'}
                      label={route.is_active ? tCommon('active') : tCommon('inactive')}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          render={<Link href={`/${lang}/distribution/routes/${route.id}/edit`} prefetch={true} />}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleOptimize(route.id)}
                          disabled={isOptimizing === route.id}
                        >
                          <Waypoints className="mr-2 h-3.5 w-3.5" /> {t('optimize')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(route.id, route.is_active)}
                          disabled={isUpdatingStatus === route.id}
                        >
                          <Power className="mr-2 h-3.5 w-3.5" />{' '}
                          {route.is_active ? tCommon('inactive') : tCommon('active')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(route.id)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          disabled={isDeleting === route.id}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> {tCommon('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="cursor-pointer"
            >
              {lang === 'uz' ? 'Orqaga' : lang === 'ru' ? 'Назад' : 'Previous'}
            </Button>
            <span className="text-xs text-muted-foreground font-medium">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="cursor-pointer"
            >
              {lang === 'uz' ? 'Oldinga' : lang === 'ru' ? 'Вперед' : 'Next'}
            </Button>
          </div>
        )}
      </CardContent>
      {confirmDialog}
    </Card>
  )
}
