'use client'

import { useEffect, useMemo, useState } from 'react'

export interface CartItem {
  product: any
  quantity: number
  discountPercent: number
}

/** Only what survives a remount — the product itself is re-resolved from the live catalogue. */
interface PersistedLine {
  productId: string
  quantity: number
  discountPercent: number
}

const STORAGE_KEY = 'pos_cart'

/** Reads the saved basket, re-resolving each line against the live catalogue. */
function readStoredCart(catalogue: any[]): CartItem[] {
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

/**
 * The till's basket: its contents, the order-level discount, and the money
 * those two add up to.
 *
 * Lifted out of `pos-client.tsx`, which was carrying this alongside the
 * product grid, the customer picker, the checkout writes, the printer and the
 * receipt in one 1400-line component. The basket is the one piece of that
 * screen with rules of its own — never exceed stock, merge a repeat scan into
 * the existing line, drop a line at zero, survive a locale switch — and those
 * rules are worth reading without the other thousand lines around them.
 *
 * Deliberately says nothing about the UI: a stock rejection is reported
 * through `onStockExceeded` rather than by raising a toast here, so the hook
 * stays independent of next-intl and sonner.
 *
 * What it does NOT own: the selected customer and the payment method. They are
 * chosen alongside a sale but are not part of the basket, and `reset()` leaves
 * them to the caller.
 */
export function usePosCart({
  catalogue,
  onStockExceeded,
}: {
  /** Used once, to re-resolve a restored basket against real products. */
  catalogue: any[]
  /** Called when an action would take a line past the product's stock. */
  onStockExceeded: () => void
}) {
  // Switching language re-mounts this whole screen (see `handleLocaleChange` in
  // app-header.tsx — [lang] is the top-most route segment, so a locale change
  // necessarily remounts everything below it). Persisting the basket survives
  // that; only id + quantity + discount are stored, and each line is
  // re-resolved against the freshly-fetched catalogue below, so stale product
  // data — or a product deleted since — can never come back into the basket.
  //
  // Restored AFTER mount rather than in the initialiser: the server renders an
  // empty basket, so a restored one on the client's first render is a hydration
  // mismatch — React logs it and throws the server's markup away to re-render
  // the whole till. Deferred by a 0 ms timer so no state is set synchronously
  // inside the effect (react-hooks/set-state-in-effect — see AGENTS.md).
  const [items, setItems] = useState<CartItem[]>([])
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setItems(readStoredCart(catalogue))
      setRestored(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [catalogue])

  useEffect(() => {
    // Never write before the first read, or mounting would wipe the very
    // basket this is meant to preserve.
    if (!restored) return
    try {
      if (items.length === 0) {
        sessionStorage.removeItem(STORAGE_KEY)
      } else {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            items.map(
              (i): PersistedLine => ({
                productId: i.product.id,
                quantity: i.quantity,
                discountPercent: i.discountPercent,
              })
            )
          )
        )
      }
    } catch {
      // Storage unavailable (private browsing, quota) — the basket just won't
      // survive a locale switch this time, not worth surfacing to the user.
    }
  }, [items, restored])

  const [generalDiscountType, setGeneralDiscountType] = useState<'percent' | 'flat'>('flat')
  const [generalDiscountValue, setGeneralDiscountValue] = useState<number>(0)
  const [taxActive, setTaxActive] = useState(false)

  const add = (product: any) => {
    if (product.stock <= 0) {
      onStockExceeded()
      return
    }
    const existing = items.find((item) => item.product.id === product.id)
    if (!existing) {
      setItems([...items, { product, quantity: 1, discountPercent: 0 }])
      return
    }
    if (existing.quantity >= product.stock) {
      onStockExceeded()
      return
    }
    // Replaced, not mutated: mutating the line would also mutate the object
    // still held in state, so React — and the React Compiler's memoisation —
    // could not see that anything changed.
    setItems(
      items.map((item) =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      )
    )
  }

  const setQuantity = (productId: string, quantity: number) => {
    const item = items.find((i) => i.product.id === productId)
    if (!item) return
    if (quantity > item.product.stock) {
      onStockExceeded()
      return
    }
    if (quantity <= 0) {
      remove(productId)
      return
    }
    setItems(items.map((i) => (i.product.id === productId ? { ...i, quantity } : i)))
  }

  /**
   * Empties the quantity box without dropping the line, so the cashier can
   * type a new number into it. The line is removed on blur if it is still
   * empty — see the `onBlur` in the cart list.
   */
  const clearQuantity = (productId: string) => {
    setItems(items.map((i) => (i.product.id === productId ? { ...i, quantity: 0 } : i)))
  }

  const setLineDiscount = (productId: string, discountPercent: number) => {
    const value = Math.max(0, Math.min(100, discountPercent))
    setItems(items.map((i) => (i.product.id === productId ? { ...i, discountPercent: value } : i)))
  }

  const remove = (productId: string) => {
    setItems(items.filter((item) => item.product.id !== productId))
  }

  /** Empties the basket and the order-level discount. Leaves customer/payment to the caller. */
  const reset = () => {
    setItems([])
    setGeneralDiscountValue(0)
    setTaxActive(false)
  }

  // Recomputed only when the basket or the discount actually changes — not on
  // every keystroke in the product search above them.
  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const linePrice = item.product.price * item.quantity
        return sum + (linePrice - linePrice * (item.discountPercent / 100))
      }, 0),
    [items]
  )

  const discount = useMemo(
    () =>
      generalDiscountType === 'percent'
        ? subtotal * (generalDiscountValue / 100)
        : Math.min(subtotal, generalDiscountValue),
    [subtotal, generalDiscountType, generalDiscountValue]
  )

  // No tax is charged yet; kept explicit because the order, the invoice and the
  // receipt all carry a tax amount, and a bare 0 in five places reads as an
  // oversight rather than as policy.
  const tax = 0
  const total = subtotal - discount + tax

  return {
    items,
    add,
    setQuantity,
    clearQuantity,
    setLineDiscount,
    remove,
    reset,
    generalDiscountType,
    setGeneralDiscountType,
    generalDiscountValue,
    setGeneralDiscountValue,
    taxActive,
    setTaxActive,
    subtotal,
    discount,
    tax,
    total,
  }
}

export type PosCart = ReturnType<typeof usePosCart>
