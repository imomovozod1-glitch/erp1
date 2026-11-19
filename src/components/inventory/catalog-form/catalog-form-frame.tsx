'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormFooter } from '@/components/shared/form-footer'
import { LabeledField } from '@/components/shared/labeled-field'

interface CatalogFormFrameProps {
  onSubmit: () => void
  onCancel: () => void
  submitting: boolean
  children: ReactNode
  after?: ReactNode
}

export function CatalogFormFrame({ onSubmit, onCancel, submitting, children, after }: CatalogFormFrameProps) {
  const t = useTranslations('common')
  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border bg-card p-4 shadow-sm md:rounded-xl md:p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{children}</div>
      {after}
      <FormFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {t(submitting ? 'loading' : 'save')}
        </Button>
      </FormFooter>
    </form>
  )
}

interface RegisteredProps {
  register: UseFormRegister<any>
  errors: FieldErrors
}

export function TextField({ register, errors, name, label, required }: RegisteredProps & { name: string; label: string; required?: boolean }) {
  return (
    <LabeledField id={name} label={label} required={required} error={errors[name]?.message as string | undefined}>
      <Input id={name} {...register(name)} placeholder={label} />
    </LabeledField>
  )
}

export function DescriptionField({ register }: Pick<RegisteredProps, 'register'>) {
  const t = useTranslations('common')
  return (
    <LabeledField id="description" label={t('description')}>
      <Textarea id="description" {...register('description')} placeholder={t('description')} rows={4} />
    </LabeledField>
  )
}
