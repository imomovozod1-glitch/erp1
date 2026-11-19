import 'server-only'

/**
 * Mapbox — marshrut hisoblash (Directions + Optimization).
 *
 * Only the ROUTING half of Mapbox is used. The map itself stays on Leaflet
 * with free raster tiles (src/lib/map-tiles.ts): Mapbox bills tiles per tile
 * REQUEST, and one Leaflet viewport is 10–20 of them, so putting the basemap
 * on Mapbox would burn the free allowance on panning instead of on the thing
 * that actually has no free alternative — turn-by-turn road geometry.
 *
 * The token is server-only on purpose. Every call in this file runs inside an
 * API route, so `api.mapbox.com` never appears in the browser's connect-src
 * and the token cannot be lifted out of the bundle.
 *
 * Results are cached by the caller into distribution_routes (geometry,
 * distance_m, duration_s) — a route is optimised when it is edited, not when
 * it is looked at, which keeps a company's usage at a handful of requests a
 * day rather than one per page view.
 */

import { orderLocally } from '@/lib/mapbox-local-order'

const MAPBOX_API = 'https://api.mapbox.com'

/** Optimization v1 hard cap (docs.mapbox.com/api/navigation/optimization-v1). */
export const OPTIMIZATION_MAX_POINTS = 12
/** Directions hard cap (docs.mapbox.com/api/navigation/directions). */
export const DIRECTIONS_MAX_POINTS = 25

export type MapboxProfile = 'driving' | 'driving-traffic' | 'cycling' | 'walking'

export interface LngLat {
  lng: number
  lat: number
}

/** A GeoJSON LineString, as Mapbox returns it — [lng, lat] pairs. */
export interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

export interface RouteShape {
  geometry: RouteGeometry
  /** Metres. */
  distanceM: number
  /** Seconds. */
  durationS: number
}

export interface OptimizedRoute extends RouteShape {
  /**
   * The input indices in the order they should be visited. `order[0]` is the
   * first stop. Always a permutation of 0…points.length-1.
   */
  order: number[]
  /** Whether Mapbox solved it, or we fell back to our own ordering. */
  solver: 'mapbox' | 'local'
}

export class MapboxError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code)
    this.name = 'MapboxError'
  }
}

export function mapboxConfigured(): boolean {
  return Boolean(process.env.MAPBOX_ACCESS_TOKEN)
}

function token(): string {
  const value = process.env.MAPBOX_ACCESS_TOKEN
  if (!value) throw new MapboxError('mapbox_not_configured')
  return value
}

function coordsParam(points: LngLat[]): string {
  // Mapbox is lng,lat — the opposite of Leaflet. Getting this backwards puts
  // Tashkent in the Indian Ocean, so the conversion lives here only.
  return points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
}

async function callMapbox(url: string): Promise<any> {
  let response: Response
  try {
    response = await fetch(url, { cache: 'no-store' })
  } catch {
    throw new MapboxError('mapbox_unreachable')
  }
  if (response.status === 401 || response.status === 403) throw new MapboxError('mapbox_bad_token')
  if (response.status === 422) throw new MapboxError('mapbox_no_route')
  if (response.status === 429) throw new MapboxError('mapbox_rate_limited')
  if (!response.ok) throw new MapboxError('mapbox_failed', `HTTP ${response.status}`)

  const body = await response.json().catch(() => null)
  if (!body) throw new MapboxError('mapbox_failed', 'unparseable response')
  // Mapbox answers 200 with a code of its own for "no road connects these".
  if (body.code && body.code !== 'Ok') {
    throw new MapboxError(body.code === 'NoRoute' || body.code === 'NoTrips' ? 'mapbox_no_route' : 'mapbox_failed', body.message)
  }
  return body
}

/* ── Geometry ────────────────────────────────────────────────────────────── */

/**
 * Road geometry through every point in the given order.
 *
 * Over DIRECTIONS_MAX_POINTS the request is split into chunks that overlap by
 * one point, so leg N ends exactly where leg N+1 begins and the drawn line has
 * no gaps. Distance and duration are the sums.
 */
export async function getRouteGeometry(
  points: LngLat[],
  profile: MapboxProfile = 'driving'
): Promise<RouteShape> {
  if (points.length < 2) throw new MapboxError('too_few_points')

  const chunks: LngLat[][] = []
  for (let start = 0; start < points.length - 1; start += DIRECTIONS_MAX_POINTS - 1) {
    chunks.push(points.slice(start, start + DIRECTIONS_MAX_POINTS))
  }

  const coordinates: [number, number][] = []
  let distanceM = 0
  let durationS = 0

  for (const chunk of chunks) {
    if (chunk.length < 2) continue
    const url =
      `${MAPBOX_API}/directions/v5/mapbox/${profile}/${coordsParam(chunk)}` +
      `?geometries=geojson&overview=full&access_token=${token()}`
    const body = await callMapbox(url)
    const route = body.routes?.[0]
    if (!route) throw new MapboxError('mapbox_no_route')

    const leg: [number, number][] = route.geometry?.coordinates ?? []
    // Drop the duplicated seam point so the line has no doubled vertex.
    coordinates.push(...(coordinates.length > 0 ? leg.slice(1) : leg))
    distanceM += route.distance ?? 0
    durationS += route.duration ?? 0
  }

  return {
    geometry: { type: 'LineString', coordinates },
    distanceM: Math.round(distanceM),
    durationS: Math.round(durationS),
  }
}

/**
 * Best visiting order for a set of stops, plus the road geometry through it.
 *
 * ≤ OPTIMIZATION_MAX_POINTS goes to Mapbox Optimization, which solves it
 * against real road times. Above that Mapbox refuses the request, so the order
 * is worked out locally and one Directions call draws it.
 *
 * `fixedStart` pins points[0] as the first stop — used when the round starts
 * from the warehouse or from where the agent is standing.
 */
export async function optimizeStops(
  points: LngLat[],
  options: { fixedStart?: boolean; roundTrip?: boolean; profile?: MapboxProfile } = {}
): Promise<OptimizedRoute> {
  const { fixedStart = false, roundTrip = false, profile = 'driving' } = options
  if (points.length < 2) throw new MapboxError('too_few_points')

  if (points.length <= OPTIMIZATION_MAX_POINTS) {
    const params = new URLSearchParams({
      geometries: 'geojson',
      overview: 'full',
      roundtrip: roundTrip ? 'true' : 'false',
      source: fixedStart ? 'first' : 'any',
      access_token: token(),
    })
    // Mapbox rejects destination=any together with roundtrip=false on some
    // profiles; only ask for an open-ended finish when the round is not a loop.
    if (!roundTrip) params.set('destination', 'any')

    const body = await callMapbox(
      `${MAPBOX_API}/optimized-trips/v1/mapbox/${profile}/${coordsParam(points)}?${params}`
    )
    const trip = body.trips?.[0]
    const waypoints = body.waypoints
    if (!trip || !Array.isArray(waypoints)) throw new MapboxError('mapbox_no_route')

    // waypoints[i].waypoint_index is where input i lands in the trip — invert
    // it to get "the input index to visit at position p".
    const order: number[] = new Array(points.length).fill(-1)
    waypoints.forEach((waypoint: any, inputIndex: number) => {
      const position = waypoint?.waypoint_index
      if (typeof position === 'number' && position >= 0 && position < order.length) {
        order[position] = inputIndex
      }
    })
    if (order.some((index) => index < 0)) throw new MapboxError('mapbox_failed', 'incomplete waypoint order')

    return {
      order,
      geometry: { type: 'LineString', coordinates: trip.geometry?.coordinates ?? [] },
      distanceM: Math.round(trip.distance ?? 0),
      durationS: Math.round(trip.duration ?? 0),
      solver: 'mapbox',
    }
  }

  const order = orderLocally(points, fixedStart)
  const ordered = order.map((index) => points[index])
  const shape = await getRouteGeometry(roundTrip ? [...ordered, ordered[0]] : ordered, profile)
  return { order, ...shape, solver: 'local' }
}
