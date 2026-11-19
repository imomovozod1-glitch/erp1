import type { CartItem } from '@/components/pos/use-pos-cart'

/** Only what survives a remount — the product itself is re-resolved from the live catalogue. */
interface PersistedLine {
  productId: string
  quantity: number
  discountPercent: number
}

const STORAGE_KEY = 'pos_cart'

/** Reads the saved basket, re-resolving each line against the live catalogue. */
export function readStoredCart(catalogue: any[]): CartItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const saved: PersistedLine[] = JSON.parse(raw)
    return saved
      .map((entry) => {
        const product = catalogue.find((p) => p.id === entry.productId)
        return product
          ? { product, quantity: entry.quantity, discountPercent: entry.discountPercent }
          : null
      })
      .filter((item): item is CartItem => item !== null)
  } catch {
    return []
  }
}

/** Storage may be unavailable (private browsing, quota); the basket then just won't survive a remount. */
export function writeStoredCart(items: CartItem[]) {
  try {
    if (items.length === 0) return sessionStorage.removeItem(STORAGE_KEY)
    const lines: PersistedLine[] = items.map((i) => ({ productId: i.product.id, quantity: i.quantity, discountPercent: i.discountPercent }))
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  } catch {}
}
