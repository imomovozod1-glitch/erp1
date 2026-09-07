'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Send, CheckCircle2, Loader2, Unplug, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { PasswordInput } from '@/components/ui/password-input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { TELEGRAM_EVENTS, type TelegramEvent } from '@/lib/integrations/telegram-events'

interface TelegramStatus {
  connected: boolean
  enabled: boolean
  chatId: string
  botUsername: string | null
  tokenHint: string | null
  events: Partial<Record<TelegramEvent, boolean>>
  linkedAt: string | null
}

/**
 * Telegram bot connection UI.
 *
 * All reads/writes go through `/api/integrations/telegram` rather than the
 * browser Supabase client: `integration_settings` grants no `authenticated`
 * RLS policy, precisely so the bot token can never be selected from here.
 * The stored token is therefore never rendered — only a masked hint — and the
 * token field is left blank on an existing connection, meaning "keep the
 * current one" unless the admin types a new value.
 */
export function TelegramIntegrationForm() {
  const t = useTranslations('settings.integrations')
  const tCommon = useTranslations('common')

  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [events, setEvents] = useState<Partial<Record<TelegramEvent, boolean>>>({})

  const applyStatus = (data: TelegramStatus) => {
    setStatus(data)
    setChatId(data.chatId ?? '')
    setEnabled(data.enabled)
    setEvents(data.events ?? {})
    // Never prefill the token — the API deliberately doesn't return it.
    setBotToken('')
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/integrations/telegram')
        if (!res.ok) throw new Error('failed')
        const data: TelegramStatus = await res.json()
        if (!cancelled) applyStatus(data)
      } catch {
        if (!cancelled) toast.error(tCommon('error'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const errorMessage = (code: string | undefined, detail?: string) => {
    switch (code) {
      case 'invalid_token_format':
        return t('errorTokenFormat')
      case 'token_rejected':
        return detail ? `${t('errorTokenRejected')}: ${detail}` : t('errorTokenRejected')
      case 'invalid_chat_id':
        return t('errorChatIdFormat')
      case 'token_required':
        return t('errorTokenRequired')
      case 'not_configured':
        return t('errorNotConfigured')
      case 'send_failed':
        return detail ? `${t('errorSendFailed')}: ${detail}` : t('errorSendFailed')
      default:
        return tCommon('error')
    }
  }

  const handleSave = async () => {
    if (isSaving) return
    if (!chatId.trim()) {
      toast.error(t('errorChatIdRequired'))
      return
    }
    if (!status?.connected && !botToken.trim()) {
      toast.error(t('errorTokenRequired'))
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/integrations/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Omitted when blank → the server keeps the stored token.
          ...(botToken.trim() ? { bot_token: botToken.trim() } : {}),
          chat_id: chatId.trim(),
          enabled,
          events,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(errorMessage(json.error, json.detail))
        return
      }
      toast.success(tCommon('saved'))

      const refreshed = await fetch('/api/integrations/telegram')
      if (refreshed.ok) applyStatus(await refreshed.json())
    } catch {
      toast.error(tCommon('error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    if (isTesting) return
    setIsTesting(true)
    try {
      const res = await fetch('/api/integrations/telegram/test', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(errorMessage(json.error, json.detail))
        return
      }
      toast.success(t('testSent'))
    } catch {
      toast.error(tCommon('error'))
    } finally {
      setIsTesting(false)
    }
  }

  const handleDisconnect = async () => {
    if (isDisconnecting) return
    if (!confirm(t('disconnectConfirm'))) return

    setIsDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/telegram', { method: 'DELETE' })
      if (!res.ok) {
        toast.error(tCommon('error'))
        return
      }
      toast.success(t('disconnected'))
      const refreshed = await fetch('/api/integrations/telegram')
      if (refreshed.ok) applyStatus(await refreshed.json())
    } catch {
      toast.error(tCommon('error'))
    } finally {
      setIsDisconnecting(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="max-w-2xl border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl border-slate-200/60 dark:border-slate-800 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 shrink-0">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{t('telegramTitle')}</CardTitle>
              <CardDescription className="mt-1">{t('telegramDesc')}</CardDescription>
            </div>
          </div>
          <StatusBadge
            tone={status?.connected ? (status.enabled ? 'emerald' : 'amber') : 'slate'}
            label={
              status?.connected
                ? status.enabled
                  ? t('statusActive')
                  : t('statusPaused')
                : t('statusNotConnected')
            }
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Setup guide */}
        <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 list-decimal list-inside bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
          <li>
            {t('stepCreateBot')}{' '}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-0.5"
            >
              @BotFather <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>{t('stepCopyToken')}</li>
          <li>{t('stepAddToGroup')}</li>
          <li>
            {t('stepGetChatId')}{' '}
            <a
              href="https://t.me/userinfobot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-0.5"
            >
              @userinfobot <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        </ol>

        {status?.connected && status.botUsername && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              {t('connectedAs')} <b>@{status.botUsername}</b>
              {status.tokenHint ? ` (${status.tokenHint})` : ''}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="telegram_token">
            {t('botToken')} {!status?.connected && '*'}
          </Label>
          <PasswordInput
            id="telegram_token"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={status?.connected ? t('botTokenKeepPlaceholder') : '123456789:AA...'}
            autoComplete="off"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {status?.connected ? t('botTokenKeepHint') : t('botTokenHint')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="telegram_chat_id">{t('chatId')} *</Label>
          <Input
            id="telegram_chat_id"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="-1001234567890"
            autoComplete="off"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('chatIdHint')}</p>
        </div>

        <div className="space-y-3">
          <Label>{t('notifications')}</Label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <Checkbox
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300 leading-tight">
              {t('enableLabel')}
              <span className="block text-xs text-slate-400 dark:text-slate-500">{t('enableHint')}</span>
            </span>
          </label>

          <div className="grid gap-2.5 sm:grid-cols-2 pl-6">
            {TELEGRAM_EVENTS.map((event) => (
              <label
                key={event}
                className={`flex items-center gap-2.5 ${enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                <Checkbox
                  checked={events[event] === true}
                  disabled={!enabled}
                  onCheckedChange={(checked) =>
                    setEvents((prev) => ({ ...prev, [event]: checked === true }))
                  }
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{t(`event_${event}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tCommon('save')}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={isTesting || !status?.connected}>
            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {t('sendTest')}
          </Button>
          {status?.connected && (
            <Button
              variant="ghost"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 ml-auto"
            >
              {isDisconnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-2 h-4 w-4" />
              )}
              {t('disconnect')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
