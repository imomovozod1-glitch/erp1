'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import type { DefaultValues, FieldValues, Resolver } from 'react-hook-form'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'
import { clearPersistedForm, usePersistedForm } from '@/lib/hooks/use-persisted-form'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { nameTaken } from './catalog-save'
import { useMarkup } from './use-markup'

interface CatalogFormConfig<T extends FieldValues> {
  formId: string
  exitTo: string
  initial: any
  schema: Parameters<typeof zodResolver>[0]
  defaults: DefaultValues<T>
  save: (supabase: any, data: T) => Promise<void>
  afterSave: () => Promise<void>
}

export function useCatalogForm<T extends FieldValues>(config: CatalogFormConfig<T>) {
  const t = useTranslations()
  const exitForm = useRouteModalExit(config.exitTo)
  const [submitting, setSubmitting] = useState(false)
  const form = usePersistedForm<T>(config.formId, {
    resolver: zodResolver(config.schema) as unknown as Resolver<T>,
    defaultValues: config.defaults,
  })
  const amount = (name: string) => Number(form.getValues(name as any)) || 0
  const markup = useMarkup(config.initial, {
    getPrice: () => amount('price'),
    getCost: () => amount('cost_price'),
    setPrice: (price) => form.setValue('price' as any, price as any),
  })

  const submit = async (data: T) => {
    setSubmitting(true)
    try {
      const supabase = createClient()
      if (await nameTaken(supabase, String(data.name), config.initial?.id)) return void toast.error(t('inventory.nameExists'))
      await config.save(supabase, data)
      toast.success(t('common.success'))
      await config.afterSave()
      clearPersistedForm(config.formId)
      exitForm()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      setSubmitting(false)
    }
  }

  return { form, markup, submitting, onSubmit: form.handleSubmit(submit), exitForm }
}
