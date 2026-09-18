'use client'

import { useState } from 'react'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { Resolver, Controller } from 'react-hook-form'
import { formatCurrency } from '@/lib/utils'
import { FALLBACK_UNITS } from '@/lib/units'
import { usePersistedForm, clearPersistedForm } from '@/lib/hooks/use-persisted-form'
import { NumericInput } from '@/components/ui/numeric-input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateProducts } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import type { ProductFormOptions } from '@/components/inventory/product-form'

const FORM_ID = 'service-form-v1'

interface ServiceFormProps {
  /** Active tenant members who can be made responsible for this record. */
  assignableUsers: AssignableUser[]
  initialData?: any
  categories: any[]
  lang: string
  options: ProductFormOptions
}

/**
 * The service card — the product form minus everything a service cannot have.
 *
 * A service IS a `products` row with `is_service = true` (migration_services.sql),
 * so it is sold, invoiced and costed through exactly the same path as goods.
 * What it never has is a quantity on a shelf, which is why this form drops
 * stock, minimum stock, incoming cost, the image and the cost-layer bookkeeping
 * the product form does around a stock delta. `cost_price` stays: it is what
 * delivering the service costs the business, and it is the figure every sale of
 * it is charged at (`consume_cost_layers` returns it directly for a service).
 */
export function ServiceForm({ initialData, categories, lang, assignableUsers, options }: ServiceFormProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('inventory')
  const exitForm = useRouteModalExit(`/${lang}/inventory/services`)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const supabase = createClient() as any

  const innerFormSchema = z.object({
    name: z.string().min(1, tCommon('required')),
    sku: z.string().min(1, tCommon('required')),
    unit: z.string().min(1, tCommon('required')),
    price: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number().min(0, tCommon('required')).optional()
    ),
    cost_price: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number().min(0, tCommon('required')).optional()
    ),
    category_id: z.string().optional().nullable(),
    description: z.string().optional(),
    is_active: z.boolean().default(true),
  })

  type FormData = z.infer<typeof innerFormSchema>

  const units = options.units.length > 0 ? options.units : FALLBACK_UNITS

  // Services and goods share one sku sequence — `products.sku` is unique per
  // tenant across both, so they cannot be numbered independently.
  const [defaultSku] = useState(() => initialData?.sku || options.nextSku || '')

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = usePersistedForm<FormData>(FORM_ID, {
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: initialData?.name || '',
      sku: defaultSku,
      category_id: initialData?.category_id || '',
      unit: initialData?.unit || '',
      price: initialData?.price ?? '' as any,
      cost_price: initialData?.cost_price ?? '' as any,
      description: initialData?.description || '',
      is_active: initialData?.is_active ?? true,
    },
  })

  // Markup drives price from cost the same way the product form does: typing a
  // cost keeps the margin the user last set instead of silently changing it.
  const [markupState, setMarkupState] = useState<string>(() => {
    const price = Number(initialData?.price) || 0
    const cost = Number(initialData?.cost_price) || 0
    return cost > 0 ? (((price - cost) / cost) * 100).toFixed(1) : ''
  })
  const [markupAmountState, setMarkupAmountState] = useState<string>(() => {
    const price = Number(initialData?.price) || 0
    const cost = Number(initialData?.cost_price) || 0
    return cost > 0 ? (price - cost).toString() : ''
  })

  const priceNum = Number(watch('price')) || 0
  const costPriceNum = Number(watch('cost_price')) || 0
  const expectedProfit = priceNum - costPriceNum
  const marginPercent = priceNum > 0 ? (expectedProfit / priceNum) * 100 : 0

  const onSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      // Duplicate names are rejected across the whole table, not just among
      // services: a service and a product sharing a name would be impossible to
      // tell apart in the sales picker, which lists them together.
      let nameQuery = supabase.from('products').select('id').ilike('name', data.name.trim())
      if (initialData?.id) nameQuery = nameQuery.neq('id', initialData.id)
      const { data: existing, error: checkError } = await nameQuery
      if (checkError) throw checkError
      if (existing && existing.length > 0) throw new Error(t('nameExists'))

      const userRes = await supabase.auth.getUser()
      const userId: string | null = userRes.data?.user?.id ?? null

      const payload: Record<string, any> = {
        assigned_to: assignedTo ?? initialData?.assigned_to ?? userId,
        created_by: initialData?.created_by ?? userId,
        ...data,
        category_id: data.category_id || null,
        // What makes this row a service rather than a product. Stock stays at
        // the column default (0) and is never written again: no screen offers
        // to change it, and create_sale skips it for a service.
        is_service: true,
      }
      // supabase-js serializes an `undefined` value as an explicit null, which
      // violates these columns' NOT NULL defaults — the key has to go entirely.
      for (const key of Object.keys(payload)) {
        if (payload[key] === undefined) delete payload[key]
      }

      if (initialData?.id) {
        const { error } = await supabase.from('products').update(payload as any).eq('id', initialData.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert([payload as any])
        if (error) throw error
      }

      toast.success(tCommon('success'))
      await invalidateProducts()
      clearPersistedForm(FORM_ID)
      exitForm()
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('serviceName')} *</Label>
          <Input id="name" {...register('name')} placeholder={t('serviceName')} />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">{t('sku')} *</Label>
          <Input id="sku" {...register('sku')} placeholder={t('sku')} />
          {errors.sku && <p className="text-sm text-red-500">{errors.sku.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category_id">{t('category')}</Label>
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <Select value={field.value || 'none'} onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}>
                <SelectTrigger id="category_id" className="w-full">
                  <SelectValue placeholder={tCommon('select')}>
                    {field.value ? categories.find((c) => c.id === field.value)?.name : tCommon('select')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tCommon('select')}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.category_id && <p className="text-sm text-red-500">{errors.category_id.message}</p>}
        </div>

        <div className="space-y-2">
          {/* A service is still measured in something — an hour, a visit, a
              square metre — so the unit list is the same one goods use. */}
          <Label htmlFor="unit">{t('unit')} *</Label>
          <Controller
            control={control}
            name="unit"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="unit" className="w-full">
                  <SelectValue placeholder={tCommon('select')} />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.unit && <p className="text-sm text-red-500">{errors.unit.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost_price">{t('serviceCostPrice')}</Label>
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
                  if (markupState && !isNaN(Number(markupState))) {
                    const diff = cost * (Number(markupState) / 100)
                    setValue('price', Number((cost + diff).toFixed(2)) as any)
                    setMarkupAmountState(diff.toFixed(0))
                  } else if (markupAmountState && !isNaN(Number(markupAmountState))) {
                    const amt = Number(markupAmountState)
                    setValue('price', Number((cost + amt).toFixed(2)) as any)
                    if (cost > 0) setMarkupState(((amt / cost) * 100).toFixed(1))
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
          <p className="text-[11px] text-muted-foreground leading-snug">{t('serviceCostHint')}</p>
          {errors.cost_price && <p className="text-sm text-red-500">{errors.cost_price.message}</p>}
        </div>

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
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <Select value={field.value ? 'true' : 'false'} onValueChange={(val) => field.onChange(val === 'true')}>
                <SelectTrigger id="is_active" className="w-full">
                  <SelectValue>{field.value ? tCommon('active') : tCommon('inactive')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{tCommon('active')}</SelectItem>
                  <SelectItem value="false">{tCommon('inactive')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.is_active && <p className="text-sm text-red-500">{errors.is_active.message}</p>}
        </div>

        {costPriceNum > 0 && priceNum > 0 && (
          <div className="col-span-1 md:col-span-2 bg-linear-to-r from-slate-50 dark:from-slate-800 to-slate-100 dark:to-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-inner flex flex-wrap justify-between items-center gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex gap-8 flex-wrap">
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{t('expectedProfit')}</span>
                <span className={`text-lg font-bold tracking-tight ${expectedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatCurrency(expectedProfit)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{t('margin')}</span>
                <span className="text-lg font-bold text-sky-600 dark:text-sky-400 tracking-tight">
                  {marginPercent.toFixed(1)}%
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{t('markup')}</span>
                <span className="text-lg font-bold text-violet-600 dark:text-violet-400 tracking-tight">
                  {(((priceNum - costPriceNum) / costPriceNum) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{tCommon('description')}</Label>
        <Textarea id="description" {...register('description')} placeholder={tCommon('description')} rows={4} />
        {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
      </div>

      <div className="max-w-sm">
        <AssigneeSelect value={assignedTo} onChange={setAssignedTo} users={assignableUsers} />
      </div>

      <div className="flex gap-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => exitForm()} disabled={isSubmitting}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tCommon('loading') : tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
