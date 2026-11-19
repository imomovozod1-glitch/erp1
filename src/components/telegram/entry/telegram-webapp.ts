interface TelegramWebApp {
  initData: string
  initDataUnsafe?: { user?: { language_code?: string } }
  colorScheme?: 'light' | 'dark'
  themeParams?: Record<string, string>
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export type TelegramLocale = 'uz' | 'ru' | 'en'

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js'
const POLL_MS = 100

/** The language set in Telegram (an IETF tag such as "en-US"); anything not shipped falls back to Uzbek. */
export function telegramLocale(languageCode: string | undefined): TelegramLocale {
  const base = languageCode?.toLowerCase().split('-')[0]
  return base === 'ru' || base === 'en' || base === 'uz' ? base : 'uz'
}

/**
 * Waits for the WebApp object instead of judging on the first tick — a slow SDK looked
 * exactly like a plain browser — and injects the script once if it never loaded. Null
 * only means the SDK genuinely never appeared, or the page has no Mini App context
 * (`initData` is empty when opened from a plain `url` button).
 */
export async function resolveWebApp(timeoutMs = 4000): Promise<TelegramWebApp | null> {
  const start = Date.now()
  let injected = false
  while (Date.now() - start < timeoutMs) {
    const webApp = window.Telegram?.WebApp
    if (webApp?.initData) return webApp
    if (!injected && !document.querySelector(`script[src="${SDK_URL}"]`)) {
      injected = true
      const script = Object.assign(document.createElement('script'), { src: SDK_URL, async: false })
      document.head.appendChild(script)
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  return window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : null
}

/**
 * The tenant's own host: tenants hang off the APEX while the Mini App is served from www,
 * so only a leading "www." is stripped — right on the apex, on www and on tenant.localhost.
 */
export function tenantAppUrl(subdomain: string | null) {
  if (!subdomain) return '/uz/dashboard'
  return `${window.location.protocol}//${subdomain}.${window.location.host.replace(/^www\./, '')}/uz/dashboard`
}
