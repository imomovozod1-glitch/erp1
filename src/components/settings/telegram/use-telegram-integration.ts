'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { errorMessage } from '@/lib/error-message'
import type { TelegramEvent } from '@/lib/integrations/telegram-events'
import type { TelegramLanguage, TelegramStatus } from '@/lib/integrations/telegram-types'

const API = '/api/integrations/telegram'

/** API error code → `settings.integrations.*` message key. */
const CODE_KEYS: Record<string, string> = {
  invalid_token_format: 'errorTokenFormat',
  token_rejected: 'errorTokenRejected',
  invalid_chat_id: 'errorChatIdFormat',
  token_required: 'errorTokenRequired',
  not_configured: 'errorNotConfigured',
  no_chat_yet: 'errorNoChatYet',
  awaiting_chat: 'errorNoChatYet',
  detect_failed: 'errorDetectFailed',
  send_failed: 'errorSendFailed',
}

class TelegramApiError extends Error {
  constructor(readonly code: string | undefined) {
    super(code ?? 'telegram_failed')
  }
}

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new TelegramApiError(json.error)
  return json
}

type Busy = 'save' | 'test' | 'detect' | 'disconnect' | null

interface Draft {
  botToken: string
  chatId: string
  enabled: boolean
  events: Partial<Record<TelegramEvent, boolean>>
  language: TelegramLanguage
}

// The token is never prefilled: the API deliberately never returns it.
const draftFrom = (status: TelegramStatus): Draft => ({
  botToken: '',
  chatId: status.chatId ?? '',
  enabled: status.enabled,
  events: status.events ?? {},
  language: status.language ?? 'uz',
})

/**
 * Everything goes through the API route: `integration_settings` grants no `authenticated`
 * policy, so the bot token can never be selected from the browser.
 */
export function useTelegramIntegration(initial: TelegramStatus) {
  const t = useTranslations()
  const [confirm, confirmDialog] = useConfirmDelete()
  const [status, setStatus] = useState(initial)
  const [draft, setDraft] = useState(() => draftFrom(initial))
  const [busy, setBusy] = useState<Busy>(null)

  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }))
  const fail = (error: unknown) => {
    const code = error instanceof TelegramApiError ? error.code : undefined
    toast.error(code && CODE_KEYS[code] ? t(`settings.integrations.${CODE_KEYS[code]}`) : errorMessage(t, code ?? error, t('common.error')))
  }
  // The action itself succeeded; a failed re-read only leaves the card as it was.
  const refresh = async () => {
    const res = await fetch(API)
    if (!res.ok) return
    const next = await res.json()
    setStatus(next)
    setDraft(draftFrom(next))
  }
  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    if (busy) return
    setBusy(kind)
    try {
      await action()
    } catch (error) {
      fail(error)
    } finally {
      setBusy(null)
    }
  }

  // Blank token keeps the stored one; blank chat id lets the server discover it from the bot.
  const save = () => {
    if (!status.connected && !draft.botToken.trim()) return void toast.error(t('settings.integrations.errorTokenRequired'))
    return run('save', async () => {
      const token = draft.botToken.trim()
      const chat = draft.chatId.trim()
      const json = await call('', 'PUT', { ...(token ? { bot_token: token } : {}), ...(chat ? { chat_id: chat } : {}), enabled: draft.enabled, events: draft.events, language: draft.language })
      toast.success(t(json.awaitingChat ? 'settings.integrations.savedAwaitingChat' : 'common.saved'))
      await refresh()
    })
  }

  const detect = () =>
    run('detect', async () => {
      const json = await call('/detect-chat', 'POST')
      toast.success(t('settings.integrations.chatDetected', { chat: json.chatTitle ?? json.chatId }))
      await refresh()
    })

  const test = () =>
    run('test', async () => {
      await call('/test', 'POST')
      toast.success(t('settings.integrations.testSent'))
    })

  const disconnect = async () => {
    if (!(await confirm({ description: t('settings.integrations.disconnectConfirm'), confirmLabel: t('settings.integrations.disconnect') }))) return
    await run('disconnect', async () => {
      await call('', 'DELETE')
      toast.success(t('settings.integrations.disconnected'))
      await refresh()
    })
  }

  return { status, draft, patch, busy, save, detect, test, disconnect, confirmDialog }
}

export type TelegramIntegration = ReturnType<typeof useTelegramIntegration>
