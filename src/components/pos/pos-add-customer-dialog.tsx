'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { AddressField } from '@/components/shared/address-field'
import { LabeledField } from '@/components/shared/labeled-field'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { errorMessage } from '@/lib/error-message'
import { isValidPhone } from '@/lib/phone-validation'
import { createClient } from '@/lib/supabase/client'

type Translate = (key: string) => string

const quickCustomerSchema = (t: Translate) =>
  z.object({
    name: z.string().trim().min(1, t('common.required')),
    phone: z.string().trim().refine((v) => !v || isValidPhone(v), t('auth.invalidPhone')),
    address: z.string().trim(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
  })

type QuickCustomer = z.infer<ReturnType<typeof quickCustomerSchema>>

const EMPTY: QuickCustomer = { name: '', phone: '', address: '', latitude: null, longitude: null }

async function insertCustomer(values: QuickCustomer) {
  const { data, error } = await (createClient() as any)
    .from('customers')
    .insert({ ...values, phone: values.phone || null, address: values.address || null, is_active: true })
    .select()
    .single()
  if (error) throw error
  return data
}

interface PosAddCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (customer: any) => void
}

/** "New customer" straight from the till; the till only ever receives the saved row. */
export function PosAddCustomerDialog({ open, onOpenChange, onCreated }: PosAddCustomerDialogProps) {
  const t = useTranslations()
  const [saving, setSaving] = useState(false)
  const form = useForm<QuickCustomer>({ resolver: zodResolver(quickCustomerSchema(t)), defaultValues: EMPTY })
  const errors = form.formState.errors

  const submit = async (values: QuickCustomer) => {
    setSaving(true)
    try {
      onCreated(await insertCustomer(values))
      toast.success(t('common.success'))
      onOpenChange(false)
      form.reset(EMPTY)
      await invalidateCustomers()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{t('pos.quickAddCustomer')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4 pt-2">
          <LabeledField id="custName" label={`${t('pos.customerName')} *`} error={errors.name?.message}>
            <Input id="custName" {...form.register('name')} placeholder={t('sales.customerNamePlaceholder')} />
          </LabeledField>
          <LabeledField id="custPhone" label={t('pos.customerPhone')} error={errors.phone?.message}>
            <Controller control={form.control} name="phone" render={({ field }) => <PhoneInput id="custPhone" value={field.value} onChange={field.onChange} />} />
          </LabeledField>
          <AddressField form={form} label={t('pos.customerAddress')} placeholder={t('sales.addressPlaceholder')} />
          <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {t(saving ? 'common.saving' : 'common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
