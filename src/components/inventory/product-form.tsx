'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Resolver, Controller } from 'react-hook-form'
import { formatCurrency } from '@/lib/utils'
import { usePersistedForm, clearPersistedForm } from '@/lib/hooks/use-persisted-form'
import { NumericInput } from '@/components/ui/numeric-input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateProducts, invalidateMovements } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ProductFormProps {
  initialData?: any
  categories: any[]
  lang: string
}

export function ProductForm({ initialData, categories, lang }: ProductFormProps) {
  const t = useTranslations('inventory')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any

  const innerFormSchema = z.object({
    name: z.string().min(1, tCommon('required')),
    sku: z.string().min(1, tCommon('required')),
    unit: z.string().min(1, tCommon('required')),
    price: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number({ message: tCommon('required') }).min(0, tCommon('required'))
    ),
    cost_price: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number({ message: tCommon('required') }).min(0, tCommon('required'))
    ),
    incoming_cost: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number({ message: tCommon('required') }).min(0, tCommon('required'))
    ),
    stock: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number({ message: tCommon('required') }).min(0, tCommon('required'))
    ),
    min_stock: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number({ message: tCommon('required') }).min(0, tCommon('required'))
    ),
    category_id: z.string().optional().nullable(),
    description: z.string().optional(),
    is_active: z.boolean().default(true),
  })

  type FormData = z.infer<typeof innerFormSchema>

  const [units, setUnits] = useState<string[]>([])

  useEffect(() => {
    const defaultUnits = [t('piece'), t('kg'), t('liter'), t('meter'), t('package'), t('ton')]
    try {
      const saved = localStorage.getItem('measurement_units')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allUnits = Array.from(new Set([...defaultUnits, ...parsed]))
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setUnits(allUnits)
          return
        }
      }
    } catch (e) {
      console.error(e)
    }
    setUnits(defaultUnits)
  }, [t])

  const [defaultSku] = useState(() => initialData?.sku || Math.floor(1000 + Math.random() * 9000).toString())

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = usePersistedForm<FormData>('product-form-v3', {
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: initialData?.name || '',
      sku: defaultSku,
      category_id: initialData?.category_id || '',
      unit: initialData?.unit || '',
      price: initialData?.price ?? '' as any,
      cost_price: initialData?.cost_price ?? '' as any,
      incoming_cost: initialData?.incoming_cost ?? '' as any,
      stock: initialData?.stock ?? '' as any,
      min_stock: initialData?.min_stock ?? '' as any,
      description: initialData?.description || '',
      is_active: initialData?.is_active ?? true,
    },
  })

  const [markupState, setMarkupState] = useState<string>(() => {
    if (initialData) {
      const price = Number(initialData.price) || 0
      const cost = Number(initialData.cost_price) || 0
      if (cost > 0) {
        const diff = price - cost
        return ((diff / cost) * 100).toFixed(1)
      }
    }
    return ''
  })
  const [markupAmountState, setMarkupAmountState] = useState<string>(() => {
    if (initialData) {
      const price = Number(initialData.price) || 0
      const cost = Number(initialData.cost_price) || 0
      if (cost > 0) {
        const diff = price - cost
        return diff.toString()
      }
    }
    return ''
  })

  const priceVal = watch('price')
  const costPriceVal = watch('cost_price')

  const priceNum = Number(priceVal) || 0
  const costPriceNum = Number(costPriceVal) || 0
  const expectedProfit = priceNum - costPriceNum
  const marginPercent = priceNum > 0 ? (expectedProfit / priceNum) * 100 : 0

  const onSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      // Check for duplicate product names (case-insensitive)
      let nameQuery = supabase
        .from('products')
        .select('id')
        .ilike('name', data.name.trim())

      if (initialData?.id) {
        nameQuery = nameQuery.neq('id', initialData.id)
      }

      const { data: existing, error: checkError } = await nameQuery
      if (checkError) throw checkError

      if (existing && existing.length > 0) {
        throw new Error(t('nameExists'))
      }

      const payload = {
        ...data,
        category_id: data.category_id || null, // convert empty string to null
      }

      let userId: string | null = null
      const userRes = await supabase.auth.getUser()
      if (userRes.data?.user) userId = userRes.data.user.id

      if (initialData?.id) {
        // Update
        const stockBefore = Number(initialData.stock) || 0
        const stockAfter = Number(payload.stock) || 0

        const { error } = await supabase
          .from('products')
          .update(payload as any)
          .eq('id', initialData.id)
        if (error) throw error

        if (stockBefore !== stockAfter) {
          const diff = stockAfter - stockBefore
          const { error: moveErr } = await supabase.from('stock_movements').insert({
            product_id: initialData.id,
            type: diff > 0 ? 'in' : 'out',
            quantity: Math.abs(diff),
            quantity_before: stockBefore,
            quantity_after: stockAfter,
            reference_type: 'product_adjustment',
            reason: 'Manual adjustment in product form',
            created_by: userId
          })
          if (moveErr) console.error('Error inserting stock movement:', moveErr)
        }

        toast.success(tCommon('success'))
      } else {
        // Create
        const { data: newProds, error } = await supabase
          .from('products')
          .insert([payload as any])
          .select()
        if (error) throw error

        const newProd = newProds?.[0]
        const initialStock = Number(payload.stock) || 0
        if (initialStock > 0 && newProd) {
          const { error: moveErr } = await supabase.from('stock_movements').insert({
            product_id: newProd.id,
            type: 'in',
            quantity: initialStock,
            quantity_before: 0,
            quantity_after: initialStock,
            reference_type: 'initial_stock',
            reason: 'Initial stock on product creation',
            created_by: userId
          })
          if (moveErr) console.error('Error inserting initial stock movement:', moveErr)
        }

        toast.success(tCommon('success'))
      }
      await invalidateProducts()
      await invalidateMovements()
      clearPersistedForm('product-form-v3')
      router.push(`/${lang}/inventory/products`)
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl bg-white p-6 rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('productName')} *</Label>
          <Input id="name" {...register('name')} placeholder={t('productName')} />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">{t('sku')} *</Label>
          <Input id="sku" {...register('sku')} placeholder={t('sku')} />
          {errors.sku && <p className="text-sm text-red-500">{errors.sku.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category_id">{t('category')}</Label>
          <select 
            id="category_id" 
            {...register('category_id')}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            <option value="">{tCommon('select')}</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.category_id && <p className="text-sm text-red-500">{errors.category_id.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">{t('unit')} *</Label>
          {/* <Input id="unit" {...register('unit')} placeholder={t('unit')} /> */}
                    <select 
            id="unit" 
            {...register('unit')}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            <option value="">{tCommon('select')}</option>
            {units.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          {errors.unit && <p className="text-sm text-red-500">{errors.unit.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="incoming_cost">{t('incomingCost')}</Label>
          <Controller
            control={control}
            name="incoming_cost"
            render={({ field: { onChange, value } }) => (
              <NumericInput 
                id="incoming_cost" 
                value={value} 
                onChange={(val) => {
                  onChange(val)
                  const incoming = Number(val) || 0
                  
                  // Auto sync cost_price to incoming_cost
                  setValue('cost_price', val as any)
                  
                  // Recalculate price if markupState exists
                  if (markupState && !isNaN(Number(markupState))) {
                    const pct = Number(markupState)
                    const diff = incoming * (pct / 100)
                    setValue('price', Number((incoming + diff).toFixed(2)) as any)
                    setMarkupAmountState(diff.toFixed(0))
                  } else if (markupAmountState && !isNaN(Number(markupAmountState))) {
                    const amt = Number(markupAmountState)
                    setValue('price', Number((incoming + amt).toFixed(2)) as any)
                    if (incoming > 0) {
                      setMarkupState(((amt / incoming) * 100).toFixed(1))
                    }
                  } else {
                    const currentPrice = Number(watch('price')) || 0
                    if (incoming > 0 && currentPrice > 0) {
                      const diff = currentPrice - incoming
                      setMarkupAmountState(diff.toString())
                      setMarkupState(((diff / incoming) * 100).toFixed(1))
                    }
                  }
                }} 
              />
            )}
          />
          {errors.incoming_cost && <p className="text-sm text-red-500">{errors.incoming_cost.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost_price">{t('costPrice')}</Label>
          <Controller
            control={control}
            name="cost_price"
            render={({ field: { onChange, value } }) => (
              <NumericInput 
                id="cost_price" 
                value={value} 
                onChange={(val) => {
                  onChange(val)
                  const cost = Number(val) || 0
                  
                  // Recalculate price if markupState exists
                  if (markupState && !isNaN(Number(markupState))) {
                    const pct = Number(markupState)
                    const diff = cost * (pct / 100)
                    setValue('price', Number((cost + diff).toFixed(2)) as any)
                    setMarkupAmountState(diff.toFixed(0))
                  } else if (markupAmountState && !isNaN(Number(markupAmountState))) {
                    const amt = Number(markupAmountState)
                    setValue('price', Number((cost + amt).toFixed(2)) as any)
                    if (cost > 0) {
                      setMarkupState(((amt / cost) * 100).toFixed(1))
                    }
                  } else {
                    const currentPrice = Number(watch('price')) || 0
                    if (cost > 0 && currentPrice > 0) {
                      const diff = currentPrice - cost
                      setMarkupAmountState(diff.toString())
                      setMarkupState(((diff / cost) * 100).toFixed(1))
                    }
                  }
                }} 
              />
            )}
          />
          {errors.cost_price && <p className="text-sm text-red-500">{errors.cost_price.message}</p>}
        </div>

        {/* <div className="space-y-2">
          <Label htmlFor="markup">{t('markup')}</Label>
          <Input 
            id="markup" 
            type="number"
            value={markupState}
            onChange={(e) => {
              const val = e.target.value
              setMarkupState(val)
              
              if (val === '') {
                setMarkupAmountState('')
                return
              }

              const pct = Number(val)
              const currentCost = Number(watch('cost_price')) || 0
              if (currentCost > 0) {
                const diff = currentCost * (pct / 100)
                setMarkupAmountState(diff.toFixed(0))
                setValue('price', Number((currentCost + diff).toFixed(2)) as any)
              }
            }}
            placeholder="0"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
        </div> */}

        {/* <div className="space-y-2">
          <Label htmlFor="markup_amount">{t('markupAmount')}</Label>
          <NumericInput 
            id="markup_amount"
            value={markupAmountState === '' ? '' : Number(markupAmountState)}
            onChange={(val) => {
              const strVal = val === '' ? '' : val.toString()
              setMarkupAmountState(strVal)
              
              if (val === '') {
                setMarkupState('')
                return
              }

              const amt = Number(val)
              const currentCost = Number(watch('cost_price')) || 0
              if (currentCost > 0) {
                const pct = (amt / currentCost) * 100
                setMarkupState(pct.toFixed(1))
                setValue('price', Number((currentCost + amt).toFixed(2)) as any)
              }
            }}
          />
        </div> */}

        <div className="space-y-2">
          <Label htmlFor="price">{t('price')}</Label>
          <Controller
            control={control}
            name="price"
            render={({ field: { onChange, value } }) => (
              <NumericInput 
                id="price" 
                value={value} 
                onChange={(val) => {
                  onChange(val)
                  const price = Number(val) || 0
                  const cost = Number(watch('cost_price')) || 0
                  if (cost > 0) {
                    const diff = price - cost
                    setMarkupAmountState(diff.toString())
                    setMarkupState(((diff / cost) * 100).toFixed(1))
                  }
                }} 
              />
            )}
          />
          {errors.price && <p className="text-sm text-red-500">{errors.price.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="is_active">{tCommon('status')}</Label>
          <select 
            id="is_active" 
            {...register('is_active', { setValueAs: (v) => v === 'true' })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            <option value="true">{tCommon('active')}</option>
            <option value="false">{tCommon('inactive')}</option>
          </select>
          {errors.is_active && <p className="text-sm text-red-500">{errors.is_active.message}</p>}
        </div>

        {costPriceNum > 0 && priceNum > 0 && (
          <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200/60 shadow-inner flex flex-wrap justify-between items-center gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex gap-8 flex-wrap">
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">{t('expectedProfit')}</span>
                <span className={`text-lg font-bold tracking-tight ${expectedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(expectedProfit)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">{t('margin')}</span>
                <span className="text-lg font-bold text-sky-600 tracking-tight">
                  {marginPercent.toFixed(1)}%
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">{t('markup')}</span>
                <span className="text-lg font-bold text-violet-600 tracking-tight">
                  {(((priceNum - costPriceNum) / costPriceNum) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="hidden sm:block text-slate-400 text-xs italic">
              * Auto-calculated based on Cost and Price
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="stock">{t('stock')}</Label>
          <Controller
            control={control}
            name="stock"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="stock" value={value} onChange={onChange} />
            )}
          />
          {errors.stock && <p className="text-sm text-red-500">{errors.stock.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="min_stock">{t('minStock')}</Label>
          <Controller
            control={control}
            name="min_stock"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="min_stock" value={value} onChange={onChange} />
            )}
          />
          {errors.min_stock && <p className="text-sm text-red-500">{errors.min_stock.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{tCommon('description')}</Label>
        <Textarea id="description" {...register('description')} placeholder={tCommon('description')} rows={4} />
        {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
      </div>

      <div className="flex gap-4 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${lang}/inventory/products`)}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tCommon('loading') : tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
