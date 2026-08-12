const DEFAULT_UNITS: Record<string, string[]> = {
  uz: ['Dona', 'Kg', 'Litr', 'Metr', 'Qop', 'Tonna'],
  ru: ['Шт', 'Кг', 'Литр', 'Метр', 'Мешок', 'Тонна'],
  en: ['Pcs', 'Kg', 'Liter', 'Meter', 'Bag', 'Ton'],
}

/**
 * The system's configured measurement units — the same list shown in the
 * product form's unit dropdown (admin-editable, persisted in localStorage
 * under 'measurement_units'). Falls back to a sensible per-language default
 * when nothing has been customized yet.
 */
export function getMeasurementUnits(lang: string): string[] {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('measurement_units')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
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
