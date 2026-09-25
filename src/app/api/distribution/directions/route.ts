import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { canDo } from '@/lib/permissions-server'
import {
  MapboxError,
  getRouteGeometry,
  mapboxConfigured,
  optimizeStops,
  type LngLat,
} from '@/lib/mapbox'

/**
 * An ad-hoc round: "plan me a way through these points, starting where I am".
 *
 * Unlike /routes/[id]/optimize this stores NOTHING — it answers a line to draw
 * on the customers map for a salesperson planning their day out of whichever
 * pins are currently on screen. Nothing it returns identifies a customer; the
 * caller already has the names and matches them back by index.
 *
 * Gated on `customers.view`, because the coordinates being routed are customer
 * addresses and that is the permission that decides who may see those.
 *
 * Output: { ok: true, order, geometry, distanceM, durationS, solver }
 *         { ok: false, code }
 */

const pointSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
})

const bodySchema = z.object({
  // Capped well under what a day's round could be. Each request is metered, and
  // an uncapped list would let one click fan out into many chunked Directions
  // calls (src/lib/mapbox.ts splits at 25).
  points: z.array(pointSchema).min(2).max(60),
  /** false = draw the points in the order given, don't re-order them. */
  optimize: z.boolean().optional(),
  fixedStart: z.boolean().optional(),
  roundTrip: z.boolean().optional(),
  profile: z.enum(['driving', 'driving-traffic', 'cycling', 'walking']).optional(),
})

export async function POST(request: NextRequest) {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 })

  if (!(await canDo('customers', 'view'))) {
    return NextResponse.json({ ok: false, code: 'forbidden' }, { status: 403 })
  }
  if (!mapboxConfigured()) {
    return NextResponse.json({ ok: false, code: 'mapbox_not_configured' }, { status: 503 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, code: 'invalid_input' }, { status: 400 })
  const { points, optimize = true, fixedStart = false, roundTrip = false, profile = 'driving' } = parsed.data

  const coords: LngLat[] = points
  try {
    if (!optimize) {
      const shape = await getRouteGeometry(roundTrip ? [...coords, coords[0]] : coords, profile)
      return NextResponse.json({
        ok: true,
        order: coords.map((_, index) => index),
        solver: 'none',
        ...shape,
      })
    }
    const solved = await optimizeStops(coords, { fixedStart, roundTrip, profile })
    return NextResponse.json({
      ok: true,
      order: solved.order,
      solver: solved.solver,
      geometry: solved.geometry,
      distanceM: solved.distanceM,
      durationS: solved.durationS,
    })
  } catch (error) {
    if (error instanceof MapboxError) {
      const status = error.code === 'mapbox_rate_limited' ? 429 : error.code === 'mapbox_no_route' ? 422 : 502
      return NextResponse.json({ ok: false, code: error.code }, { status })
    }
    throw error
  }
}
