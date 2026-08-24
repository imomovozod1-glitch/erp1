import { z } from 'zod'

/**
 * Shared phone validation — the single source of truth for "is this a
 * plausible phone number", used everywhere a phone number is entered
 * (login, tenant provisioning, employee accounts, customers, suppliers,
 * profile). Bounds cover country code + national number for the countries
 * PhoneInput lists; the lower bound (7) rules out obviously-truncated
 * input without being so strict it rejects real short-format numbers.
 * Deliberately digit-count based rather than a per-country regex —
 * `PhoneInput` (src/components/ui/phone-input.tsx) already constrains
 * which country codes exist, so this only needs to catch "too few/too
 * many digits", not re-validate country-specific formats.
 */
const MIN_PHONE_DIGITS = 7
const MAX_PHONE_DIGITS = 12

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS
}

/** Required phone field. */
export function phoneSchema(message: string) {
  return z.string().refine(isValidPhone, message)
}

/** Optional phone field — empty is fine, but a non-empty value must still be a plausible number. */
export function optionalPhoneSchema(message: string) {
  return z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || v.trim() === '' || isValidPhone(v), message)
}
