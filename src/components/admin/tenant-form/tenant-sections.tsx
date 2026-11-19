'use client'

import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Controller, useWatch } from 'react-hook-form'
import { Building2, ReceiptText, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { PasswordInput } from '@/components/ui/password-input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdminField, AdminFormSection } from '@/components/admin/admin-form-layout'
import { DURATION_PRESETS, LICENSE_COUNT_PRESETS, PresetPicker } from '@/components/admin/preset-picker'
import { formatDate } from '@/lib/utils'
import type { TenantFormInitialData } from './tenant-schema'
import type { TenantFormState } from './use-tenant-form'

const COSTING = ['fifo', 'lifo', 'aveco'] as const

function Field({ id, label, error, hint, wide, children }: { id?: string; label: string; error?: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <AdminField wide={wide}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-red-500">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </AdminField>
  )
}

function ReadOnly({ children }: { children: ReactNode }) {
  return <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-foreground">{children}</div>
}

export function BasicsSection({ state, create }: { state: TenantFormState; create: boolean }) {
  const t = useTranslations()
  const { register, control, formState } = state.form
  const errors = formState.errors
  return (
    <AdminFormSection icon={Building2} title={t('admin.form.sectionBasics')} description={t('admin.form.sectionBasicsHint')}>
      <Field id="company_name" label={t('admin.form.companyName')} error={errors.company_name?.message}>
        <Input id="company_name" placeholder={t('admin.form.companyNamePlaceholder')} {...register('company_name')} />
      </Field>
      <Field id="subdomain" label={t('admin.form.subdomain')} error={errors.subdomain?.message} hint={t('admin.form.subdomainHint')}>
        <Input id="subdomain" placeholder={t('admin.form.subdomainPlaceholder')} {...register('subdomain')} />
      </Field>
      <Field id="phone" label={t('admin.form.phone')} error={errors.phone?.message}>
        <Controller control={control} name="phone" render={({ field }) => <PhoneInput id="phone" placeholder={t('admin.form.phonePlaceholder')} value={field.value ?? ''} onChange={field.onChange} hasError={!!errors.phone} />} />
      </Field>
      {create && (
        <Field id="password" label={t('admin.form.password')} error={errors.password?.message} hint={t('auth.passwordRequirements')}>
          <PasswordInput id="password" placeholder={t('admin.form.passwordPlaceholder')} showLabel={t('admin.password.show')} hideLabel={t('admin.password.hide')} {...register('password')} />
        </Field>
      )}
    </AdminFormSection>
  )
}

/** Editing only shows the subscription; it moves through a payment, and the costing method is frozen at creation. */
export function EditSubscription({ initial, onPay }: { initial: TenantFormInitialData; onPay: () => void }) {
  const t = useTranslations('admin')
  const tCosting = useTranslations('inventory')
  return (
    <AdminFormSection icon={ReceiptText} title={t('form.sectionSubscription')} description={t('tenants.detail.paymentDialogDesc')}>
      <Field label={t('form.costingMethod')} hint={t('tenants.detail.costingLockedHint')}>
        <ReadOnly>{tCosting(initial.costing_method)}</ReadOnly>
      </Field>
      <Field label={t('form.subscriptionEnd')}>
        <ReadOnly>{initial.subscription_ends_at ? formatDate(initial.subscription_ends_at) : '—'}</ReadOnly>
      </Field>
      <AdminField>
        <Label className="invisible hidden sm:block">&nbsp;</Label>
        <Button type="button" onClick={onPay} className="w-full gap-2 sm:w-auto">
          <Wallet className="size-4" /> {t('tenants.detail.makePayment')}
        </Button>
      </AdminField>
    </AdminFormSection>
  )
}

function CostingField({ state }: { state: TenantFormState }) {
  const t = useTranslations('admin')
  const tCosting = useTranslations('inventory')
  return (
    <Field label={t('form.costingMethod')} hint={t('tenants.detail.costingLockedHint')}>
      <Controller
        control={state.form.control}
        name="costing_method"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger className="w-full">
              <SelectValue>{tCosting(field.value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COSTING.map((method) => (
                <SelectItem key={method} value={method}>
                  {tCosting(method)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}

export function CreateSubscription({ state }: { state: TenantFormState }) {
  const t = useTranslations('admin.form')
  const lang = useLocale()
  const { control, formState, setValue } = state.form
  const errors = formState.errors
  const endDate = useWatch({ control, name: 'subscription_ends_at' })
  return (
    <AdminFormSection icon={ReceiptText} title={t('sectionSubscription')} description={t('sectionSubscriptionHint')}>
      <CostingField state={state} />
      <Field wide label={t('licenseCount')} error={errors.license_count?.message}>
        <Controller control={control} name="license_count" render={({ field }) => <PresetPicker value={field.value} options={LICENSE_COUNT_PRESETS} onSelect={(v) => setValue('license_count', v, { shouldValidate: true })} customLabel={t('custom')} />} />
      </Field>
      <Field wide label={t('licenseMonths')} error={errors.license_months?.message}>
        <Controller control={control} name="license_months" render={({ field }) => <PresetPicker value={field.value} options={DURATION_PRESETS} onSelect={state.setDuration} customLabel={t('custom')} suffix={t('months')} />} />
      </Field>
      <Field id="subscription_started_at" label={t('subscriptionStart')} error={errors.subscription_started_at?.message}>
        <Controller control={control} name="subscription_started_at" render={({ field }) => <DatePicker id="subscription_started_at" value={field.value} onChange={state.setStart} lang={lang} placeholder={t('selectDatePlaceholder')} />} />
      </Field>
      <Field label={t('subscriptionEnd')} error={errors.subscription_ends_at?.message}>
        <ReadOnly>{endDate ? formatDate(endDate) : '—'}</ReadOnly>
      </Field>
      <Field id="price_paid" label={t('initialPayment')} error={errors.price_paid?.message}>
        <Controller control={control} name="price_paid" render={({ field }) => <NumericInput id="price_paid" placeholder="0" value={field.value ?? undefined} onChange={field.onChange} />} />
      </Field>
    </AdminFormSection>
  )
}
