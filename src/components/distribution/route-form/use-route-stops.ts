'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { isRoutePlanError, planAdHocRoute, routePlanErrorMessage } from '@/lib/route-plan'
import { isLocated, savedPlan, stopFromCustomer, stopsFrom, swap, type RouteCustomerOption, type RoutePlan, type Stop } from './route-model'

/**
 * The round's stops in visit order and its solved shape. Each solve is a metered Mapbox
 * request, so it runs only on demand; any edit to the list drops the drawn line, as the
 * database trigger does on its side.
 */
export function useRouteStops(initial: any, initialStops: any[] | undefined, customers: RouteCustomerOption[]) {
  const t = useTranslations()
  const [stops, setStops] = useState<Stop[]>(() => stopsFrom(initialStops))
  const [plan, setPlan] = useState<RoutePlan | null>(() => savedPlan(initial))
  const [optimizing, setOptimizing] = useState(false)
  const located = stops.filter(isLocated)

  const edit = (next: (current: Stop[]) => Stop[]) => {
    setPlan(null)
    setStops(next)
  }

  const add = (customerId: string) => {
    if (stops.some((s) => s.customerId === customerId)) {
      toast.error(t('distribution.stopExists'))
      return false
    }
    const customer = customers.find((c) => c.id === customerId)
    if (!customer) return false
    edit((current) => [...current, stopFromCustomer(customer)])
  }

  // Routed stops take the solved order; unpinned ones keep theirs at the end, still needing an address.
  const optimize = async () => {
    if (located.length < 2) return void toast.error(t('distribution.routeErrorTooFewStops'))
    setOptimizing(true)
    try {
      const result = await planAdHocRoute(located.map((s) => ({ lng: s.longitude as number, lat: s.latitude as number })), { optimize: true })
      if (isRoutePlanError(result)) return void toast.error(routePlanErrorMessage(t, result))
      setStops([...result.order.map((index) => located[index]), ...stops.filter((s) => !located.includes(s))])
      setPlan({ geometry: result.geometry, distanceM: result.distanceM, durationS: result.durationS, solver: result.solver })
      toast.success(t('distribution.routeOptimized'))
    } finally {
      setOptimizing(false)
    }
  }

  return {
    stops,
    plan,
    located,
    optimizing,
    add,
    optimize,
    move: (index: number, delta: number) => edit((current) => swap(current, index, delta)),
    remove: (customerId: string) => edit((current) => current.filter((s) => s.customerId !== customerId)),
    positionOf: new Map(stops.map((s, index) => [s.customerId, index + 1])),
  }
}

export type RouteStops = ReturnType<typeof useRouteStops>
