/**
 * Client side of route planning: calling the two Mapbox-backed API routes and
 * turning what they answer into something a component can render.
 *
 * The browser never talks to Mapbox itself — the token is server-only — so
 * everything here goes through /api/distribution/*.
 */

/** GeoJSON LineString as the API answers it: [lng, lat] pairs. */
export interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

export interface PlannedRoute {
  /** Input indices in visiting order. */
  order: number[]
  geometry: RouteGeometry
  distanceM: number
  durationS: number
  solver: 'mapbox' | 'local' | 'none'
}

export interface RoutePlanError {
  code: string
}

/**
 * Leaflet wants [lat, lng]; GeoJSON is [lng, lat]. Every polyline in the app
 * goes through this so the flip happens in exactly one place.
 */
export function toLeafletPath(geometry: RouteGeometry | null | undefined): [number, number][] {
  if (!geometry?.coordinates) return []
  return geometry.coordinates.map(([lng, lat]) => [lat, lng])
}

/** Kilometres, one decimal — road metres are far more precision than a round needs. */
export function routeKm(distanceM: number): number {
  return Math.round(distanceM / 100) / 10
}

/** Seconds split into whole hours and minutes, for `t('hoursMinutes', …)`. */
export function routeHoursMinutes(durationS: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round(durationS / 60)
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

async function post<T>(url: string, body: unknown): Promise<T | RoutePlanError> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.ok) return { code: data?.code ?? 'request_failed' }
    return data as T
  } catch {
    return { code: 'request_failed' }
  }
}

/** A successful plan always carries `geometry`; a refusal only carries `code`. */
export function isRoutePlanError(value: PlannedRoute | RoutePlanError): value is RoutePlanError {
  return 'code' in value
}

export interface OptimizeRouteResult extends PlannedRoute {
  stops: { id: string; customerId: string; name: string; position: number }[]
  unlocatedCount: number
  solver: 'mapbox' | 'local'
}

/** Re-plans a saved marshrut and persists the new stop order. */
export function optimizeSavedRoute(
  routeId: string,
  options: { fixedStart?: boolean; roundTrip?: boolean } = {}
): Promise<OptimizeRouteResult | RoutePlanError> {
  return post<OptimizeRouteResult>(`/api/distribution/routes/${routeId}/optimize`, options)
}

/** Plans an unsaved round through arbitrary points — nothing is stored. */
export function planAdHocRoute(
  points: { lng: number; lat: number }[],
  options: { optimize?: boolean; fixedStart?: boolean; roundTrip?: boolean } = {}
): Promise<PlannedRoute | RoutePlanError> {
  return post<PlannedRoute>('/api/distribution/directions', { points, ...options })
}

/**
 * Mapbox refusals the user can do something about get their own message; the
 * rest collapse into one. Mirrors businessRpcErrorMessage in src/lib/business-rpc.ts.
 */
export function routePlanErrorMessage(t: (key: string) => string, error: RoutePlanError): string {
  switch (error.code) {
    case 'mapbox_not_configured':
      return t('distribution.routeErrorNotConfigured')
    case 'mapbox_no_route':
      return t('distribution.routeErrorNoRoute')
    case 'mapbox_rate_limited':
      return t('distribution.routeErrorRateLimited')
    case 'too_few_located_stops':
      return t('distribution.routeErrorTooFewStops')
    case 'forbidden':
      return t('common.noPermission')
    default:
      return t('distribution.routeErrorFailed')
  }
}
