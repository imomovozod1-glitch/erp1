/**
 * The system's configured measurement units — the same list shown in the
 * product form's unit dropdown (tenant-editable via Settings → Units,
 * persisted in localStorage under 'measurement_units'). Returns an empty
 * list until the tenant has actually created at least one unit — no
 * hardcoded defaults are silently shown as if they already existed.
 */
export function getMeasurementUnits(_lang: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem('measurement_units')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // malformed localStorage value — fall through to empty
  }
  return []
}

/** Case/whitespace-insensitive match of a raw unit string against the system's configured units. Returns the canonical (correctly-cased) unit, or null if it doesn't match any. */
export function resolveMeasurementUnit(rawUnit: string, systemUnits: string[]): string | null {
  const normalized = rawUnit.trim().toLowerCase()
  return systemUnits.find((u) => u.trim().toLowerCase() === normalized) ?? null
}
