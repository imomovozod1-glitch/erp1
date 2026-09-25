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

/* ── Ordering ────────────────────────────────────────────────────────────── */

/** Straight-line metres between two points — only ever used to RANK candidate
 *  orders locally, never reported as a distance. */
function haversineM(a: LngLat, b: LngLat): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function pathLength(points: LngLat[], order: number[]): number {
  let total = 0
  for (let i = 0; i < order.length - 1; i++) total += haversineM(points[order[i]], points[order[i + 1]])
  return total
}

/**
 * Nearest-neighbour seed refined by 2-opt, both on straight-line distance.
 *
 * This is the >12-stop path: Optimization v1 refuses more than 12 coordinates,
 * and a courier round of 20 customers is ordinary. Crow-flight ordering is not
 * as good as a road-aware solver, but for stops within one city it puts them in
 * a sane sequence, and the DISTANCE the user is shown still comes from
 * Directions driving on the real road network — only the order is approximated.
 *
 * `fixedStart` keeps index 0 first (the depot / the agent's current position).
 */
function orderLocally(points: LngLat[], fixedStart: boolean): number[] {
  const n = points.length
  const order: number[] = []
  const unvisited = new Set<number>()
  for (let i = 0; i < n; i++) unvisited.add(i)

  let current = 0
  if (!fixedStart) {
    // Start from whichever point is most peripheral, so the round does not
    // begin in the middle and double back over itself.
    let best = 0
    let bestSum = -1
    for (let i = 0; i < n; i++) {
      let sum = 0
      for (let j = 0; j < n; j++) sum += haversineM(points[i], points[j])
      if (sum > bestSum) {
        bestSum = sum
        best = i
      }
    }
    current = best
  }
  order.push(current)
  unvisited.delete(current)

  while (unvisited.size > 0) {
    let nearest = -1
    let nearestDistance = Infinity
    for (const candidate of unvisited) {
      const distance = haversineM(points[current], points[candidate])
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = candidate
      }
    }
    order.push(nearest)
    unvisited.delete(nearest)
    current = nearest
  }

  // 2-opt: repeatedly un-cross any two edges that cross. Bounded by a pass
  // count so a large route cannot spin — n is at most a few hundred stops.
  const firstMovable = fixedStart ? 1 : 0
  for (let pass = 0; pass < 40; pass++) {
    let improved = false
    for (let i = firstMovable; i < order.length - 2; i++) {
      for (let k = i + 1; k < order.length - 1; k++) {
        const before = pathLength(points, order)
        const candidate = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)]
        if (pathLength(points, candidate) < before - 1) {
          order.splice(0, order.length, ...candidate)
          improved = true
        }
      }
    }
    if (!improved) break
  }

  return order
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
