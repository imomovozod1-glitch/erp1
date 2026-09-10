/**
 * Local persistence layer for offline mode.
 *
 * Raw IndexedDB rather than Dexie/localforage: this is the one storage layer
 * the whole offline effort sits on, it needs to run identically in the browser
 * and in the Capacitor WebView, and the surface actually used here (typed
 * key-value stores + one index) is small enough that a dependency would buy
 * little. `localStorage` is deliberately not used — it is synchronous (it
 * blocks the main thread on every read) and caps out around 5 MB, which a full
 * product/customer catalogue exceeds. The existing `localStorage['erp_cashboxes']`
 * mirror in src/lib/finance-helpers.ts predates this and should migrate here.
 */

const DB_NAME = 'erp_offline'
const DB_VERSION = 1

/**
 * Cached read-model stores, one per entity, each keyed by the row's `id` and
 * indexed by tenant. Adding an entity here is all that is needed to make it
 * cacheable — but bump DB_VERSION, or existing installs keep the old schema.
 */
export const ENTITY_STORES = [
  'products',
  'categories',
  'customers',
  'suppliers',
  'employees',
  'departments',
  'sales_orders',
  'purchase_orders',
  'invoices',
  'transactions',
  'transaction_categories',
  'cashboxes',
  'stock_movements',
] as const

export type EntityStore = (typeof ENTITY_STORES)[number]

/** Pending writes made while offline — see src/lib/offline/outbox.ts. */
export const OUTBOX_STORE = 'outbox'
/** Bookkeeping: per-entity last-pulled timestamps, schema markers. */
export const META_STORE = 'meta'

/** A cached row, tagged with the tenant it belongs to so one device can hold several. */
export type CachedRow = Record<string, unknown> & { id: string; __tenant: string }

export function isOfflineStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null

export function openOfflineDb(): Promise<IDBDatabase> {
  if (!isOfflineStorageAvailable()) {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of ENTITY_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' })
          store.createIndex('by_tenant', '__tenant', { unique: false })
        }
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: 'seq', autoIncrement: true })
        // Flush order is strictly the order the user made the changes in —
        // a later edit to a row must never be applied before its insert.
        outbox.createIndex('by_seq', 'seq', { unique: true })
        outbox.createIndex('by_tenant', '__tenant', { unique: false })
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => {
      const db = request.result
      // Another tab opened a newer version: this connection blocks its upgrade,
      // so drop it and let the next call reopen at the new version.
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'))
  }).catch((err) => {
    // Never cache a rejected promise — a transient failure (private-mode
    // storage prompt, quota) would otherwise poison every later call.
    dbPromise = null
    throw err
  })

  return dbPromise
}

async function tx(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => void | Promise<void>
): Promise<void> {
  const db = await openOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
    Promise.resolve(run(transaction.objectStore(storeName))).catch(reject)
  })
}

/** Replace this tenant's cached copy of an entity with a freshly pulled set. */
export async function replaceEntity(
  store: EntityStore,
  tenantId: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  await tx(store, 'readwrite', async (objectStore) => {
    // Clear only this tenant's rows, not the whole store — another tenant's
    // cache on the same device must survive.
    const index = objectStore.index('by_tenant')
    const keys = await promisify(index.getAllKeys(IDBKeyRange.only(tenantId)))
    for (const key of keys) objectStore.delete(key)
    for (const row of rows) {
      const id = row.id
      if (typeof id !== 'string') continue
      objectStore.put({ ...row, id, __tenant: tenantId } satisfies CachedRow)
    }
  })
}

export async function readEntity<T = CachedRow>(
  store: EntityStore,
  tenantId: string
): Promise<T[]> {
  const db = await openOfflineDb()
  const index = db.transaction(store, 'readonly').objectStore(store).index('by_tenant')
  return (await promisify(index.getAll(IDBKeyRange.only(tenantId)))) as T[]
}

export async function readEntityRow<T = CachedRow>(
  store: EntityStore,
  id: string
): Promise<T | undefined> {
  const db = await openOfflineDb()
  const objectStore = db.transaction(store, 'readonly').objectStore(store)
  return (await promisify(objectStore.get(id))) as T | undefined
}

/**
 * Apply a write to the local cache immediately, so the UI reflects it before
 * the server has ever seen it (the write itself is queued in the outbox).
 */
export async function putEntityRow(
  store: EntityStore,
  tenantId: string,
  row: Record<string, unknown>
): Promise<void> {
  const id = row.id
  if (typeof id !== 'string') throw new Error(`${store}: row has no string id`)
  await tx(store, 'readwrite', (objectStore) => {
    objectStore.put({ ...row, id, __tenant: tenantId } satisfies CachedRow)
  })
}

export async function deleteEntityRow(store: EntityStore, id: string): Promise<void> {
  await tx(store, 'readwrite', (objectStore) => {
    objectStore.delete(id)
  })
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await tx(META_STORE, 'readwrite', (store) => {
    store.put({ key, value })
  })
}

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openOfflineDb()
  const store = db.transaction(META_STORE, 'readonly').objectStore(META_STORE)
  const record = (await promisify(store.get(key))) as { key: string; value: T } | undefined
  return record?.value
}

/** Wipe every cached row and pending write — used on sign-out. */
export async function clearOfflineData(): Promise<void> {
  const db = await openOfflineDb()
  const names = [...ENTITY_STORES, OUTBOX_STORE, META_STORE]
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(names, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    for (const name of names) transaction.objectStore(name).clear()
  })
}

export { promisify }
