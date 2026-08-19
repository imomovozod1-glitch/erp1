/**
 * Synthetic email convention for tenant phone-based login.
 *
 * Supabase Auth's password grant needs an email; rather than configuring
 * real SMS/OTP phone auth, tenant login converts the phone number to a
 * syntactically-valid but non-deliverable email internally. Provisioning
 * (super-admin "create tenant", src/app/api/admin/tenants/route.ts) must
 * create the `auth.users` row with this exact same email so login matches.
 */
export function phoneToSyntheticEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@tenant.local`
}

/**
 * Formats a phone number as the user types it: `+998 90 123 45 67`.
 * Assumes an Uzbek-style 12-digit number (998 + 9 digits) — this app's
 * tenant base is Uzbekistan-focused (see i18n locales: uz/ru/en). Digits
 * beyond that length are preserved but left unformatted, so pasting a
 * longer international number never silently truncates data.
 */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 15)
  if (digits.length === 0) return ''
  if (digits.length > 12) return `+${digits}`

  let out = `+${digits.slice(0, 3)}`
  if (digits.length > 3) out += ` ${digits.slice(3, 5)}`
  if (digits.length > 5) out += ` ${digits.slice(5, 8)}`
  if (digits.length > 8) out += ` ${digits.slice(8, 10)}`
  if (digits.length > 10) out += ` ${digits.slice(10, 12)}`
  return out
}
