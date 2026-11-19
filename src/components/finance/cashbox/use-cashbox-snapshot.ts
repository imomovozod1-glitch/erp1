'use client'

import { useEffect, useState } from 'react'
import { readMirrorSnapshot } from './cashbox-mirror'
import type { Cashbox, CashboxPageData } from './cashbox-types'

export function useCashboxSnapshot(initialData: CashboxPageData) {
  const [snapshot, setSnapshot] = useState(initialData)
  const [lastServerData, setLastServerData] = useState(initialData)
  if (lastServerData !== initialData) {
    setLastServerData(initialData)
    if (!snapshot.failed) setSnapshot(initialData)
  }

  useEffect(() => {
    if (!initialData.failed) return
    const timer = setTimeout(() => setSnapshot(readMirrorSnapshot()), 0)
    return () => clearTimeout(timer)
  }, [initialData.failed])

  const replaceLists = (lists: { cashboxes: Cashbox[]; transactions: any[] }) =>
    setSnapshot((current) => ({ ...current, ...lists }))

  return { snapshot, offline: snapshot.failed, replaceLists }
}
