'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { fireTelegramNotification } from '@/lib/integrations/notify-client'

/**
 * Tells the company its subscription is running out, before it runs out.
 *
 * The block itself is silent by design — src/proxy.ts simply stops serving the
 * workspace the day after the end date — and a company that learns about its
 * subscription by being locked out of it in the middle of a working day has
 * been failed twice. This is the warning, shown for the last week.
 *
 * `daysLeft` is computed on the server ((dashboard)/layout.tsx) rather than
 * here: reading the clock during render is impure under the React Compiler
 * rules, and a date crossing midnight mid-session is not worth a subscription.
 *
 * Not dismissible on purpose. It appears seven days out and disappears the
 * moment a payment is recorded, and the thing it is warning about is the whole
 * company losing access.
 *
 * Showing it is also what sends the company's Telegram warning: there is no
 * scheduler in this deployment, so the dashboard opening is the trigger. The
 * server decides whether anything is actually sent — once per company per day,
 * claimed before sending (/api/integrations/telegram/notify) — and the guard
 * below only keeps one browser session from asking on every navigation.
 */
export function SubscriptionBanner({
  daysLeft,
  endsAt,
}: {
  daysLeft: number
  endsAt: string
}) {
  const t = useTranslations('tenantStatus')

  useEffect(() => {
    // Per end-date, so a renewal that pushes the date out re-arms it.
    const key = `erp_sub_warned_${endsAt}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // Storage blocked: the server-side daily claim is the real guard, this
      // only saves a request.
    }
    fireTelegramNotification({ event: 'subscription_expiring' })
  }, [endsAt])

  // The last two days read differently from the first five: same message, but
  // it stops being a note and becomes a warning.
  const urgent = daysLeft <= 2
  const Icon = urgent ? AlertTriangle : CalendarClock

  return (
    <div
      role="status"
      className={cn(
        'mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-4 py-3 text-sm',
        urgent
          ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200'
          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="font-semibold">
        {daysLeft <= 0
          ? t('expiringToday')
          : t('expiringInDays', { days: daysLeft })}
      </span>
      <span className="opacity-90">
        {t('expiringOn', { date: formatDate(endsAt) })} · {t('expiringAction')}
      </span>
    </div>
  )
}
