import * as z from 'zod'
import type { RouteGeometry } from '@/lib/route-plan'

export interface RouteCustomerOption {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface Stop {
  customerId: string
  name: string
  phone?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface RoutePlan {
  geometry: RouteGeometry
  distanceM: number
  durationS: number
  solver: 'mapbox' | 'local' | 'none'
}

export const routeSchema = (required: string) =>
  z.object({
    name: z.string().min(1, required),
    agent_id: z.string().optional().nullable(),
    weekday: z.string().optional().nullable(),
    notes: z.string().optional(),
    is_active: z.boolean().default(true),
  })

export type RouteData = z.infer<ReturnType<typeof routeSchema>>

export const routeDefaults = (initial: any): RouteData => ({
  name: initial?.name || '',
  agent_id: initial?.agent_id || '',
  weekday: initial?.weekday ? String(initial.weekday) : '',
  notes: initial?.notes || '',
  is_active: initial?.is_active ?? true,
})

export const isLocated = (stop: Stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number'

export const stopFromCustomer = (customer: RouteCustomerOption): Stop => ({
  customerId: customer.id,
  name: customer.name,
  phone: customer.phone,
  address: customer.address,
  latitude: customer.latitude ?? null,
  longitude: customer.longitude ?? null,
})

export const stopsFrom = (rows: any[] = []): Stop[] =>
  rows.map((s) => ({
    customerId: s.customer_id,
    name: s.customer?.name ?? '',
    phone: s.customer?.phone ?? null,
    address: s.customer?.address ?? null,
    latitude: s.customer?.latitude ?? null,
    longitude: s.customer?.longitude ?? null,
  }))

/** A route saved with a solved shape starts with it drawn; anything else starts without a line. */
export const savedPlan = (initial: any): RoutePlan | null =>
  initial?.geometry && initial?.optimized_at
    ? { geometry: initial.geometry, distanceM: initial.distance_m ?? 0, durationS: initial.duration_s ?? 0, solver: initial.optimized_by ?? 'mapbox' }
    : null

export function swap<T>(items: T[], index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
