import * as z from 'zod'

export interface ProductFormOptions {
  units: string[]
  costingMethod: string | null
  nextSku: string
}

const isBlank = (value: unknown) => value === '' || value === undefined || value === null

const optionalAmount = (message: string) =>
  z.preprocess((value) => (isBlank(value) ? undefined : Number(value)), z.number().min(0, message).optional())

export function catalogSchema(required: string) {
  return z.object({
    name: z.string().min(1, required),
    sku: z.string().min(1, required),
    unit: z.string().min(1, required),
    price: optionalAmount(required),
    cost_price: optionalAmount(required),
    category_id: z.string().optional().nullable(),
    description: z.string().optional(),
    is_active: z.boolean().default(true),
  })
}

export function productSchema(required: string) {
  return catalogSchema(required)
    .extend({
      incoming_cost: optionalAmount(required),
      stock: optionalAmount(required),
      min_stock: optionalAmount(required),
    })
    .refine((data) => data.stock === undefined || data.cost_price !== undefined, {
      message: required,
      path: ['cost_price'],
    })
}

export type CatalogFormData = z.infer<ReturnType<typeof catalogSchema>>
export type ProductFormData = z.infer<ReturnType<typeof productSchema>>

const amountOrBlank = (value: unknown) => (value ?? '') as unknown as number

export const catalogDefaults = (initial: any, sku: string): CatalogFormData => ({
  name: initial?.name || '',
  sku,
  category_id: initial?.category_id || '',
  unit: initial?.unit || '',
  price: amountOrBlank(initial?.price),
  cost_price: amountOrBlank(initial?.cost_price),
  description: initial?.description || '',
  is_active: initial?.is_active ?? true,
})

export const productDefaults = (initial: any, sku: string): ProductFormData => ({
  ...catalogDefaults(initial, sku),
  incoming_cost: amountOrBlank(initial?.incoming_cost),
  stock: amountOrBlank(initial?.stock),
  min_stock: amountOrBlank(initial?.min_stock),
})
