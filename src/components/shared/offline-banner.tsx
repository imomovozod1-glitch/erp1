'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { CloudOff, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { useOnlineStatus } from '@/lib/hooks/use-online-status'
import {
  getOfflineServerSnapshot,
  getOfflineSnapshot,
  runSync,
  subscribeOffline,
} from '@/lib/offline/sync-store'
import { cn } from '@/lib/utils'

/**
 * Connectivity strip for the dashboard shell. Purely a reader — the queue
 * draining and the online/offline listeners live in
 * src/lib/offline/sync-store.ts, so nothing here sets state from an effect.
 *
 * Renders only when it has something to say: the app is offline, writes are
 * queued, or a queued write was rejected.
 */
export function OfflineBanner() {
  const t = useTranslations('offline')
  const isOnline = useOnlineStatus()
  const { pending, blocked, status } = useSyncExternalStore(
    subscribeOffline,
    getOfflineSnapshot,
    getOfflineServerSnapshot
  )

  const hasQueue = pending > 0
  const hasBlocked = blocked > 0
  if (isOnline && !hasQueue && !hasBlocked && status === 'idle') return null

  const tone = !isOnline
    ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900'
    : hasBlocked || status === 'failed'
      ? 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900'
      : 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900'

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5 text-sm mb-4',
        tone
      )}
    >
      {!isOnline ? (
        <>
          <CloudOff className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{t('offlineTitle')}</span>
          <span className="opacity-80">{t('offlineDescription')}</span>
        </>
      ) : status === 'syncing' ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span className="font-semibold">{t('syncing')}</span>
        </>
      ) : (
        <>
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{t('syncFailed')}</span>
        </>
      )}

      {hasQueue && <span className="opacity-80">{t('pending', { count: pending })}</span>}
      {hasBlocked && <span className="font-medium">{t('blocked', { count: blocked })}</span>}

      {isOnline && status !== 'syncing' && (hasQueue || status === 'failed') && (
        <button
          type="button"
          onClick={() => void runSync()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-current/20 px-2 py-1 text-xs font-semibold transition-colors hover:bg-current/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('retry')}
        </button>
      )}
    </div>
  )
}
