export interface Markup {
  percent: string
  amount: string
}

const isNumeric = (value: string) => value !== '' && !Number.isNaN(Number(value))
const round2 = (value: number) => Number(value.toFixed(2))

export function markupBetween(price: number, base: number): Markup {
  if (base <= 0) return { percent: '', amount: '' }
  const diff = price - base
  return { percent: ((diff / base) * 100).toFixed(1), amount: diff.toString() }
}

export interface Repricing {
  price?: number
  markup: Markup
}

/**
 * A new cost keeps whatever markup the price already carried: by percent if one
 * is known, by amount otherwise; with neither, the current price stays and the
 * markup is read off it.
 */
export function repriceForBase(base: number, markup: Markup, currentPrice: number): Repricing {
  if (isNumeric(markup.percent)) {
    const diff = base * (Number(markup.percent) / 100)
    return { price: round2(base + diff), markup: { percent: markup.percent, amount: diff.toFixed(0) } }
  }
  if (isNumeric(markup.amount)) {
    const amount = Number(markup.amount)
    const percent = base > 0 ? ((amount / base) * 100).toFixed(1) : markup.percent
    return { price: round2(base + amount), markup: { percent, amount: markup.amount } }
  }
  return { markup: base > 0 && currentPrice > 0 ? markupBetween(currentPrice, base) : markup }
}

export interface ProfitSummary {
  profit: number
  margin: number
  markup: number
}

export function profitSummary(price: number, cost: number): ProfitSummary | null {
  if (price <= 0 || cost <= 0) return null
  const profit = price - cost
  return { profit, margin: (profit / price) * 100, markup: (profit / cost) * 100 }
}
