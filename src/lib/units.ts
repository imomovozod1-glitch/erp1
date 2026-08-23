/**
 * Fallback only — used if the `measurement_units` query fails (network
 * hiccup, migration not yet applied) so the unit dropdown is never
 * completely empty. The real, tenant-shared source of truth is the
 * `measurement_units` table (see supabase/migration_measurement_units.sql),
 * seeded with these same 4 defaults for every tenant. Never read directly;
 * always go through `getMeasurementUnits`.
 */
const FALLBACK_UNITS = ['Dona', 'Kilogram', 'Litr', 'Metr']

/**
 * The system's configured measurement units — the same list shown in the
 * product form's unit dropdown, tenant-editable via Settings → Units.
 * Backed by the `measurement_units` table (RLS-scoped to the caller's own
 * tenant, so no explicit tenant_id filter is needed here — same pattern as
 * every other tenant-scoped read in this app) rather than localStorage, so
 * every user on the tenant sees the same list regardless of browser/device.
 */
export async function getMeasurementUnits(supabase: any): Promise<string[]> {
  const { data, error } = await supabase
    .from('measurement_units')
    .select('name')
    .order('name', { ascending: true })

  if (error || !data || data.length === 0) return FALLBACK_UNITS
  return data.map((u: any) => u.name)
}

/** Case/whitespace-insensitive match of a raw unit string against the system's configured units. Returns the canonical (correctly-cased) unit, or null if it doesn't match any. */
export function resolveMeasurementUnit(rawUnit: string, systemUnits: string[]): string | null {
  const normalized = rawUnit.trim().toLowerCase()
  return systemUnits.find((u) => u.trim().toLowerCase() === normalized) ?? null
}
