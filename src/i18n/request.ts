import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-locale'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale

  // Validate locale
  if (!locale || !routing.locales.includes(locale as 'uz' | 'ru' | 'en')) {
    // requestLocale is only set by next-intl's middleware, which resolves it
    // from the [lang] URL segment. Routes that bypass that middleware
    // entirely (the /admin super-admin console — see src/proxy.ts) fall back
    // to a cookie set by their own language switcher instead.
    const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value
    locale = cookieLocale && routing.locales.includes(cookieLocale as 'uz' | 'ru' | 'en')
      ? cookieLocale
      : routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
