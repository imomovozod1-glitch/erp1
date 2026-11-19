'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { retryAfterMinutes } from '@/lib/login-lock'
import { resolveWebApp, telegramLocale, tenantAppUrl, type TelegramLocale } from './telegram-webapp'

export type Stage = 'checking' | 'link' | 'redirecting' | 'unavailable' | 'error'
export type ErrorKey = 'notConfigured' | 'signatureInvalid' | 'tenantInactive' | 'serverUnreachable'

const MIN_PASSWORD = 6
const SIGNATURE_ERRORS = ['missing', 'malformed', 'bad_signature', 'expired']

/** API error code → `telegram.*` key; a bad signature reads the same as on the first screen. */
const LINK_ERRORS: Record<string, string> = {
  invalid_credentials: 'invalidCredentials',
  already_linked: 'alreadyLinked',
  no_tenant: 'noTenant',
  tenant_blocked: 'tenantInactive',
  invalid_input: 'fillPhonePassword',
  no_bot_token: 'notConfigured',
  ...Object.fromEntries(SIGNATURE_ERRORS.map((code) => [code, 'signatureInvalid'])),
}

const postJson = async (url: string, body: unknown) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { ok: res.ok, json: await res.json().catch(() => ({})) }
}

/**
 * Verify the Telegram signature; a linked account goes straight into its company, an unlinked
 * one signs in once with phone + password — the signature proves the Telegram user, never
 * which ERP account is theirs.
 */
export function useTelegramEntry(onLocale: (locale: TelegramLocale) => void) {
  const t = useTranslations('telegram')
  const [stage, setStage] = useState<Stage>('checking')
  const [error, setError] = useState<ErrorKey | null>(null)
  const [telegramName, setTelegramName] = useState<string | null>(null)
  const [initData, setInitData] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fail = (key: ErrorKey) => {
    setStage('error')
    setError(key)
  }

  // A one-time handoff URL (only /link produces one) is followed as-is; otherwise the tenant's host.
  const goToApp = useCallback((subdomain: string | null, handoffUrl?: string | null) => {
    setStage('redirecting')
    window.location.replace(handoffUrl || tenantAppUrl(subdomain))
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const webApp = await resolveWebApp()
      if (cancelled) return
      if (!webApp?.initData) return setStage('unavailable')
      const locale = telegramLocale(webApp.initDataUnsafe?.user?.language_code)
      onLocale(locale)
      document.documentElement.lang = locale
      webApp.ready()
      webApp.expand()
      if (webApp.colorScheme === 'dark') document.documentElement.classList.add('dark')
      setInitData(webApp.initData)
      try {
        const { ok, json } = await postJson('/api/telegram/session', { initData: webApp.initData })
        if (!ok) return fail(json.error === 'no_bot_token' ? 'notConfigured' : 'signatureInvalid')
        if (json.linked && json.tenantStatus && json.tenantStatus !== 'active') return fail('tenantInactive')
        if (json.linked) return goToApp(json.subdomain)
        setTelegramName(json.telegramName ?? null)
        setStage('link')
      } catch {
        fail('serverUnreachable')
      }
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [goToApp, onLocale])

  const link = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!phone.trim() || password.length < MIN_PASSWORD) return void toast.error(t('fillPhonePassword'))
    setSubmitting(true)
    try {
      const { ok, json } = await postJson('/api/telegram/link', { initData, phone, password })
      if (ok) return goToApp(json.subdomain, json.url)
      if (json.error === 'too_many_attempts') return void toast.error(t('tooManyAttempts', { minutes: retryAfterMinutes(json.retryAfterSeconds) }))
      toast.error(t(LINK_ERRORS[json.error] ?? 'genericError'))
    } catch {
      toast.error(t('serverUnreachable'))
    } finally {
      setSubmitting(false)
    }
  }

  return { stage, error, telegramName, phone, setPhone, password, setPassword, submitting, link }
}

export type TelegramEntryState = ReturnType<typeof useTelegramEntry>
