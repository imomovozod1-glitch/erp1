'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Resolver, Controller } from 'react-hook-form'
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  category_id: z.string().optional().nullable(),
  unit: z.string().min(1, 'Unit is required'),
  price: z.coerce.number().min(0),
  cost_price: z.coerce.number().min(0),
  incoming_cost: z.coerce.number().min(0),
  stock: z.coerce.number().min(0),
  min_stock: z.coerce.number().min(0),
  description: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface ProductFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: any[]
  lang: string
}

export function ProductForm({ initialData, categories, lang }: ProductFormProps) {
  const t = useTranslations('inventory')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const innerFormSchema = z.object({
    name: z.string().min(1, tCommon('required')),
    sku: z.string().min(1, tCommon('required')),
    unit: z.string().min(1, tCommon('required')),
    price: z.coerce.number().min(0, tCommon('required')),
    cost_price: z.coerce.number().min(0, tCommon('required')),
    incoming_cost: z.coerce.number().min(0, tCommon('required')),
    stock: z.coerce.number().min(0, tCommon('required')),
    min_stock: z.coerce.number().min(0, tCommon('required')),
    category_id: z.string().optional().nullable(),
    description: z.string().optional(),
  })

  const { register, handleSubmit, control, formState: { errors } } = usePersistedForm<FormData>('product-form', {
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: initialData?.name || '',
      sku: initialData?.sku || '',
      category_id: initialData?.category_id || '',
      unit: initialData?.unit || 'pcs',
      price: initialData?.price || 0,
      cost_price: initialData?.cost_price || 0,
      incoming_cost: initialData?.incoming_cost || 0,
      stock: initialData?.stock || 0,
      min_stock: initialData?.min_stock || 0,
      description: initialData?.description || '',
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      const payload = {
        ...data,
        category_id: data.category_id || null, // convert empty string to null
      }

      if (initialData?.id) {
        // Update
        const { error } = await supabase
          .from('products')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(payload as any)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(tCommon('success'))
      } else {
        // Create
        const { error } = await supabase
          .from('products')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert([payload as any])
        if (error) throw error
        toast.success(tCommon('success'))
      }
      await invalidateProducts()
      clearPersistedForm('product-form')
      router.push(`/${lang}/inventory/products`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          <Input id="unit" {...register('unit')} placeholder={t('unit')} />
          {errors.unit && <p className="text-sm text-red-500">{errors.unit.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">{t('price')} *</Label>
          <Controller
            control={control}
            name="price"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="price" value={value} onChange={onChange} />
            )}
          />
          {errors.price && <p className="text-sm text-red-500">{errors.price.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost_price">{t('costPrice')} *</Label>
          <Controller
            control={control}
            name="cost_price"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="cost_price" value={value} onChange={onChange} />
            )}
          />
          {errors.cost_price && <p className="text-sm text-red-500">{errors.cost_price.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="incoming_cost">{t('incomingCost')} *</Label>
          <Controller
            control={control}
            name="incoming_cost"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="incoming_cost" value={value} onChange={onChange} />
            )}
          />
          {errors.incoming_cost && <p className="text-sm text-red-500">{errors.incoming_cost.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock">{t('stock')} *</Label>
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
          <Label htmlFor="min_stock">{t('minStock')} *</Label>
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
