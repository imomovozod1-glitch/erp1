'use client'

import { useState } from 'react'
import { Loader2, LogIn, ShieldCheck, TriangleAlert } from 'lucide-react'
import { NextIntlClientProvider, useTranslations, type AbstractIntlMessages } from 'next-intl'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { PhoneInput } from '@/components/ui/phone-input'
import { LabeledField } from '@/components/shared/labeled-field'
import type { TelegramLocale } from '@/components/telegram/entry/telegram-webapp'
import { useTelegramEntry, type TelegramEntryState } from '@/components/telegram/entry/use-telegram-entry'

export type { TelegramLocale } from '@/components/telegram/entry/telegram-webapp'

function Waiting({ redirecting }: { redirecting: boolean }) {
  const t = useTranslations('telegram')
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
      <Loader2 className="size-7 animate-spin text-violet-600" />
      <p className="text-sm">{t(redirecting ? 'opening' : 'checking')}</p>
    </div>
  )
}

// The two real causes, in the order they happen: a plain browser tab, or a bot button of the wrong type.
function NotInTelegram() {
  const t = useTranslations('telegram')
  const code = (chunks: React.ReactNode) => <code>{chunks}</code>
  return (
    <>
      <p>{t('worksAsMiniApp')}</p>
      <ul className="space-y-1.5 text-left text-xs">
        <li>• {t('hintBrowser')}</li>
        <li>• {t.rich('hintWebAppButton', { b: (chunks) => <b>{chunks}</b>, code })}</li>
        <li>• {t.rich('hintBotFather', { code })}</li>
      </ul>
    </>
  )
}

function Problem({ state }: { state: TelegramEntryState }) {
  const t = useTranslations('telegram')
  const unavailable = state.stage === 'unavailable'
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert className="size-9 text-amber-500" />
      <h1 className="text-base font-semibold text-foreground">{t(unavailable ? 'openInTelegram' : 'errorTitle')}</h1>
      <div className="max-w-sm space-y-3 text-sm text-muted-foreground">{unavailable ? <NotInTelegram /> : <p>{t(state.error ?? 'genericError')}</p>}</div>
    </div>
  )
}

function LinkForm({ state }: { state: TelegramEntryState }) {
  const t = useTranslations('telegram')
  return (
    <div className="flex min-h-dvh flex-col justify-center p-6">
      <div className="mx-auto w-full max-w-sm space-y-5">
        <div className="space-y-1.5 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-violet-600 text-white">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-lg font-bold text-foreground">{state.telegramName ? t('greeting', { name: state.telegramName }) : t('linkAccount')}</h1>
          <p className="text-sm text-muted-foreground">{t('linkDescription')}</p>
        </div>
        <form onSubmit={state.link} className="space-y-4">
          <LabeledField id="tg-phone" label={t('phone')}>
            <PhoneInput id="tg-phone" value={state.phone} onChange={state.setPhone} placeholder="90 123 45 67" />
          </LabeledField>
          <LabeledField id="tg-password" label={t('password')}>
            <PasswordInput id="tg-password" value={state.password} onChange={(e) => state.setPassword(e.target.value)} placeholder="••••••••" showLabel={t('showPassword')} hideLabel={t('hidePassword')} />
          </LabeledField>
          <Button type="submit" className="w-full" disabled={state.submitting}>
            {state.submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}
            {t('linkAndSignIn')}
          </Button>
        </form>
      </div>
    </div>
  )
}

function TelegramEntryScreen({ onLocale }: { onLocale: (locale: TelegramLocale) => void }) {
  const state = useTelegramEntry(onLocale)
  if (state.stage === 'checking' || state.stage === 'redirecting') return <Waiting redirecting={state.stage === 'redirecting'} />
  if (state.stage === 'unavailable' || state.stage === 'error') return <Problem state={state} />
  return <LinkForm state={state} />
}

/**
 * The Telegram Mini App entry. The layout hands over the small `telegram` namespace for all
 * three locales, because the language is only known once the Telegram SDK has loaded.
 */
export function TelegramEntry({ messages }: { messages: Record<TelegramLocale, AbstractIntlMessages> }) {
  const [locale, setLocale] = useState<TelegramLocale>('uz')
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="Asia/Tashkent">
      <TelegramEntryScreen onLocale={setLocale} />
    </NextIntlClientProvider>
  )
}
