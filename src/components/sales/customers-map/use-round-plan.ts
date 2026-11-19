'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { isRoutePlanError, planAdHocRoute, routePlanErrorMessage, type RouteGeometry } from '@/lib/route-plan'
import type { MappableCustomer } from './map-pins'

export const MAX_ROUTE_STOPS = 60

export interface RoundPlan {
  geometry: RouteGeometry
  distanceM: number
  durationS: number
  solver: 'mapbox' | 'local' | 'none'
  stops: MappableCustomer[]
}

/**
 * A day's round through the pins on screen — planned on demand and never stored
 * (saved routes live in Distribution). Each run is one metered Mapbox request.
 */
export function useRoundPlan() {
  const t = useTranslations()
  const [plan, setPlan] = useState<RoundPlan | null>(null)
  const [planning, setPlanning] = useState(false)

  const run = async (stops: MappableCustomer[], start: [number, number] | null) => {
    if (stops.length < 2 || stops.length > MAX_ROUTE_STOPS) return
    setPlanning(true)
    try {
      const origin = start ? [{ lng: start[1], lat: start[0] }] : []
      const points = stops.map((c) => ({ lng: c.longitude as number, lat: c.latitude as number }))
      const result = await planAdHocRoute([...origin, ...points], { optimize: true, fixedStart: origin.length === 1 })
      if (isRoutePlanError(result)) return void toast.error(routePlanErrorMessage(t, result))
      const offset = origin.length
      setPlan({
        geometry: result.geometry,
        distanceM: result.distanceM,
        durationS: result.durationS,
        solver: result.solver,
        stops: result.order.filter((index) => index >= offset).map((index) => stops[index - offset]),
      })
    } finally {
      setPlanning(false)
    }
  }

  return { plan, planning, run, clear: () => setPlan(null) }
}

export type RoundPlanner = ReturnType<typeof useRoundPlan>
