/**
 * Cookie name for the admin panel's language switcher. Lives in its own
 * file (not src/i18n/request.ts) because that file imports `next/headers`
 * (server-only) — importing it from the client-side locale switcher would
 * pull that dependency into the browser bundle.
 */
export const ADMIN_LOCALE_COOKIE = 'admin-locale'
