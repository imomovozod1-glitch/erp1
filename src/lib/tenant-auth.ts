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
 * Subdomains that can never belong to a tenant — "admin" and "support" are
 * rewritten by src/proxy.ts to the super-admin console (src/app/admin/**)
 * and the support-agent portal (src/app/support/**), so a tenant claiming
 * either would break that routing or spoof it. Enforced at provisioning and
 * edit time (src/app/api/admin/tenants/**).
 */
export const RESERVED_SUBDOMAINS = ['admin', 'www', 'api', 'app', 'support']

export function isReservedSubdomain(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())
}

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * The GLOBAL login for a phone: a tenant OWNER (the login of the tenant's own
 * phone), a support agent, and members created before tenant-scoped logins.
 */
export function phoneToSyntheticEmail(phone: string): string {
  return `${phoneDigits(phone)}@tenant.local`
}

/**
 * A tenant MEMBER's login: the same phone, scoped to the company
 * (`{digits}@{tenantId}.tenant.local`). Auth emails are unique platform-wide,
 * so with one global address per phone a cashier in one company held the
 * number another company was then registered with, and that company could
 * never get an owner login. Scoped, a member's phone may equal any other
 * company's phone — or their own company's — without the two colliding;
 * within one company it still has to be unique. See src/lib/phone-login.ts
 * for how a sign-in finds the right one.
 */
export function memberLoginEmail(phone: string, tenantId: string): string {
  return `${phoneDigits(phone)}@${tenantId}.tenant.local`
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
