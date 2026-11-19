'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useWatch } from 'react-hook-form'
import type { AssignableUser } from '@/components/shared/assignee-select'
import { invalidateProducts } from '@/lib/data/revalidate'
import { FALLBACK_UNITS } from '@/lib/units'
import { AmountField, CategoryField, ProfitPanel, StatusField, UnitField } from '../catalog-form/catalog-fields'
import { CatalogFormFrame, DescriptionField, TextField } from '../catalog-form/catalog-form-frame'
import {
  catalogDefaults,
  catalogSchema,
  type CatalogFormData,
  type ProductFormOptions,
} from '../catalog-form/catalog-form-schema'
import { catalogPayload, currentUserId, writeCatalogRow } from '../catalog-form/catalog-save'
import { useCatalogForm } from '../catalog-form/use-catalog-form'

const FORM_ID = 'service-form-v1'

interface ServiceFormProps {
  assignableUsers?: AssignableUser[]
  initialData?: any
  categories: { id: string; name: string }[]
  lang: string
  options: ProductFormOptions
}

async function saveService(supabase: any, data: CatalogFormData, initial: any) {
  const payload = catalogPayload(data, initial, await currentUserId(supabase), { is_service: true })
  await writeCatalogRow(supabase, payload, initial?.id)
}

export function ServiceForm({ initialData, categories, lang, options }: ServiceFormProps) {
  const t = useTranslations()
  const [defaultSku] = useState(() => initialData?.sku || options.nextSku || '')
  const { form, markup, submitting, onSubmit, exitForm } = useCatalogForm<CatalogFormData>({
    formId: FORM_ID,
    exitTo: `/${lang}/inventory/services`,
    initial: initialData,
    schema: catalogSchema(t('common.required')),
    defaults: catalogDefaults(initialData, defaultSku),
    save: (supabase, data) => saveService(supabase, data, initialData),
    afterSave: invalidateProducts,
  })
  const { control, register, formState } = form
  const [price, cost] = useWatch({ control, name: ['price', 'cost_price'] })
  const fields = { control, errors: formState.errors }

  return (
    <CatalogFormFrame
      onSubmit={onSubmit}
      onCancel={() => exitForm()}
      submitting={submitting}
      after={<DescriptionField register={register} />}
    >
      <TextField register={register} errors={formState.errors} name="name" label={t('inventory.serviceName')} required />
      <TextField register={register} errors={formState.errors} name="sku" label={t('inventory.sku')} required />
      <CategoryField {...fields} categories={categories} />
      <UnitField {...fields} units={options.units.length ? options.units : FALLBACK_UNITS} />
      <AmountField
        {...fields}
        name="cost_price"
        label={t('inventory.serviceCostPrice')}
        hint={t('inventory.serviceCostHint')}
        onAmountChange={markup.onBaseChange}
      />
      <AmountField {...fields} name="price" label={t('inventory.price')} onAmountChange={markup.onPriceChange} />
      <StatusField control={control} />
      <ProfitPanel price={Number(price) || 0} cost={Number(cost) || 0} />
    </CatalogFormFrame>
  )
}
