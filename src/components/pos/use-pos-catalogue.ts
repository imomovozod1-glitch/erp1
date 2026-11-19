'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { filterCatalogue, findBySku } from '@/components/pos/pos-sale-model'

/** The product side of the till: live stock, search, category and the barcode scanner's Enter. */
export function usePosCatalogue(initialProducts: any[], onScan: (product: any | undefined) => void) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const searchRef = useRef<HTMLInputElement>(null)

  // Focused for a barcode scanner only where there is a keyboard — on touch it would raise the on-screen one.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) searchRef.current?.focus()
  }, [])

  // The till re-renders on every basket change; the catalogue need not be re-filtered each time.
  const visible = useMemo(() => filterCatalogue(products, search, category), [products, search, category])

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!search.trim()) return
    const product = findBySku(products, search)
    if (product) setSearch('')
    onScan(product)
  }

  return { products, setProducts, visible, search, setSearch, category, setCategory, searchRef, onSearchKeyDown }
}

export type PosCatalogue = ReturnType<typeof usePosCatalogue>
