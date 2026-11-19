'use client'

import { useState } from 'react'

export function useToggleSet<T>(initial: Iterable<T> = []) {
  const [items, setItems] = useState(() => new Set(initial))

  const toggle = (item: T) =>
    setItems((current) => {
      const next = new Set(current)
      if (!next.delete(item)) next.add(item)
      return next
    })

  return {
    items,
    has: (item: T) => items.has(item),
    toggle,
    replace: (next: Iterable<T>) => setItems(new Set(next)),
  }
}
