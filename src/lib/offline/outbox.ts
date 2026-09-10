/**
 * Durable queue of writes made while offline.
 *
 * Today every mutation in this app is a direct Supabase call from a form
 * component (see CLAUDE.md → Data layer). Offline, that call simply fails and
 * the user's work is lost. The outbox is the replacement contract: a write is
 * recorded locally first, the local cache is updated so the UI moves on, and
 * the queue is drained against Supabase once connectivity returns.
 *
 * Ordering is strict and global. A queue that reordered writes could apply an
 * update to a row whose insert has not landed yet, so `flush` stops at the
 * first entry it cannot apply rather than skipping past it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { OUTBOX_STORE, openOfflineDb, promisify } from '@/lib/offline/db'

export type OutboxOp = 'insert' | 'update' | 'delete'

export interface OutboxEntry {
  /** Auto-assigned by IndexedDB; also the flush order. */
  seq?: number
  __tenant: string
  table: string
  op: OutboxOp
  /** Row payload for insert/update; ignored for delete. */
  payload?: Record<string, unknown>
  /** Equality filter identifying the target row for update/delete. */
  match?: Record<string, unknown>
  createdAt: number
  attempts: number
  lastError?: string
  /**
   * Set once the server has rejected the write for a reason retrying cannot
   * fix (validation, constraint violation). Such an entry is skipped by
   * `flush` instead of blocking the queue behind it forever, and surfaced to
   * the user for a manual decision.
   */
  deadLetter?: boolean
}

export async function enqueue(
  entry: Omit<OutboxEntry, 'seq' | 'createdAt' | 'attempts'>
): Promise<void> {
  const db = await openOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(OUTBOX_STORE, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.objectStore(OUTBOX_STORE).add({
      ...entry,
      createdAt: Date.now(),
      attempts: 0,
    } satisfies OutboxEntry)
  })
}

export async function listOutbox(tenantId?: string): Promise<OutboxEntry[]> {
  const db = await openOfflineDb()
  const store = db.transaction(OUTBOX_STORE, 'readonly').objectStore(OUTBOX_STORE)
  const all = (await promisify(store.getAll())) as OutboxEntry[]
  const scoped = tenantId ? all.filter((e) => e.__tenant === tenantId) : all
  return scoped.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
}

/** Number of writes still waiting to reach the server — drives the UI badge. */
export async function pendingCount(tenantId?: string): Promise<number> {
  return (await listOutbox(tenantId)).filter((e) => !e.deadLetter).length
}

async function updateEntry(entry: OutboxEntry): Promise<void> {
  const db = await openOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(OUTBOX_STORE, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.objectStore(OUTBOX_STORE).put(entry)
  })
}

async function removeEntry(seq: number): Promise<void> {
  const db = await openOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(OUTBOX_STORE, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.objectStore(OUTBOX_STORE).delete(seq)
  })
}

/**
 * A PostgREST error the server will reject identically no matter how often it
 * is retried — bad input, constraint violation, RLS denial. Anything else
 * (network drop, 5xx, timeout) is treated as transient and left queued.
 */
function isPermanentFailure(code?: string): boolean {
  if (!code) return false
  // Postgres SQLSTATE classes: 22 = data exception, 23 = integrity constraint,
  // 42 = syntax/access rule violation. PostgREST forwards these verbatim.
  return /^(22|23|42)/.test(code) || code === 'PGRST116'
}

export interface FlushResult {
  sent: number
  failed: number
  /** True when the queue stopped early because a write could not be applied. */
  halted: boolean
}

/**
 * Drain the queue in order. Returns as soon as an entry fails transiently, so
 * the next attempt resumes from exactly that point with ordering intact.
 */
export async function flush(
  supabase: SupabaseClient,
  tenantId?: string
): Promise<FlushResult> {
  const entries = await listOutbox(tenantId)
  let sent = 0
  let failed = 0

  for (const entry of entries) {
    if (entry.deadLetter || entry.seq == null) continue

    const table = supabase.from(entry.table)
    let error: { message: string; code?: string } | null = null

    if (entry.op === 'insert') {
      ;({ error } = await table.insert(entry.payload ?? {}))
    } else if (entry.op === 'update') {
      ;({ error } = await table.update(entry.payload ?? {}).match(entry.match ?? {}))
    } else {
      ;({ error } = await table.delete().match(entry.match ?? {}))
    }

    if (!error) {
      await removeEntry(entry.seq)
      sent++
      continue
    }

    failed++
    const permanent = isPermanentFailure(error.code)
    await updateEntry({
      ...entry,
      attempts: entry.attempts + 1,
      lastError: error.message,
      deadLetter: permanent || undefined,
    })

    // A permanently-rejected write is parked and the queue continues; a
    // transient one means the network is still unhealthy, so stop and keep
    // the remaining order intact for the next attempt.
    if (!permanent) return { sent, failed, halted: true }
  }

  return { sent, failed, halted: false }
}
