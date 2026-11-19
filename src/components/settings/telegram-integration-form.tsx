'use client'

import { Loader2, Send, Unplug } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { AdvancedChatId, ConnectionInfo, EventToggles, LanguageField, SetupSteps, TokenField } from '@/components/settings/telegram/telegram-parts'
import { useTelegramIntegration, type TelegramIntegration } from '@/components/settings/telegram/use-telegram-integration'
import type { TelegramStatus } from '@/lib/integrations/telegram-types'

function ConnectionBadge({ status }: { status: TelegramStatus }) {
  const t = useTranslations('settings.integrations')
  if (!status.connected) return <StatusBadge tone="slate" label={t('statusNotConnected')} />
  return <StatusBadge tone={status.enabled ? 'emerald' : 'amber'} label={t(status.enabled ? 'statusActive' : 'statusPaused')} />
}

function Actions({ state }: { state: TelegramIntegration }) {
  const t = useTranslations()
  const spin = <Loader2 className="mr-2 size-4 animate-spin" />
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
      <Button onClick={state.save} disabled={state.busy === 'save'}>
        {state.busy === 'save' && spin}
        {t('common.save')}
      </Button>
      <Button variant="outline" onClick={state.test} disabled={state.busy === 'test' || !state.status.connected}>
        {state.busy === 'test' ? spin : <Send className="mr-2 size-4" />}
        {t('settings.integrations.sendTest')}
      </Button>
      {state.status.connected && (
        <Button variant="ghost" onClick={state.disconnect} disabled={state.busy === 'disconnect'} className="ml-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30">
          {state.busy === 'disconnect' ? spin : <Unplug className="mr-2 size-4" />}
          {t('settings.integrations.disconnect')}
        </Button>
      )}
    </div>
  )
}

/** Telegram bot connection. The stored token is never shown — only a masked hint; a blank field keeps it. */
export function TelegramIntegrationForm({ initialStatus }: { initialStatus: TelegramStatus }) {
  const t = useTranslations('settings.integrations')
  const state = useTelegramIntegration(initialStatus)
  return (
    <Card className="max-w-3xl border shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg bg-sky-50 p-2.5 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
              <Send className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">{t('telegramTitle')}</CardTitle>
              <CardDescription className="mt-1">{t('telegramDesc')}</CardDescription>
            </div>
          </div>
          <ConnectionBadge status={state.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <SetupSteps />
        <ConnectionInfo state={state} />
        <TokenField state={state} />
        <AdvancedChatId state={state} />
        <LanguageField state={state} />
        <EventToggles state={state} />
        <Actions state={state} />
      </CardContent>
      {state.confirmDialog}
    </Card>
  )
}
