'use client'

import { useState } from 'react'
import { markupBetween, repriceForBase, type Markup } from './catalog-pricing'

interface MarkupFormApi {
  getPrice: () => number
  getCost: () => number
  setPrice: (price: number) => void
}

export function useMarkup(initial: any, form: MarkupFormApi) {
  const [markup, setMarkup] = useState<Markup>(() =>
    markupBetween(Number(initial?.price) || 0, Number(initial?.cost_price) || 0)
  )

  const onBaseChange = (base: number) => {
    const next = repriceForBase(base, markup, form.getPrice())
    if (next.price !== undefined) form.setPrice(next.price)
    setMarkup(next.markup)
  }

  const onPriceChange = (price: number) => {
    const cost = form.getCost()
    if (cost > 0) setMarkup(markupBetween(price, cost))
  }

  return { onBaseChange, onPriceChange }
}
