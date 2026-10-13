import type { Metadata } from 'next'
import type { AbstractIntlMessages } from 'next-intl'
import { TelegramEntry, type TelegramLocale } from '@/components/telegram/telegram-entry'

export const metadata: Metadata = { title: 'Falco ERP' }
export const dynamic = 'force-dynamic'

/**
 * Only the `telegram` namespace, for all three locales: the screen picks one
 * from the user's Telegram language once the SDK has loaded in the browser
 * (see TelegramEntry), so the server cannot choose it up front.
 */
async function loadTelegramMessages(locale: TelegramLocale) {
  const messages = (await import(`../../../messages/${locale}.json`)).default as Record<string, unknown>
  return { telegram: messages.telegram } as AbstractIntlMessages
}

export default async function TelegramMiniAppPage() {
  const [uz, ru, en] = await Promise.all([
    loadTelegramMessages('uz'),
    loadTelegramMessages('ru'),
    loadTelegramMessages('en'),
  ])
  return <TelegramEntry messages={{ uz, ru, en }} />
}
