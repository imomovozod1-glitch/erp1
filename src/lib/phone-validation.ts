import { z } from 'zod'
import {
  DEFAULT_PHONE_COUNTRY,
  isValidNationalLength,
  matchDialCodes,
} from '@/lib/phone-countries'

/**
 * Shared phone validation — the single source of truth for "is this a real
 * phone number", used everywhere a number is entered (login, tenant
 * provisioning, employee accounts, customers, suppliers, profile).
 *
 * The digit count is checked against the *selected country's* national length
 * (src/lib/phone-countries.ts), not against a loose global range: an Uzbek
 * number is exactly 9 digits after +998, so "+998 90 123 45 67 890" must be
 * rejected instead of quietly stored. `PhoneInput` stops the extra digits from
 * being typed in the first place; this catches pasted values, legacy rows and
 * anything posted straight to an API route.
 */
export function isValidPhone(phone: string): boolean {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return false

  for (const country of matchDialCodes(digits)) {
    if (isValidNationalLength(country, digits.length - country.dialCode.length)) return true
  }

  // Only a value without a leading "+" may be a bare national number (legacy
  // rows predating the country selector); it is measured against the default
  // country. Once a "+" is present the dial code above is the only authority,
  // so a half-typed "+7 701 234 56" cannot pass as a 9-digit Uzbek number.
  if (phone.trim().startsWith('+')) return false
  return isValidNationalLength(DEFAULT_PHONE_COUNTRY, digits.length)
}

/** Required phone field. */
export function phoneSchema(message: string) {
  return z.string().refine(isValidPhone, message)
}

/** Optional phone field — empty is fine, but a non-empty value must still be a real number. */
export function optionalPhoneSchema(message: string) {
  return z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || v.trim() === '' || isValidPhone(v), message)
}
