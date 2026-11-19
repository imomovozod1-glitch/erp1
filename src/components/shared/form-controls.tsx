'use client'

import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { DatePicker } from '@/components/ui/date-picker'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LabeledField } from '@/components/shared/labeled-field'
import { NameSelect, type NamedOption } from '@/components/shared/name-select'

interface FieldBase<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label: string
  required?: boolean
  error?: string
  className?: string
}

export function FormDateField<T extends FieldValues>({ control, name, label, required, error, className, lang }: FieldBase<T> & { lang: string }) {
  return (
    <LabeledField id={name} label={label} required={required} error={error} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => <DatePicker id={name} value={field.value} onChange={field.onChange} lang={lang} placeholder={label} />}
      />
    </LabeledField>
  )
}

export function FormAmountField<T extends FieldValues>({ control, name, label, required, error, className }: FieldBase<T>) {
  return (
    <LabeledField id={name} label={label} required={required} error={error} className={className}>
      <Controller control={control} name={name} render={({ field }) => <NumericInput id={name} value={field.value} onChange={field.onChange} />} />
    </LabeledField>
  )
}

export interface ChoiceOption {
  value: string
  label: string
}

export function FormChoiceField<T extends FieldValues>({ control, name, label, required, error, className, options }: FieldBase<T> & { options: ChoiceOption[] }) {
  return (
    <LabeledField id={name} label={label} required={required} error={error} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={(value) => value && field.onChange(value)}>
            <SelectTrigger id={name} className="w-full">
              <SelectValue>{options.find((o) => o.value === field.value)?.label ?? ''}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </LabeledField>
  )
}

interface FormNameFieldProps<T extends FieldValues> extends FieldBase<T> {
  options: readonly NamedOption[]
  emptyLabel: string
}

/** A picker of named rows that stores the id, with an explicit "none" choice. */
export function FormNameField<T extends FieldValues>({ control, name, label, required, error, className, options, emptyLabel }: FormNameFieldProps<T>) {
  return (
    <LabeledField id={name} label={label} required={required} error={error} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <NameSelect
            id={name}
            value={field.value === 'none' ? '' : (field.value ?? '')}
            onChange={field.onChange}
            options={options}
            placeholder={emptyLabel}
            clearLabel={emptyLabel}
          />
        )}
      />
    </LabeledField>
  )
}
