import type { LngLat } from '@/lib/mapbox'

/**
 * Ordering stops without Mapbox: nearest-neighbour then 2-opt on straight-line distance,
 * for rounds longer than the Optimization API accepts.
 */

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
export function orderLocally(points: LngLat[], fixedStart: boolean): number[] {
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
