import { groupNationalDigits, splitPhone } from '@/lib/phone-countries'

/**
 * Synthetic email convention for tenant phone-based login.
 *
 * Supabase Auth's password grant needs an email; rather than configuring
 * real SMS/OTP phone auth, tenant login converts the phone number to a
 * syntactically-valid but non-deliverable email internally. Provisioning
 * (super-admin "create tenant", src/app/api/admin/tenants/route.ts) must
 * create the `auth.users` row with this exact same email so login matches.
 */
/**
 * Subdomains that can never belong to a tenant — "admin" is rewritten by
 * src/proxy.ts to the super-admin console (src/app/admin/**), so a tenant
 * claiming it would either break that routing or spoof it. Enforced at
 * provisioning and edit time (src/app/api/admin/tenants/**).
 */
export const RESERVED_SUBDOMAINS = ['admin', 'www', 'api', 'app', 'support']

export function isReservedSubdomain(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())
}

export function phoneToSyntheticEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@tenant.local`
}

/**
 * Display formatter for a stored phone number: `+998 90 123 45 67`. Grouping
 * comes from the same country table `PhoneInput` and `isValidPhone` use
 * (src/lib/phone-countries.ts), so a Russian or Turkish number is not forced
 * into the Uzbek 3-2-3-2-2 shape. Unrecognised input is returned as plain
 * digits rather than silently truncated.
 */
export function formatPhoneInput(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 0) return ''

  const { country, national } = splitPhone(raw)
  if (!national) return `+${digits}`
  return `+${country.dialCode} ${groupNationalDigits(country, national)}`.trimEnd()
}
