'use client'

import { createClient } from '@/lib/supabase/client'
import { isOfflineStorageAvailable } from '@/lib/offline/db'
import { flush, listOutbox } from '@/lib/offline/outbox'

/**
 * External store holding everything the connectivity UI needs.
 *
 * This is not component state. Queue depth lives in IndexedDB and connectivity
 * lives on `window`, both of which change outside React's render cycle — and
 * this project's React Compiler lint rejects driving that from a component
 * effect (`react-hooks/set-state-in-effect`, see CLAUDE.md → Gotchas). So the
 * store owns the listeners and the flush loop, and components subscribe to it
 * through `useSyncExternalStore`, the same shape as
 * src/components/shared/page-clock.tsx.
 */

export type SyncStatus = 'idle' | 'syncing' | 'failed'

export interface OfflineSnapshot {
  pending: number
  /** Writes the server rejected outright; they need a human decision. */
  blocked: number
  status: SyncStatus
}

const INITIAL: OfflineSnapshot = { pending: 0, blocked: 0, status: 'idle' }

/**
 * `useSyncExternalStore` compares snapshots by reference and re-renders on any
 * change, so this must stay the *same object* until a value actually differs —
 * returning a fresh object each read would loop forever.
 */
let snapshot: OfflineSnapshot = INITIAL
const listeners = new Set<() => void>()

function setSnapshot(next: Partial<OfflineSnapshot>): void {
  const merged: OfflineSnapshot = { ...snapshot, ...next }
  if (
    merged.pending === snapshot.pending &&
    merged.blocked === snapshot.blocked &&
    merged.status === snapshot.status
  ) {
    return
  }
  snapshot = merged
  for (const listener of listeners) listener()
}

export function getOfflineSnapshot(): OfflineSnapshot {
  return snapshot
}

/** Server render has no queue and no connectivity — a stable, always-empty snapshot. */
export function getOfflineServerSnapshot(): OfflineSnapshot {
  return INITIAL
}

export async function refreshOutboxCounts(): Promise<void> {
  if (!isOfflineStorageAvailable()) return
  try {
    const entries = await listOutbox()
    setSnapshot({
      pending: entries.filter((e) => !e.deadLetter).length,
      blocked: entries.filter((e) => e.deadLetter).length,
    })
  } catch {
    // Storage unavailable (private mode, quota denied) — stay quiet rather
    // than showing a sync error the user can do nothing about.
  }
}

let inFlight: Promise<void> | null = null

/** Drain the outbox. Concurrent callers share one run rather than racing the queue. */
export function runSync(): Promise<void> {
  if (!isOfflineStorageAvailable()) return Promise.resolve()
  if (inFlight) return inFlight

  inFlight = (async () => {
    setSnapshot({ status: 'syncing' })
    try {
      const result = await flush(createClient())
      setSnapshot({ status: result.halted ? 'failed' : 'idle' })
    } catch {
      setSnapshot({ status: 'failed' })
    } finally {
      await refreshOutboxCounts()
      inFlight = null
    }
  })()

  return inFlight
}

function handleOnline(): void {
  void runSync()
}

function handleOffline(): void {
  // Nothing to drain while offline; drop any stale failure so the banner
  // reports the real reason (no connection) rather than a past sync error.
  setSnapshot({ status: 'idle' })
}

/**
 * Subscribe a component. Listeners are attached on the first subscriber and
 * removed with the last, so the store costs nothing on pages that never
 * render the banner.
 */
export function subscribeOffline(onChange: () => void): () => void {
  const first = listeners.size === 0
  listeners.add(onChange)

  if (first && typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    void refreshOutboxCounts()
  }

  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }
}
