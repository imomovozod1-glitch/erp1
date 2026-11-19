'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useWatch } from 'react-hook-form'
import { ImageUpload } from '@/components/shared/image-upload'
import type { AssignableUser } from '@/components/shared/assignee-select'
import { invalidateMovements, invalidateProducts } from '@/lib/data/revalidate'
import { FALLBACK_UNITS, unitAllowsDecimals } from '@/lib/units'
import { AmountField, CategoryField, ProfitPanel, StatusField, UnitField } from '../catalog-form/catalog-fields'
import { CatalogFormFrame, DescriptionField, TextField } from '../catalog-form/catalog-form-frame'
import {
  productDefaults,
  productSchema,
  type ProductFormData,
  type ProductFormOptions,
} from '../catalog-form/catalog-form-schema'
import { useCatalogForm } from '../catalog-form/use-catalog-form'
import { saveProduct } from './product-save'

export type { ProductFormOptions }

const FORM_ID = 'product-form-v3'

interface ProductFormProps {
  assignableUsers?: AssignableUser[]
  initialData?: any
  categories: { id: string; name: string }[]
  lang: string
  options: ProductFormOptions
}

export function ProductForm({ initialData, categories, lang, options }: ProductFormProps) {
  const t = useTranslations()
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.image_url ?? null)
  const [defaultSku] = useState(() => initialData?.sku || options.nextSku || '')
  const { form, markup, submitting, onSubmit, exitForm } = useCatalogForm<ProductFormData>({
    formId: FORM_ID,
    exitTo: `/${lang}/inventory/products`,
    initial: initialData,
    schema: productSchema(t('common.required')),
    defaults: productDefaults(initialData, defaultSku),
    save: (supabase, data) => saveProduct({ supabase, data, initial: initialData, imageUrl }),
    afterSave: async () => {
      await invalidateProducts()
      await invalidateMovements()
    },
  })
  const { control, register, formState } = form
  const [price, cost, unit] = useWatch({ control, name: ['price', 'cost_price', 'unit'] })
  const fields = { control, errors: formState.errors }
  const decimals = unitAllowsDecimals(unit)

  return (
    <CatalogFormFrame
      onSubmit={onSubmit}
      onCancel={() => exitForm()}
      submitting={submitting}
      after={
        <>
          <div className="max-w-md">
            <ImageUpload value={imageUrl} onChange={setImageUrl} label={t('inventory.productImage')} disabled={submitting} />
          </div>
          <DescriptionField register={register} />
        </>
      }
    >
      <TextField register={register} errors={formState.errors} name="name" label={t('inventory.productName')} required />
      <TextField register={register} errors={formState.errors} name="sku" label={t('inventory.sku')} required />
      <CategoryField {...fields} categories={categories} />
      <UnitField {...fields} units={options.units.length ? options.units : FALLBACK_UNITS} />
      <AmountField {...fields} name="incoming_cost" label={t('inventory.incomingCost')} onAmountChange={markup.onBaseChange} />
      <AmountField {...fields} name="cost_price" label={t('inventory.costPrice')} onAmountChange={markup.onBaseChange} />
      <AmountField {...fields} name="price" label={t('inventory.price')} onAmountChange={markup.onPriceChange} />
      <StatusField control={control} />
      <ProfitPanel
        price={Number(price) || 0}
        cost={Number(cost) || 0}
        note={options.costingMethod === 'aveco' ? undefined : t('inventory.averageCostEstimate')}
      />
      <AmountField {...fields} name="stock" label={t('inventory.stock')} allowDecimals={decimals} />
      <AmountField {...fields} name="min_stock" label={t('inventory.minStock')} allowDecimals={decimals} />
    </CatalogFormFrame>
  )
}
