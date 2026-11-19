'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, Loader2, RefreshCw, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LabeledField } from '@/components/shared/labeled-field'
import { TELEGRAM_EVENTS } from '@/lib/integrations/telegram-events'
import { TELEGRAM_LANGUAGES, type TelegramLanguage } from '@/lib/integrations/telegram-types'
import { cn } from '@/lib/utils'
import type { TelegramIntegration } from './use-telegram-integration'

// Each language under its own name, so the admin choosing Russian reads "Русский" whatever the UI is in.
const LANGUAGE_LABELS: Record<TelegramLanguage, string> = { uz: "O'zbekcha", ru: 'Русский', en: 'English' }

const HINT = 'text-xs text-muted-foreground'
const busyIcon = (busy: boolean, Icon: typeof Send, size = 'size-3.5') => (busy ? <Loader2 className={cn('mr-2 animate-spin', size)} /> : <Icon className={cn('mr-2', size)} />)

/** Two steps: the chat id resolves itself once someone presses Start. */
export function SetupSteps() {
  const t = useTranslations('settings.integrations')
  return (
    <ol className="list-inside list-decimal space-y-1.5 rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
      <li>
        {t('stepCreateBot')}{' '}
        <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-violet-600 hover:underline dark:text-violet-400">
          @BotFather <ExternalLink className="size-3" />
        </a>
      </li>
      <li>{t('stepPasteToken')}</li>
      <li>{t('stepPressStart')}</li>
    </ol>
  )
}

// The bot is live but nobody has written to it yet, so Telegram has not said where to post.
function AwaitingChat({ state, bot }: { state: TelegramIntegration; bot: string }) {
  const t = useTranslations('settings.integrations')
  return (
    <div className="space-y-3 rounded-lg border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">{t('awaitingChatHint')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`https://t.me/${bot}?start=erp`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-500">
          <Send className="size-3.5" />
          {t('openBot')}
        </a>
        <Button size="sm" variant="outline" onClick={state.detect} disabled={state.busy === 'detect'}>
          {busyIcon(state.busy === 'detect', RefreshCw)}
          {t('detectChat')}
        </Button>
      </div>
    </div>
  )
}

export function ConnectionInfo({ state }: { state: TelegramIntegration }) {
  const t = useTranslations('settings.integrations')
  const { status } = state
  if (!status.connected || !status.botUsername) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-4 shrink-0" />
        <span>
          {t('connectedAs')}{' '}
          <a href={`https://t.me/${status.botUsername}`} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">
            @{status.botUsername}
          </a>
          {status.tokenHint ? ` (${status.tokenHint})` : ''}
        </span>
      </div>
      {status.awaitingChat ? (
        <AwaitingChat state={state} bot={status.botUsername} />
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {t('sendingTo')} <b className="tabular-nums">{status.chatId}</b>
          </span>
          <Button size="sm" variant="ghost" onClick={state.detect} disabled={state.busy === 'detect'} className="h-7 px-2">
            {busyIcon(state.busy === 'detect', RefreshCw, 'size-3')}
            {t('redetectChat')}
          </Button>
        </div>
      )}
    </div>
  )
}

export function TokenField({ state }: { state: TelegramIntegration }) {
  const t = useTranslations('settings.integrations')
  const connected = state.status.connected
  return (
    <LabeledField id="telegram_token" label={t('botToken')} required={!connected}>
      <PasswordInput
        id="telegram_token"
        value={state.draft.botToken}
        onChange={(e) => state.patch({ botToken: e.target.value })}
        placeholder={connected ? t('botTokenKeepPlaceholder') : '123456789:AA...'}
        autoComplete="off"
      />
      <p className={HINT}>{t(connected ? 'botTokenKeepHint' : 'botTokenHint')}</p>
    </LabeledField>
  )
}

/** A manual chat id, folded away: the normal path never needs it. */
export function AdvancedChatId({ state }: { state: TelegramIntegration }) {
  const t = useTranslations('settings.integrations')
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        {t('advanced')}
      </button>
      {open && (
        <LabeledField id="telegram_chat_id" label={t('chatId')} className="pl-5">
          <Input id="telegram_chat_id" value={state.draft.chatId} onChange={(e) => state.patch({ chatId: e.target.value })} placeholder="-1001234567890" autoComplete="off" />
          <p className={HINT}>{t('chatIdOptionalHint')}</p>
        </LabeledField>
      )}
    </div>
  )
}

export function LanguageField({ state }: { state: TelegramIntegration }) {
  const t = useTranslations('settings.integrations')
  return (
    <LabeledField id="telegram_language" label={t('botLanguage')}>
      <Select value={state.draft.language} onValueChange={(value) => state.patch({ language: value as TelegramLanguage })}>
        <SelectTrigger id="telegram_language" className="w-full sm:w-60">
          <SelectValue>{LANGUAGE_LABELS[state.draft.language]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TELEGRAM_LANGUAGES.map((code) => (
            <SelectItem key={code} value={code}>
              {LANGUAGE_LABELS[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className={HINT}>{t('botLanguageHint')}</p>
    </LabeledField>
  )
}

export function EventToggles({ state }: { state: TelegramIntegration }) {
  const t = useTranslations('settings.integrations')
  const { enabled, events } = state.draft
  return (
    <div className="space-y-3">
      <Label>{t('notifications')}</Label>
      <label className="flex cursor-pointer items-start gap-2.5">
        <Checkbox checked={enabled} onCheckedChange={(on) => state.patch({ enabled: on === true })} className="mt-0.5" />
        <span className="text-sm leading-tight text-foreground">
          {t('enableLabel')}
          <span className={cn('block', HINT)}>{t('enableHint')}</span>
        </span>
      </label>
      <div className="grid gap-2.5 pl-6 sm:grid-cols-2">
        {TELEGRAM_EVENTS.map((event) => (
          <label key={event} className={cn('flex items-center gap-2.5', enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')}>
            <Checkbox checked={events[event] === true} disabled={!enabled} onCheckedChange={(on) => state.patch({ events: { ...events, [event]: on === true } })} />
            <span className="text-sm text-foreground">{t(`event_${event}`)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
