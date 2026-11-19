'use client'

import { Loader2 } from 'lucide-react'
import { useWatch } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormAmountField, FormDateField } from '@/components/shared/form-controls'
import { FormFooter } from '@/components/shared/form-footer'
import { LabeledField } from '@/components/shared/labeled-field'
import { NameSelect } from '@/components/shared/name-select'
import { EmployeeAccessSection } from './employee-access-section'
import type { EmployeeFormOptions } from './employee-schema'
import { useEmployeeForm, type EmployeeFormState } from './use-employee-form'

export type { EmployeeFormOptions } from './employee-schema'

interface EmployeeFormProps {
  initialData?: any
  lang: string
  options: EmployeeFormOptions
}

function MainFields({ state, options, lang }: { state: EmployeeFormState; options: EmployeeFormOptions; lang: string }) {
  const t = useTranslations()
  const { register, control, formState } = state.form
  const errors = formState.errors
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <LabeledField id="full_name" label={t('common.name')} error={errors.full_name?.message}>
        <Input id="full_name" {...register('full_name')} placeholder={t('common.name')} />
      </LabeledField>
      <LabeledField id="employee_code" label={t('hr.employeeCode')} error={errors.employee_code?.message}>
        <Input id="employee_code" {...register('employee_code')} />
      </LabeledField>
      <LabeledField id="position" label={t('hr.position')} error={errors.position?.message}>
        <Input id="position" {...register('position')} />
      </LabeledField>
      <FormAmountField control={control} name="salary" label={t('hr.salary')} error={errors.salary?.message} />
      <FormDateField control={control} name="hired_at" label={t('hr.hiredAt')} error={errors.hired_at?.message} lang={lang} />
      <LabeledField id="cashbox" label={t('hr.cashbox')}>
        <NameSelect
          id="cashbox"
          value={state.cashboxId ?? ''}
          onChange={(id) => state.setCashboxId(id || null)}
          options={options.cashboxes}
          placeholder={t('hr.cashboxAuto')}
          clearLabel={t('hr.cashboxAuto')}
        />
        <p className="text-xs text-muted-foreground">{t('hr.cashboxHint')}</p>
      </LabeledField>
    </div>
  )
}

function ActiveFields({ state, lang }: { state: EmployeeFormState; lang: string }) {
  const t = useTranslations('hr')
  const { control, formState } = state.form
  const active = useWatch({ control, name: 'is_active' })
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 pt-2">
        <Checkbox id="is_active" checked={active} onCheckedChange={(checked) => state.setActive(checked === true)} />
        <span className="text-sm font-medium">{t('isActive')}</span>
      </label>
      {!active && (
        <FormDateField
          control={control}
          name="terminated_at"
          label={t('terminatedAt')}
          error={formState.errors.terminated_at?.message}
          lang={lang}
          className="max-w-sm animate-in duration-200 fade-in"
        />
      )}
    </>
  )
}

export function EmployeeForm({ initialData, lang, options }: EmployeeFormProps) {
  const t = useTranslations()
  const state = useEmployeeForm(initialData, options, lang)
  const { register, formState } = state.form
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(initialData ? 'common.edit' : 'common.add')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={state.onSubmit} className="space-y-4">
          <MainFields state={state} options={options} lang={lang} />
          <LabeledField id="notes" label={t('hr.notes')} error={formState.errors.notes?.message}>
            <Textarea id="notes" {...register('notes')} />
          </LabeledField>
          <EmployeeAccessSection access={state.access} />
          <ActiveFields state={state} lang={lang} />
          <FormFooter>
            <Button type="button" variant="outline" onClick={() => state.exitForm()} disabled={state.submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={state.submitting}>
              {state.submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </FormFooter>
        </form>
      </CardContent>
    </Card>
  )
}
