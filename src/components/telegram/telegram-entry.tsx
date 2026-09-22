'use client'

import { useCallback, useEffect, useState } from 'react'
import { retryAfterMinutes } from '@/lib/login-lock'
import { toast } from 'sonner'
import { Loader2, LogIn, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { PhoneInput } from '@/components/ui/phone-input'

/**
 * Telegram Mini App entry screen.
 *
 * Flow:
 *   1. Read `initData` from the Telegram WebView.
 *   2. POST it to /api/telegram/session, which verifies the signature.
 *   3. Already linked  -> redirect into that tenant's app.
 *      Not linked yet  -> ask for phone + password once, POST to
 *                         /api/telegram/link, which signs in AND records the
 *                         binding, then redirect.
 *
 * The password step exists precisely once per Telegram account: a valid
 * Telegram signature proves which Telegram user is calling, never which ERP
 * account is theirs.
 */

interface TelegramWebApp {
  initData: string
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

type Stage = 'checking' | 'link' | 'redirecting' | 'unavailable' | 'error'

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js'

/**
 * Resolves the Telegram WebApp object, waiting for it rather than giving up on
 * the first tick.
 *
 * The blocking <script> in the layout normally has it ready before this runs.
 * But concluding "not in Telegram" from a single synchronous check is what
 * produced a false "open me inside Telegram" for users who WERE inside
 * Telegram — any delay in the SDK (slow network, the previous next/script
 * queueing behaviour) looked identical to being in a plain browser. So: poll
 * briefly, and if the tag never loaded, inject it once and keep waiting.
 *
 * Resolves null only after the SDK genuinely failed to appear, which really
 * does mean this is not a Telegram WebView.
 */
async function resolveWebApp(timeoutMs = 4000): Promise<TelegramWebApp | null> {
  const start = Date.now()
  let injected = false

  while (Date.now() - start < timeoutMs) {
    const webApp = window.Telegram?.WebApp
    // `initData` is empty when the page is opened outside a Mini App context
    // (e.g. a plain `url` inline button), even though the SDK itself loaded.
    if (webApp?.initData) return webApp

    if (!injected && !document.querySelector(`script[src="${SDK_URL}"]`)) {
      injected = true
      const script = document.createElement('script')
      script.src = SDK_URL
      script.async = false
      document.head.appendChild(script)
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  return window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : null
}

export function TelegramEntry() {
  const [stage, setStage] = useState<Stage>('checking')
  const [message, setMessage] = useState<string | null>(null)
  const [telegramName, setTelegramName] = useState<string | null>(null)
  const [initData, setInitData] = useState('')

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const goToApp = useCallback((subdomain: string | null, handoffUrl?: string | null) => {
    // A handed-over session (src/lib/tenant-handoff.ts): the URL already
    // carries the one-time token that signs the user in on the company host,
    // so it is followed as-is. Only /link can produce one — it is the flow
    // that just proved a password.
    if (handoffUrl) {
      setStage('redirecting')
      window.location.replace(handoffUrl)
      return
    }

    setStage('redirecting')
    // The app is tenant-per-subdomain, so the Mini App has to jump to the
    // tenant's own host — a relative push would land on the marketing host
    // with no tenant context.
    // Tenants hang off the APEX (acme.falco.business), while the Mini App is
    // served from the site's own host — which is www.falco.business, since www
    // is the canonical host and the apex 308s to it. So the apex is this host
    // with a leading "www." taken off, and the tenant's host is the subdomain
    // in front of that. Two wrong ways to get here, both previously shipped:
    // stripping the FIRST label whatever it is turns "acme" into acme.business
    // on the apex, and using the host as-is turns it into acme.www.falco.business
    // on www. Stripping only "www." is right on the apex, on www and on
    // tenant.localhost alike.
    const apex = window.location.host.replace(/^www\./, '')
    const target = subdomain
      ? `${window.location.protocol}//${subdomain}.${apex}/uz/dashboard`
      : '/uz/dashboard'
    window.location.replace(target)
  }, [])

  useEffect(() => {
    let cancelled = false

    // Every setState below is deferred: calling one straight from an effect
    // body is a cascading render under the React Compiler rules
    // (react-hooks/set-state-in-effect).
    const timer = setTimeout(async () => {
      const webApp = await resolveWebApp()
      if (cancelled) return

      if (!webApp?.initData) {
        // Genuinely not a Telegram WebView (or opened via a plain `url`
        // button, which does not create a Mini App context).
        setStage('unavailable')
        return
      }

      webApp.ready()
      webApp.expand()
      if (webApp.colorScheme === 'dark') document.documentElement.classList.add('dark')

      setInitData(webApp.initData)
      try {
        const res = await fetch('/api/telegram/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: webApp.initData }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setStage('error')
          setMessage(
            json.error === 'no_bot_token'
              ? 'Mini App hali sozlanmagan (TELEGRAM_MINIAPP_BOT_TOKEN yo‘q).'
              : 'Telegram imzosi tekshiruvdan o‘tmadi.'
          )
          return
        }
        if (json.linked) {
          if (json.tenantStatus && json.tenantStatus !== 'active') {
            setStage('error')
            setMessage('Tashkilot hisobi faol emas. Administrator bilan bog‘laning.')
            return
          }
          goToApp(json.subdomain)
          return
        }
        setTelegramName(json.telegramName ?? null)
        setStage('link')
      } catch {
        setStage('error')
        setMessage('Serverga ulanib bo‘lmadi.')
      }
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [goToApp])

  const handleLink = async (e: React.SubmitEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!phone.trim() || password.length < 6) {
      toast.error('Telefon va parolni to‘ldiring')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, phone, password }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const messages: Record<string, string> = {
          invalid_credentials: 'Telefon yoki parol noto‘g‘ri',
          too_many_attempts: `Juda ko‘p muvaffaqiyatsiz urinish. ${retryAfterMinutes(json.retryAfterSeconds)} daqiqadan so‘ng qayta urinib ko‘ring.`,
          already_linked: 'Bu hisob boshqa Telegram akkauntiga bog‘langan',
          no_tenant: 'Hisobingiz hech qaysi tashkilotga biriktirilmagan',
          tenant_blocked: 'Tashkilot hisobi faol emas. Administrator bilan bog‘laning.',
        }
        toast.error(messages[json.error] ?? 'Xatolik yuz berdi')
        return
      }
      goToApp(json.subdomain, json.url)
    } catch {
      toast.error('Serverga ulanib bo‘lmadi')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (stage === 'checking' || stage === 'redirecting') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
        <p className="text-sm">{stage === 'redirecting' ? 'Ochilmoqda…' : 'Tekshirilmoqda…'}</p>
      </div>
    )
  }

  if (stage === 'unavailable' || stage === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <TriangleAlert className="h-9 w-9 text-amber-500" />
        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {stage === 'unavailable' ? 'Telegram ichida oching' : 'Xatolik'}
        </h1>
        <div className="max-w-sm space-y-3 text-sm text-muted-foreground">
          {stage === 'unavailable' ? (
            <>
              <p>Bu sahifa Telegram Mini App sifatida ishlaydi.</p>
              {/* The two things that actually cause this, in the order they
                  happen in practice — a plain browser tab, or a bot button of
                  the wrong type. A `url` button opens the system browser and
                  never creates a Mini App context, so initData stays empty. */}
              <ul className="space-y-1.5 text-left text-xs">
                <li>• Brauzerda emas, Telegram ichidan oching.</li>
                <li>
                  • Botdagi tugma <b>Web App</b> turida bo‘lishi kerak. Oddiy
                  havola (<code>url</code>) tugmasi brauzerni ochadi va Mini App
                  hisoblanmaydi.
                </li>
                <li>
                  • BotFather → <code>/newapp</code> orqali Mini App qo‘shilgan
                  bo‘lishi kerak.
                </li>
              </ul>
            </>
          ) : (
            <p>{message}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center p-6">
      <div className="mx-auto w-full max-w-sm space-y-5">
        <div className="space-y-1.5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {telegramName ? `Salom, ${telegramName}!` : 'Hisobni bog‘lash'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Telegram akkauntingizni ERP hisobingizga bir marta bog‘lang. Keyingi
            safar parol so‘ralmaydi.
          </p>
        </div>

        <form onSubmit={handleLink} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tg-phone">Telefon raqam</Label>
            <PhoneInput id="tg-phone" value={phone} onChange={setPhone} placeholder="90 123 45 67" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tg-password">Parol</Label>
            <PasswordInput
              id="tg-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            Bog‘lash va kirish
          </Button>
        </form>
      </div>
    </div>
  )
}
