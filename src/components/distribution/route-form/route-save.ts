import type { RouteData, RoutePlan, Stop } from './route-model'

interface RouteSave {
  initial: any
  data: RouteData
  stops: Stop[]
  plan: RoutePlan | null
  assignedTo: string | null
}

const ok = ({ error }: { error: unknown }) => {
  if (error) throw error
}

async function writeHeader(supabase: any, initial: any, payload: Record<string, unknown>) {
  if (!initial?.id) {
    const { data, error } = await supabase.from('distribution_routes').insert([payload]).select('id').single()
    if (error) throw error
    return data.id as string
  }
  ok(await supabase.from('distribution_routes').update(payload).eq('id', initial.id))
  ok(await supabase.from('distribution_route_stops').delete().eq('route_id', initial.id))
  return initial.id as string
}

// Written AFTER the stops: inserting them fires a trigger that blanks the geometry.
// A failure here only loses the picture, so it is logged rather than failing the save.
async function writeGeometry(supabase: any, routeId: string, plan: RoutePlan) {
  const { error } = await supabase
    .from('distribution_routes')
    .update({
      geometry: plan.geometry,
      distance_m: plan.distanceM,
      duration_s: plan.durationS,
      optimized_at: new Date().toISOString(),
      optimized_by: plan.solver === 'none' ? 'local' : plan.solver,
    })
    .eq('id', routeId)
  if (error) console.error('Route geometry not saved', error)
}

/** Nothing here moves stock or money; stops are replaced wholesale, so a half-failed save is visible and re-savable. */
export async function saveRoute(supabase: any, { initial, data, stops, plan, assignedTo }: RouteSave) {
  const { data: auth } = await supabase.auth.getUser()
  const userId: string | null = auth?.user?.id ?? null
  const routeId = await writeHeader(supabase, initial, {
    name: data.name.trim(),
    agent_id: data.agent_id || null,
    weekday: data.weekday ? Number(data.weekday) : null,
    notes: data.notes || null,
    is_active: data.is_active,
    assigned_to: assignedTo ?? initial?.assigned_to ?? userId,
    created_by: initial?.created_by ?? userId,
  })
  ok(await supabase.from('distribution_route_stops').insert(stops.map((s, index) => ({ route_id: routeId, customer_id: s.customerId, position: index + 1 }))))
  if (plan) await writeGeometry(supabase, routeId, plan)
}
