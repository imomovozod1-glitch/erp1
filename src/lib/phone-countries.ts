/**
 * The country table behind `PhoneInput` (src/components/ui/phone-input.tsx)
 * and `isValidPhone` (src/lib/phone-validation.ts). It lives in `lib/` rather
 * than next to the component so server code (API route schemas) can validate
 * against exactly the same rules the input enforces while typing.
 *
 * Countries relevant to this app's Central Asia + neighbors user base
 * (see AGENTS.md — uz/ru/en locales, Uzbekistan-focused tenant base), plus a
 * handful of common international ones. Listed in a natural dropdown order;
 * dial-code lookup sorts by code length at call time.
 */
export interface PhoneCountry {
  iso: string
  name: string
  dialCode: string
  flag: string
  /** Allowed digit count of the national part (after the dial code), inclusive. */
  nationalLength: [min: number, max: number]
  /** Display grouping of the national part, e.g. [2, 3, 2, 2] → "90 123 45 67". */
  groups: number[]
  /** Placeholder / hint for a well-formed national number. */
  example: string
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'UZ', name: "O'zbekiston", dialCode: '998', flag: '🇺🇿', nationalLength: [9, 9], groups: [2, 3, 2, 2], example: '90 123 45 67' },
  { iso: 'RU', name: 'Rossiya', dialCode: '7', flag: '🇷🇺', nationalLength: [10, 10], groups: [3, 3, 2, 2], example: '912 345 67 89' },
  { iso: 'KZ', name: "Qozog'iston", dialCode: '7', flag: '🇰🇿', nationalLength: [10, 10], groups: [3, 3, 2, 2], example: '701 234 56 78' },
  { iso: 'KG', name: "Qirg'iziston", dialCode: '996', flag: '🇰🇬', nationalLength: [9, 9], groups: [3, 3, 3], example: '555 123 456' },
  { iso: 'TJ', name: 'Tojikiston', dialCode: '992', flag: '🇹🇯', nationalLength: [9, 9], groups: [2, 3, 4], example: '92 123 4567' },
  { iso: 'TM', name: 'Turkmaniston', dialCode: '993', flag: '🇹🇲', nationalLength: [8, 8], groups: [2, 6], example: '65 123456' },
  { iso: 'AZ', name: 'Ozarbayjon', dialCode: '994', flag: '🇦🇿', nationalLength: [9, 9], groups: [2, 3, 2, 2], example: '50 123 45 67' },
  { iso: 'TR', name: 'Turkiya', dialCode: '90', flag: '🇹🇷', nationalLength: [10, 10], groups: [3, 3, 2, 2], example: '532 123 45 67' },
  { iso: 'AE', name: 'BAA', dialCode: '971', flag: '🇦🇪', nationalLength: [8, 9], groups: [2, 3, 4], example: '50 123 4567' },
  { iso: 'US', name: 'AQSH', dialCode: '1', flag: '🇺🇸', nationalLength: [10, 10], groups: [3, 3, 4], example: '201 555 0123' },
  { iso: 'GB', name: 'Buyuk Britaniya', dialCode: '44', flag: '🇬🇧', nationalLength: [9, 10], groups: [4, 6], example: '7911 123456' },
  { iso: 'DE', name: 'Germaniya', dialCode: '49', flag: '🇩🇪', nationalLength: [6, 11], groups: [3, 4, 4], example: '151 2345678' },
  { iso: 'CN', name: 'Xitoy', dialCode: '86', flag: '🇨🇳', nationalLength: [11, 11], groups: [3, 4, 4], example: '131 2345 6789' },
  { iso: 'IN', name: 'Hindiston', dialCode: '91', flag: '🇮🇳', nationalLength: [10, 10], groups: [5, 5], example: '98765 43210' },
]

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0]

/** Longest dial code first, so `+998…` never matches as `+9…`. */
const BY_LONGEST_DIAL_CODE = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)

export function findPhoneCountry(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_PHONE_COUNTRY
}

/** Every country whose dial code prefixes these digits, longest code first. */
export function matchDialCodes(digits: string): PhoneCountry[] {
  return BY_LONGEST_DIAL_CODE.filter((c) => digits.startsWith(c.dialCode))
}

export function isValidNationalLength(country: PhoneCountry, length: number): boolean {
  const [min, max] = country.nationalLength
  return length >= min && length <= max
}

/** Splits a national number into the country's display groups, e.g. "901234567" → "90 123 45 67". */
export function groupNationalDigits(country: PhoneCountry, digits: string): string {
  const parts: string[] = []
  let offset = 0
  for (const size of country.groups) {
    if (offset >= digits.length) break
    parts.push(digits.slice(offset, offset + size))
    offset += size
  }
  // Anything past the last group (only reachable for pre-existing malformed
  // data — typing is capped at the country's max) is kept visible so the user
  // can see and fix it rather than silently losing digits.
  if (offset < digits.length) parts.push(digits.slice(offset))
  return parts.join(' ')
}

/**
 * Splits a full `+{dialCode}{national}` string into its country and national
 * part. Falls back to the default country with the whole thing as the national
 * number for legacy rows that were saved without a country code.
 */
export function splitPhone(fullValue: string): { country: PhoneCountry; national: string } {
  const raw = fullValue || ''
  const digits = raw.replace(/\D/g, '')
  for (const c of matchDialCodes(digits)) {
    const national = digits.slice(c.dialCode.length)
    // Prefer a country the remaining digits actually fit, so "+7 701 …" is not
    // mistaken for a malformed UZ number and vice versa.
    if (isValidNationalLength(c, national.length)) return { country: c, national }
  }
  // Without a leading "+" the value is a bare national number — legacy rows
  // saved before the country selector existed. With one, the dial code is
  // authoritative even if the rest is malformed, so we never re-badge a
  // half-typed "+7 …" as an Uzbek number.
  if (!raw.trim().startsWith('+')) return { country: DEFAULT_PHONE_COUNTRY, national: digits }
  const first = matchDialCodes(digits)[0]
  if (first) return { country: first, national: digits.slice(first.dialCode.length) }
  return { country: DEFAULT_PHONE_COUNTRY, national: digits }
}
