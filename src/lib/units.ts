const DEFAULT_UNITS: Record<string, string[]> = {
  uz: ['Dona', 'Litr', 'Metr', 'Kg'],
  ru: ['Шт', 'Литр', 'Метр', 'Кг'],
  en: ['Pcs', 'Liter', 'Meter', 'Kg'],
}

/**
 * The system's configured measurement units — the same list shown in the
 * product form's unit dropdown (tenant-editable via Settings → Units,
 * persisted in localStorage under 'measurement_units'). Ships with 4
 * defaults (piece/liter/meter/kg) so the dropdown isn't empty out of the
 * box; anything beyond that only ever appears once the tenant actually adds
 * it via Settings → Units (see units-list.tsx, which seeds this same list).
 */
export function getMeasurementUnits(lang: string): string[] {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('measurement_units')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // malformed localStorage value — fall through to defaults
    }
  }
  return DEFAULT_UNITS[lang] || DEFAULT_UNITS.en
}

/** Case/whitespace-insensitive match of a raw unit string against the system's configured units. Returns the canonical (correctly-cased) unit, or null if it doesn't match any. */
export function resolveMeasurementUnit(rawUnit: string, systemUnits: string[]): string | null {
  const normalized = rawUnit.trim().toLowerCase()
  return systemUnits.find((u) => u.trim().toLowerCase() === normalized) ?? null
}
