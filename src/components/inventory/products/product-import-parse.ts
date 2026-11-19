import { resolveMeasurementUnit } from '@/lib/units'

// Shops name columns their own way ("Soni", "Qoldiq", "Кол-во" for stock), so each
// field accepts every common header, lowercased and apostrophe-normalised.
const HEADER_ALIASES = {
  name: ['nomi', 'nomlanishi', 'mahsulot', 'mahsulot nomi', 'tovar', 'name', 'product', 'наименование', 'название', 'товар'],
  sku: ['sku', 'artikul', 'kod', 'kodi', 'article', 'code', 'артикул', 'код'],
  price: ['sotuv narxi', 'sotish narxi', 'narxi', 'narx', 'chiqim', 'price', 'sale price', 'цена продажи', 'цена', 'продажа'],
  costPrice: ['tannarx', 'tannarxi', 'cost', 'cost price', 'cost_price', 'себестоимость'],
  incomingCost: ['kirim narxi', 'kirim cost', 'kirim', 'incoming_cost', 'incoming price', 'входящая цена', 'приход'],
  stock: ['zaxira', 'zaxirasi', 'soni', 'son', 'miqdor', 'miqdori', 'qoldiq', "qoldig'i", 'stock', 'quantity', 'qty', 'amount', 'запас', 'количество', 'кол-во', 'остаток'],
  minStock: ['minimal zaxira', 'min zaxira', 'minimal qoldiq', 'min_stock', 'min stock', 'minimum stock', 'мин. запас', 'минимальный запас', 'мин запас'],
  unit: ["o'lchov birligi", "o'lchov", 'birligi', 'birlik', 'unit', 'uom', 'ед. изм.', 'ед изм', 'единица измерения', 'единица'],
  description: ['tavsif', 'izoh', 'description', 'comment', 'описание', 'примечание'],
} as const

type Field = keyof typeof HEADER_ALIASES

const APOSTROPHES = /[ʻʼ‘’`´]/g
const TOTAL_ROWS = new Set(['jami', 'jami:', 'total', 'итого', 'итого:'])

export interface ImportedProduct {
  name: string
  sku: string
  price: number
  cost_price: number
  incoming_cost: number
  stock: number
  min_stock: number
  unit: string
  description: string
  is_active: true
}

export interface InvalidUnitRow {
  name: string
  unit: string
}

const headerKey = (header: string) => header.replace(APOSTROPHES, "'").toLowerCase().replace(/\s+/g, ' ').trim()

function normaliseHeaders(row: Record<string, unknown>) {
  const cells = new Map<string, unknown>()
  for (const [header, value] of Object.entries(row)) {
    const key = headerKey(String(header))
    if (!cells.has(key)) cells.set(key, value)
  }
  return cells
}

const isFilled = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== ''

const cellOf = (cells: Map<string, unknown>, field: Field) =>
  HEADER_ALIASES[field].map((alias) => cells.get(alias)).find(isFilled)

export function parseAmount(value: unknown): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  const amount = Number(String(value).replace(/so'm|сум|sum|usd|\$|\s/gi, '').replace(/,/g, ''))
  return Number.isNaN(amount) ? 0 : amount
}

const randomSku = () => `SKU-${Math.random().toString().slice(-6)}`

function productFrom(cells: Map<string, unknown>, name: string, unit: string): ImportedProduct {
  const text = (field: Field) => String(cellOf(cells, field) ?? '').trim()
  const amount = (field: Field) => parseAmount(cellOf(cells, field))
  const costPrice = amount('costPrice')
  return {
    name,
    sku: text('sku') || randomSku(),
    price: amount('price'),
    cost_price: costPrice,
    incoming_cost: isFilled(cellOf(cells, 'incomingCost')) ? amount('incomingCost') : costPrice,
    stock: amount('stock'),
    min_stock: amount('minStock'),
    unit,
    description: text('description'),
    is_active: true,
  }
}

export function parseProductRows(rows: Record<string, unknown>[], units: string[]) {
  const products: ImportedProduct[] = []
  const invalidUnits: InvalidUnitRow[] = []
  for (const row of rows) {
    const cells = normaliseHeaders(row)
    const name = String(cellOf(cells, 'name') ?? '')
    if (!name || TOTAL_ROWS.has(name.toLowerCase().trim())) continue
    const rawUnit = String(cellOf(cells, 'unit') ?? '').trim()
    const unit = rawUnit ? resolveMeasurementUnit(rawUnit, units) : null
    if (unit) products.push(productFrom(cells, name, unit))
    else invalidUnits.push({ name, unit: rawUnit })
  }
  return { products, invalidUnits }
}
