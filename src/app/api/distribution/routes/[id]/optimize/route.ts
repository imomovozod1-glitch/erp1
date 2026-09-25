import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { canDo, getDataScope } from '@/lib/permissions-server'
import { createClient } from '@/lib/supabase/server'
import { MapboxError, mapboxConfigured, optimizeStops, type LngLat } from '@/lib/mapbox'

/**
 * Solves one marshrut: puts its stops in driving order and stores the shape.
 *
 * Why an API route rather than the browser write the rest of the route form
 * uses — the Mapbox token is server-only. Keeping it here means api.mapbox.com
 * never has to be opened up in the CSP's connect-src and the token cannot be
 * read out of the client bundle.
 *
 * Reads and writes go through the CALLER's Supabase client, not the service
 * role, so tenant RLS still applies and a route belonging to another company
 * simply is not found. The RBAC matrix is checked on top of that, because RLS
 * scopes by tenant and not by role (see CLAUDE.md § Gotchas).
 *
 * Output: { ok: true, stops, distanceM, durationS, geometry, solver }
 *         { ok: false, code }
 */

const bodySchema = z.object({
  /**
   * Pin the first stop instead of letting the solver choose where the round
   * begins — for a round that leaves from the warehouse.
   */
  fixedStart: z.boolean().optional(),
  /** Finish back where it started. */
  roundTrip: z.boolean().optional(),
  profile: z.enum(['driving', 'driving-traffic', 'cycling', 'walking']).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 })

  if (!(await canDo('distribution', 'edit'))) {
    return NextResponse.json({ ok: false, code: 'forbidden' }, { status: 403 })
  }
  if (!mapboxConfigured()) {
    return NextResponse.json({ ok: false, code: 'mapbox_not_configured' }, { status: 503 })
  }

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, code: 'invalid_input' }, { status: 400 })
  const { fixedStart = false, roundTrip = false, profile = 'driving' } = parsed.data

  const supabase = (await createClient()) as any

  const { data: route } = await supabase
    .from('distribution_routes')
    .select('id, assigned_to')
    .eq('id', id)
    .maybeSingle()
  if (!route) return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404 })

  // An `own` data scope means the agent may only re-plan their OWN round.
  if ((await getDataScope('distribution')) === 'own' && route.assigned_to !== ctx.userId) {
    return NextResponse.json({ ok: false, code: 'forbidden' }, { status: 403 })
  }

  const { data: stops } = await supabase
    .from('distribution_route_stops')
    .select('id, customer_id, position, customer:customers(id, name, latitude, longitude)')
    .eq('route_id', id)
    .order('position', { ascending: true })

  const all = (stops ?? []) as any[]
  // A stop whose customer has no pin cannot be routed. It is not an error —
  // it keeps its place at the end of the list, and the UI says how many.
  const located = all.filter(
    (s) => typeof s.customer?.latitude === 'number' && typeof s.customer?.longitude === 'number'
  )
  const unlocated = all.filter((s) => !located.includes(s))

  if (located.length < 2) {
    return NextResponse.json({ ok: false, code: 'too_few_located_stops' }, { status: 400 })
  }

  const points: LngLat[] = located.map((s) => ({
    lng: s.customer.longitude as number,
    lat: s.customer.latitude as number,
  }))

  let solved
  try {
    solved = await optimizeStops(points, { fixedStart, roundTrip, profile })
  } catch (error) {
    if (error instanceof MapboxError) {
      const status = error.code === 'mapbox_rate_limited' ? 429 : error.code === 'mapbox_no_route' ? 422 : 502
      return NextResponse.json({ ok: false, code: error.code }, { status })
    }
    throw error
  }

  // Positions first, geometry second — never the other way round. Writing a
  // stop fires distribution_route_stops_clear_geometry (migration_route_geometry.sql),
  // which blanks the shape; doing the geometry first would have it wiped by the
  // very writes it describes.
  const ordered = solved.order.map((index) => located[index])
  for (let i = 0; i < ordered.length; i++) {
    const { error } = await supabase
      .from('distribution_route_stops')
      .update({ position: i + 1 })
      .eq('id', ordered[i].id)
    if (error) return NextResponse.json({ ok: false, code: 'save_failed' }, { status: 500 })
  }
  // Stops with no coordinates keep their relative order, after the routed ones.
  for (let i = 0; i < unlocated.length; i++) {
    await supabase
      .from('distribution_route_stops')
      .update({ position: ordered.length + i + 1 })
      .eq('id', unlocated[i].id)
  }

  const { error: routeError } = await supabase
    .from('distribution_routes')
    .update({
      geometry: solved.geometry,
      distance_m: solved.distanceM,
      duration_s: solved.durationS,
      optimized_at: new Date().toISOString(),
      optimized_by: solved.solver,
    })
    .eq('id', id)
  if (routeError) return NextResponse.json({ ok: false, code: 'save_failed' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    solver: solved.solver,
    distanceM: solved.distanceM,
    durationS: solved.durationS,
    geometry: solved.geometry,
    unlocatedCount: unlocated.length,
    stops: ordered.map((s, index) => ({
      id: s.id,
      customerId: s.customer_id,
      name: s.customer?.name ?? '',
      position: index + 1,
    })),
  })
}
