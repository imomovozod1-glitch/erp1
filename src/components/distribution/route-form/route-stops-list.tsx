'use client'

import { ArrowDown, ArrowUp, MapPinOff, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { isLocated, type Stop } from './route-model'
import type { RouteStops } from './use-route-stops'

function NotLocated({ className }: { className?: string }) {
  const t = useTranslations('distribution')
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400', className)} title={t('stopNotLocatedHint')}>
      <MapPinOff className="size-3.5" />
      {t('stopNotLocated')}
    </span>
  )
}

/** Visit order is the point of the list, so each stop can be moved as well as removed. */
function StopActions({ state, stop, index, size }: { state: RouteStops; stop: Stop; index: number; size: string }) {
  const t = useTranslations()
  const button = cn('p-0', size)
  return (
    <div className="flex items-center justify-end gap-1">
      <Button type="button" variant="ghost" size="sm" aria-label={t('distribution.moveUp')} onClick={() => state.move(index, -1)} disabled={index === 0} className={button}>
        <ArrowUp className="size-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" aria-label={t('distribution.moveDown')} onClick={() => state.move(index, 1)} disabled={index === state.stops.length - 1} className={button}>
        <ArrowDown className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t('common.delete')}
        onClick={() => state.remove(stop.customerId)}
        className={cn(button, 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30')}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

function StopCard({ state, stop, index }: { state: RouteStops; stop: Stop; index: number }) {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">{index + 1}</span>
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          <p className="text-sm font-semibold break-words text-foreground">{stop.name}</p>
          {stop.phone && <p>{stop.phone}</p>}
          {isLocated(stop) ? stop.address && <p>{stop.address}</p> : <NotLocated />}
        </div>
      </div>
      <div className="mt-2 border-t pt-2">
        <StopActions state={state} stop={stop} index={index} size="size-10" />
      </div>
    </div>
  )
}

function StopsTable({ state }: { state: RouteStops }) {
  const t = useTranslations('distribution')
  return (
    <div className="overflow-x-auto rounded-lg border max-md:hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-16 text-center">{t('visitOrder')}</TableHead>
            <TableHead>{t('customer')}</TableHead>
            <TableHead>{t('address')}</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.stops.map((stop, index) => (
            <TableRow key={stop.customerId}>
              <TableCell className="text-center text-xs font-semibold text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-medium">
                {stop.name}
                {stop.phone && <span className="ml-2 text-xs text-muted-foreground">{stop.phone}</span>}
              </TableCell>
              <TableCell className="text-muted-foreground">{isLocated(stop) ? stop.address || '—' : <NotLocated />}</TableCell>
              <TableCell>
                <StopActions state={state} stop={stop} index={index} size="size-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function RouteStopsList({ state }: { state: RouteStops }) {
  const t = useTranslations('distribution')
  if (state.stops.length === 0) return <p className="rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground">{t('noStops')}</p>
  return (
    <>
      <div className="space-y-2 md:hidden">
        {state.stops.map((stop, index) => (
          <StopCard key={stop.customerId} state={state} stop={stop} index={index} />
        ))}
      </div>
      <StopsTable state={state} />
    </>
  )
}
